package transfer

import (
	"bytes"
	"context"
	"io"
	"net"
	"os"
	"testing"
	"time"

	"github.com/pkg/sftp"
)

// 本文件针对 issue #334(下载大文件不完整/损坏)的回归测试。
//
// 背景:部分 SFTP 服务器对超过 32KB 的 READ 请求只返回 32KB 数据(短读),
// 并对越过文件末尾的 READ 返回 EOF。pkg/sftp v1.13.x 的并发读路径会把短读
// 当作正常数据(造成数据缺口与错位)、把提前 EOF 当作正常结束,io.Copy 因此
// 静默返回成功,本地留下一个远小于原文件且内容损坏的文件。
//
// shortReadServerBackend 借助 sftp.NewRequestServer 复现这类服务器:
// RequestServer 的 defaultMaxTxPacket 恰为 32KB,对任何超过 32KB 的 READ
// 请求都只回 32KB 数据,与 issue 中的服务器行为一致。

const shortReadServerPath = "/remote.bin"

type shortReadServerBackend struct {
	content []byte
}

func (b *shortReadServerBackend) Fileread(r *sftp.Request) (io.ReaderAt, error) {
	if !r.Pflags().Read {
		return nil, os.ErrInvalid
	}
	return bytes.NewReader(b.content), nil
}

func (b *shortReadServerBackend) Filewrite(r *sftp.Request) (io.WriterAt, error) {
	return nil, os.ErrInvalid
}

func (b *shortReadServerBackend) Filecmd(r *sftp.Request) error { return nil }

func (b *shortReadServerBackend) Filelist(r *sftp.Request) (sftp.ListerAt, error) {
	if r.Method != "Stat" && r.Method != "Lstat" {
		return nil, os.ErrNotExist
	}
	return shortReadListerAt{fakeRemoteFileInfo{name: "remote.bin", size: int64(len(b.content))}}, nil
}

type fakeRemoteFileInfo struct {
	name string
	size int64
}

func (f fakeRemoteFileInfo) Name() string       { return f.name }
func (f fakeRemoteFileInfo) Size() int64        { return f.size }
func (f fakeRemoteFileInfo) Mode() os.FileMode  { return 0o644 }
func (f fakeRemoteFileInfo) ModTime() time.Time { return time.Unix(0, 0).UTC() }
func (f fakeRemoteFileInfo) IsDir() bool        { return false }
func (f fakeRemoteFileInfo) Sys() any           { return nil }

type shortReadListerAt []os.FileInfo

func (l shortReadListerAt) ListAt(ls []os.FileInfo, offset int64) (int, error) {
	if offset >= int64(len(l)) {
		return 0, io.EOF
	}
	n := copy(ls, l[offset:])
	if n < len(ls) {
		return n, io.EOF
	}
	return n, nil
}

// newShortReadServerClient 在 net.Pipe 上搭建一对 SFTP 客户端/服务器,
// 服务器对超过 32KB 的 READ 请求只回 32KB 数据。
func newShortReadServerClient(t *testing.T, content []byte, opts ...sftp.ClientOption) *sftp.Client {
	t.Helper()
	serverConn, clientConn := net.Pipe()
	backend := &shortReadServerBackend{content: content}
	server := sftp.NewRequestServer(serverConn, sftp.Handlers{
		FileGet:  backend,
		FilePut:  backend,
		FileCmd:  backend,
		FileList: backend,
	})
	serveDone := make(chan error, 1)
	go func() { serveDone <- server.Serve() }()
	client, err := sftp.NewClientPipe(clientConn, clientConn, opts...)
	if err != nil {
		t.Fatalf("sftp.NewClientPipe: %v", err)
	}
	t.Cleanup(func() {
		_ = client.Close()
		_ = server.Close()
		_ = clientConn.Close()
		_ = serverConn.Close()
		select {
		case <-serveDone:
		case <-time.After(5 * time.Second):
		}
	})
	return client
}

// shortReadTestContent 生成约 1.5MB 非重复数据:足以跨越多个 128KB/32KB 请求
// 边界,末尾故意不对齐,以覆盖最后一块的部分读取。
func shortReadTestContent() []byte {
	content := make([]byte, 3*128*1024+257*1024+3)
	seed := byte(0x5A)
	for i := range content {
		seed = seed*131 + 7
		content[i] = seed
	}
	return content
}

func openShortReadServerFile(t *testing.T, client *sftp.Client) (*sftp.File, int64) {
	t.Helper()
	src, err := client.Open(shortReadServerPath)
	if err != nil {
		t.Fatalf("client.Open: %v", err)
	}
	t.Cleanup(func() { _ = src.Close() })
	info, err := src.Stat()
	if err != nil {
		t.Fatalf("src.Stat: %v", err)
	}
	if info.Size() <= 128*1024 {
		t.Fatalf("test file too small to exercise concurrent reads: %d", info.Size())
	}
	return src, info.Size()
}

