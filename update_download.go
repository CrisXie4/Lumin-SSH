package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const updateDownloadMaxConcurrency = 8
const updateDownloadMinChunkSize int64 = 1 << 20 // 1 MiB
const updateDownloadReadBufferSize = 1 << 20     // 1 MiB
const updateRangePartMaxAttempts = 3
const updateDownloadOverallTimeout = 10 * time.Minute
const updateDownloadDialTimeout = 15 * time.Second
const updateDownloadHeaderTimeout = 30 * time.Second

type updateByteRange struct {
	start int64
	end   int64
}

type updateProgressReporter struct {
	ctx       context.Context
	eventName string
	total     int64
	current   atomic.Int64
	done      chan struct{}
	stopOnce  sync.Once
}

func updateDownloadContext(ctx context.Context) context.Context {
	if ctx != nil {
		return ctx
	}
	return context.Background()
}

func emitUpdateDownloadProgress(ctx context.Context, eventName string, progress float64) {
	if ctx != nil {
		runtime.EventsEmit(ctx, eventName, progress)
	}
}

func newUpdateProgressReporter(ctx context.Context, eventName string, total int64) *updateProgressReporter {
	return &updateProgressReporter{
		ctx:       ctx,
		eventName: eventName,
		total:     total,
		done:      make(chan struct{}),
	}
}

func (r *updateProgressReporter) Start() {
	go func() {
		ticker := time.NewTicker(200 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				r.emit(false)
			case <-r.done:
				return
			}
		}
	}()
}

func (r *updateProgressReporter) Add(n int64) {
	if n != 0 {
		r.current.Add(n)
	}
}

