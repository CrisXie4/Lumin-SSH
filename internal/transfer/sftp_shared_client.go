package transfer

import (
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// sftpInteropSafeReadBytes 是 SFTPv3 规范保证所有服务器都能正确返回的
// 单次读请求长度(32768)。超过它的 READ 依赖服务器宽容:部分服务器/网关
// (旧 OpenSSH、Dropbear、存储设备等)只返回 32KB 短数据甚至提前 EOF,
// 而 pkg/sftp 的并发读会把短读当正常数据、提前 EOF 当正常结束,表现为
// 下载静默截断且文件损坏(issue #334)。共享 client 承载全部下载流量,
// 读方向必须固定在这个互操作安全长度;上传池 client 只写不读,仍用调优包长。
const sftpInteropSafeReadBytes = 32 * 1024

// SharedSFTPClientOptions 返回共享 SFTP client(下载与常规远程文件操作)的
// 构建选项。包长固定 32KB;未显式配置并发数时按"SSH 通道窗口 / 包长"放大
// 并发请求数(2MB/32KB = 64),保持与 128KB×16 调优相同的在途数据量,
// 避免高延迟链路吞吐退化;用户显式配置过并发数则尊重其上限。
func SharedSFTPClientOptions(tuning Tuning) []sftp.ClientOption {
	tuning = NormalizeTuning(tuning)
	requests := tuning.MaxRequestsPerFile
	if !tuning.Configured {
		if bounded := sshChannelWindowBytes / sftpInteropSafeReadBytes; bounded > requests {
			requests = bounded
		}
	}
	return []sftp.ClientOption{
		sftp.MaxPacketChecked(sftpInteropSafeReadBytes),
		sftp.MaxConcurrentRequestsPerFile(requests),
		sftp.UseConcurrentWrites(tuning.ConcurrentWrites),
	}
}

// NewSharedSFTPClient 基于既有 SSH 连接构建共享 SFTP client。
func NewSharedSFTPClient(sshClient *ssh.Client, tuning Tuning) (*sftp.Client, error) {
	return sftp.NewClient(sshClient, SharedSFTPClientOptions(tuning)...)
}

func (s *Service) NewSharedSFTPClient(sshClient *ssh.Client) (*sftp.Client, error) {
	return NewSharedSFTPClient(sshClient, s.Tuning())
}