// 拷贝层守卫:实际接收字节数少于声明大小时必须报错,而不是静默成功。
func TestCopyReaderWithProgressContextRejectsShortStream(t *testing.T) {
	src := io.LimitReader(bytes.NewReader([]byte("0123456789")), 5)
	var dst bytes.Buffer
	err := copyReaderWithProgressContext(context.Background(), &dst, src, 10, nil)
	if err == nil {
		t.Fatal("short stream accepted: expected error, got nil")
	}
	if dst.Len() != 5 {
		t.Fatalf("copied = %d bytes, want 5", dst.Len())
	}
}

func TestCopyReaderWithProgressContextAcceptsFullStream(t *testing.T) {
	src := bytes.NewReader([]byte("0123456789"))
	var dst bytes.Buffer
	if err := copyReaderWithProgressContext(context.Background(), &dst, src, 10, nil); err != nil {
		t.Fatalf("full stream rejected: %v", err)
	}
	if dst.String() != "0123456789" {
		t.Fatalf("content = %q, want %q", dst.String(), "0123456789")
	}
}

func TestCopyReaderWithProgressContextAcceptsEmptyStream(t *testing.T) {
	var dst bytes.Buffer
	if err := copyReaderWithProgressContext(context.Background(), &dst, bytes.NewReader(nil), 0, nil); err != nil {
		t.Fatalf("empty stream rejected: %v", err)
	}
}

// MCP 传输路径的拷贝守卫:短流必须报错。
func TestRunMCPTransferCopyRejectsShortStream(t *testing.T) {
	src := io.LimitReader(bytes.NewReader([]byte("0123456789")), 4)
	var dst bytes.Buffer
	if err := runMCPTransferCopy(context.Background(), &dst, src, 10, nil); err == nil {
		t.Fatal("short stream accepted: expected error, got nil")
	}
}

// 集成复现:短读服务器 + 旧调优选项(128KB 读长)时,拷贝层必须把截断报告为
// 错误。修复前 io.Copy 静默返回 nil,本地只得到约 1/4 的数据且内容错位。
func TestDownloadShortReadServerTunedOptionsMustFail(t *testing.T) {
	content := shortReadTestContent()
	client := newShortReadServerClient(t, content, buildTunedSFTPOptions(DefaultTuning())...)
	src, totalSize := openShortReadServerFile(t, client)

	var dst bytes.Buffer
	err := copyReaderWithProgressContext(context.Background(), &dst, src, totalSize, nil)
	if err == nil {
		t.Fatalf("silent truncation: expected error, got nil (copied %d of %d bytes)", dst.Len(), totalSize)
	}
}

// 集成验证:共享 client 选项(互操作安全的读长)必须能从短读服务器完整下载,
// 且内容逐字节一致。
func TestDownloadShortReadServerSharedOptionsCompletes(t *testing.T) {
	content := shortReadTestContent()
	client := newShortReadServerClient(t, content, SharedSFTPClientOptions(DefaultTuning())...)
	src, totalSize := openShortReadServerFile(t, client)

	var dst bytes.Buffer
	if err := copyReaderWithProgressContext(context.Background(), &dst, src, totalSize, nil); err != nil {
		t.Fatalf("download failed: %v", err)
	}
	if int64(dst.Len()) != totalSize {
		t.Fatalf("downloaded %d bytes, want %d", dst.Len(), totalSize)
	}
	if !bytes.Equal(dst.Bytes(), content) {
		t.Fatal("downloaded content differs from remote file")
	}
}

// MCP 下载走 File.Read(2MB 缓冲),并发 ReadAt 同样受短读影响;共享 client
// 选项下也必须完整。
func TestMCPDownloadShortReadServerSharedOptionsCompletes(t *testing.T) {
	content := shortReadTestContent()
	client := newShortReadServerClient(t, content, SharedSFTPClientOptions(DefaultTuning())...)
	src, totalSize := openShortReadServerFile(t, client)

	var dst bytes.Buffer
	if err := runMCPTransferCopy(context.Background(), &dst, src, totalSize, nil); err != nil {
		t.Fatalf("mcp download failed: %v", err)
	}
	if int64(dst.Len()) != totalSize {
		t.Fatalf("downloaded %d bytes, want %d", dst.Len(), totalSize)
	}
	if !bytes.Equal(dst.Bytes(), content) {
		t.Fatal("downloaded content differs from remote file")
	}
}