// newUpdateDownloadHTTPClient 专用于更新下载。
// 强制 HTTP/1.1：Range 分片要靠多条 TCP 并行；默认 HTTP/2 多路复用会把并发挤回单连接，分片几乎白做。
// ResponseHeaderTimeout 让假死源尽快失败，外层才能换代理。
func newUpdateDownloadHTTPClient() *http.Client {
	return &http.Client{
		Timeout: updateDownloadOverallTimeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   updateDownloadDialTimeout,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			// 空 TLSNextProto：禁用 HTTP/2，Range 分片才能真正多 TCP 并行。
			TLSNextProto:          map[string]func(authority string, c *tls.Conn) http.RoundTripper{},
			ForceAttemptHTTP2:     false,
			MaxIdleConns:          32,
			MaxIdleConnsPerHost:   16,
			MaxConnsPerHost:       16,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   updateDownloadDialTimeout,
			ResponseHeaderTimeout: updateDownloadHeaderTimeout,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
}

func (r *updateProgressReporter) Stop(forceComplete bool) {
	r.stopOnce.Do(func() {
		r.emit(forceComplete)
		close(r.done)
	})
}

func (r *updateProgressReporter) emit(forceComplete bool) {
	progress := float64(0)
	if forceComplete {
		progress = 100
	} else if r.total > 0 {
		progress = float64(r.current.Load()) / float64(r.total) * 100
		if progress > 100 {
			progress = 100
		}
	}
	emitUpdateDownloadProgress(r.ctx, r.eventName, progress)
}

func buildUpdateByteRanges(totalSize int64, maxConcurrency int) []updateByteRange {
	if totalSize <= 0 {
		return nil
	}
	concurrency := maxConcurrency
	if concurrency < 1 {
		concurrency = 1
	}
	if totalSize < int64(concurrency)*updateDownloadMinChunkSize {
		concurrency = int((totalSize + updateDownloadMinChunkSize - 1) / updateDownloadMinChunkSize)
		if concurrency < 1 {
			concurrency = 1
		}
		if concurrency > maxConcurrency {
			concurrency = maxConcurrency
		}
	}
	if totalSize < int64(concurrency) {
		concurrency = int(totalSize)
		if concurrency < 1 {
			concurrency = 1
		}
	}
	ranges := make([]updateByteRange, 0, concurrency)
	baseSize := totalSize / int64(concurrency)
	remainder := totalSize % int64(concurrency)
	start := int64(0)
	for i := 0; i < concurrency; i++ {
		size := baseSize
		if int64(i) < remainder {
			size++
		}
		if size <= 0 {
			continue
		}
		end := start + size - 1
		ranges = append(ranges, updateByteRange{start: start, end: end})
		start = end + 1
	}
	return ranges
}

func parseUpdateContentRange(header string, expectedStart int64, expectedEnd int64) (int64, error) {
	header = strings.TrimSpace(header)
	if len(header) < 6 || strings.ToLower(header[:6]) != "bytes " {
		return 0, fmt.Errorf("invalid content-range header: %q", header)
	}
	rangeParts := strings.SplitN(strings.TrimSpace(header[6:]), "/", 2)
	if len(rangeParts) != 2 || rangeParts[1] == "" || rangeParts[1] == "*" {
		return 0, fmt.Errorf("invalid content-range header: %q", header)
	}
	totalSize, err := strconv.ParseInt(rangeParts[1], 10, 64)
	if err != nil || totalSize <= 0 {
		return 0, fmt.Errorf("invalid content-range total: %q", header)
	}
	bounds := strings.SplitN(strings.TrimSpace(rangeParts[0]), "-", 2)
	if len(bounds) != 2 {
		return 0, fmt.Errorf("invalid content-range bounds: %q", header)
	}
	start, err := strconv.ParseInt(bounds[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid content-range start: %q", header)
	}
	end, err := strconv.ParseInt(bounds[1], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid content-range end: %q", header)
	}
	if start != expectedStart || end != expectedEnd {
		return 0, fmt.Errorf("unexpected content-range %d-%d for expected %d-%d", start, end, expectedStart, expectedEnd)
	}
	if end < start || end >= totalSize {
		return 0, fmt.Errorf("invalid content-range bounds: %q", header)
	}
	return totalSize, nil
}

func probeUpdateRangeDownload(client *http.Client, ctx context.Context, downloadURL string) (int64, error) {
	req, err := http.NewRequestWithContext(updateDownloadContext(ctx), http.MethodGet, downloadURL, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Range", "bytes=0-0")
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		return 0, fmt.Errorf("range request unsupported: status %d", resp.StatusCode)
	}
	return parseUpdateContentRange(resp.Header.Get("Content-Range"), 0, 0)
}

func downloadUpdateRangePart(ctx context.Context, client *http.Client, downloadURL string, file *os.File, totalSize int64, chunk updateByteRange, reporter *updateProgressReporter) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", chunk.start, chunk.end))
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		return 0, fmt.Errorf("unexpected range status %d", resp.StatusCode)
	}
	reportedTotal, err := parseUpdateContentRange(resp.Header.Get("Content-Range"), chunk.start, chunk.end)
	if err != nil {
		return 0, err
	}
	if reportedTotal != totalSize {
		return 0, fmt.Errorf("unexpected content-range total %d", reportedTotal)
	}
	writeOffset := chunk.start
	remaining := chunk.end - chunk.start + 1
	var writtenTotal int64
	buf := make([]byte, updateDownloadReadBufferSize)
	for remaining > 0 {
		if err := ctx.Err(); err != nil {
			return writtenTotal, err
		}
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if int64(n) > remaining {
				return writtenTotal, fmt.Errorf("range overflow: expected %d remaining, got %d", remaining, n)
			}
			written, writeErr := file.WriteAt(buf[:n], writeOffset)
			if writeErr != nil {
				return writtenTotal, writeErr
			}
			if written != n {
				return writtenTotal, io.ErrShortWrite
			}
			writeOffset += int64(n)
			remaining -= int64(n)
			writtenTotal += int64(n)
			reporter.Add(int64(n))
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return writtenTotal, readErr
		}
	}
	if remaining != 0 {
		return writtenTotal, fmt.Errorf("incomplete range download: %d bytes remaining", remaining)
	}
	return writtenTotal, nil
}

// 单分片最多重试几次：代理/直连偶发断流时不必整包作废。
// 失败时回退已上报进度，避免重试把进度条顶穿。
func downloadUpdateRangePartWithRetry(ctx context.Context, client *http.Client, downloadURL string, file *os.File, totalSize int64, chunk updateByteRange, reporter *updateProgressReporter) error {
	var lastErr error
	for attempt := 1; attempt <= updateRangePartMaxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		written, err := downloadUpdateRangePart(ctx, client, downloadURL, file, totalSize, chunk, reporter)
		if err == nil {
			return nil
		}
		lastErr = err
		if written > 0 {
			reporter.Add(-written)
		}
		if attempt == updateRangePartMaxAttempts {
			break
		}
		backoff := time.Duration(attempt) * 300 * time.Millisecond
		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
	return lastErr
}

func downloadUpdatePackageMultiPart(client *http.Client, ctx context.Context, downloadURL string, targetPath string, eventName string) error {
	totalSize, err := probeUpdateRangeDownload(client, ctx, downloadURL)
	if err != nil {
		return err
	}
	ranges := buildUpdateByteRanges(totalSize, updateDownloadMaxConcurrency)
	if len(ranges) == 0 {
		return fmt.Errorf("invalid multipart ranges")
	}
	emitUpdateDownloadProgress(ctx, eventName, 0)
	file, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	if err := file.Truncate(totalSize); err != nil {
		_ = file.Close()
		_ = os.Remove(targetPath)
		return err
	}
	reporter := newUpdateProgressReporter(ctx, eventName, totalSize)
	reporter.Start()
	rangeCtx, cancel := context.WithCancel(updateDownloadContext(ctx))
	defer cancel()
	var wg sync.WaitGroup
	var firstErr error
	var firstErrOnce sync.Once
	for _, chunk := range ranges {
		chunk := chunk
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := downloadUpdateRangePartWithRetry(rangeCtx, client, downloadURL, file, totalSize, chunk, reporter); err != nil {
				firstErrOnce.Do(func() {
					firstErr = err
					cancel()
				})
			}
		}()
	}
	wg.Wait()
	closeErr := file.Close()
	if firstErr != nil {
		reporter.Stop(false)
		_ = os.Remove(targetPath)
		if closeErr != nil {
			return fmt.Errorf("%w: %v", firstErr, closeErr)
		}
		return firstErr
	}
	if closeErr != nil {
		reporter.Stop(false)
		_ = os.Remove(targetPath)
		return closeErr
	}
	reporter.Stop(true)
	return nil
}

func downloadUpdatePackageSingleThread(client *http.Client, ctx context.Context, downloadURL string, targetPath string, eventName string) error {
	emitUpdateDownloadProgress(ctx, eventName, 0)
	req, err := http.NewRequestWithContext(updateDownloadContext(ctx), http.MethodGet, downloadURL, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	out, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	pr := &progressReader{
		Reader:    resp.Body,
		ctx:       ctx,
		eventName: eventName,
		total:     resp.ContentLength,
		lastEmit:  time.Now(),
	}
	buf := make([]byte, updateDownloadReadBufferSize)
	_, copyErr := io.CopyBuffer(out, pr, buf)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(targetPath)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(targetPath)
		return closeErr
	}
	return nil
}

// isDirectGitHubUpdateURL 仅识别直连 github.com（及子域）下载地址。
// 代理前缀（如 ghproxy.net/https://github.com/...）返回 false。
func isDirectGitHubUpdateURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "github.com" || strings.HasSuffix(host, ".github.com")
}

// updateDownloadSourceLabel 给日志/错误用的短源名，避免整段 URL 刷屏。
func updateDownloadSourceLabel(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return raw
	}
	host := strings.ToLower(u.Hostname())
	if host == "github.com" || strings.HasSuffix(host, ".github.com") {
		return "GitHub直连"
	}
	return host
}

// downloadUpdatePackageWithFallback 单源策略：先多线程 Range，失败再同源单线程。
// 两种模式都失败才返回错误，由 UpdateApp 外层换下一个源。
func downloadUpdatePackageWithFallback(client *http.Client, ctx context.Context, downloadURL string, targetPath string, eventName string) error {
	src := updateDownloadSourceLabel(downloadURL)
	rangeErr := downloadUpdatePackageMultiPart(client, ctx, downloadURL, targetPath, eventName)
	if rangeErr == nil {
		fmt.Printf("[UpdateApp] %s 多线程下载成功\n", src)
		return nil
	}
	_ = os.Remove(targetPath)
	fmt.Printf("[UpdateApp] %s 多线程失败，改单线程重试: %v\n", src, rangeErr)
	// 进度归零，避免单线程接在多线程半成品进度后面
	emitUpdateDownloadProgress(ctx, eventName, 0)
	singleErr := downloadUpdatePackageSingleThread(client, ctx, downloadURL, targetPath, eventName)
	if singleErr == nil {
		fmt.Printf("[UpdateApp] %s 单线程下载成功\n", src)
		return nil
	}
	_ = os.Remove(targetPath)
	// 用户可见文案走中文 key，便于前端 i18n；技术细节挂在后面。
	return fmt.Errorf("%s 多线程与单线程均失败: multi=%v; single=%w", src, rangeErr, singleErr)
}
