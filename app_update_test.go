package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestIsAllowedUpdateDownloadURL(t *testing.T) {
	cases := []struct {
		url  string
		want bool
	}{
		{"https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1.2.0.1/Lumin-V1.2.0.1-portable.exe", true},
		{"https://ghproxy.net/https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1.2.0.1/x.exe", true},
		{"https://github.com/wmwlwmwl/Lumin-SSH/releases/tag/v1.2.0.1", false},
		{"https://github.com/wmwlwmwl/Lumin-SSH/releases/latest", false},
		{"https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe.sha256", false},
		{"http://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := isAllowedUpdateDownloadURL(tc.url); got != tc.want {
			t.Fatalf("isAllowedUpdateDownloadURL(%q)=%v want %v", tc.url, got, tc.want)
		}
	}
}

func TestIsAllowedUpdateFilename(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		{"Lumin-V1.2.0.1-portable.exe", true},
		{"Lumin-V1.2.0.1-amd64-installer.exe", true},
		{"pkg.deb", true},
		{"pkg.rpm", true},
		{"pkg.dmg", true},
		{"update.exe", true},
		{"x.exe.sha256", false},
		{"readme.txt", false},
		{"", false},
		{".", false},
		{"..", false},
	}
	for _, tc := range cases {
		if got := isAllowedUpdateFilename(tc.name); got != tc.want {
			t.Fatalf("isAllowedUpdateFilename(%q)=%v want %v", tc.name, got, tc.want)
		}
	}
}

func TestIsDirectGitHubUpdateURL(t *testing.T) {
	cases := []struct {
		url  string
		want bool
	}{
		{"https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1.2.0.1/x.exe", true},
		// 代理前缀 host 不是 github.com，即使 path 里嵌了 github.com 也算代理
		{"https://ghproxy.net/https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe", false},
		{"https://gh-proxy.com/https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe", false},
		{"https://proxy.gitwarp.top/https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe", false},
		{"http://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1/x.exe", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := isDirectGitHubUpdateURL(tc.url); got != tc.want {
			t.Fatalf("isDirectGitHubUpdateURL(%q)=%v want %v", tc.url, got, tc.want)
		}
	}
}

func TestNewUpdateDownloadHTTPClientDisablesHTTP2(t *testing.T) {
	client := newUpdateDownloadHTTPClient()
	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport")
	}
	if tr.ForceAttemptHTTP2 {
		t.Fatalf("ForceAttemptHTTP2 should be false for range parallelism")
	}
	if tr.TLSNextProto == nil {
		t.Fatalf("TLSNextProto should be non-nil empty map to disable HTTP/2")
	}
	if len(tr.TLSNextProto) != 0 {
		t.Fatalf("TLSNextProto should be empty, got %d entries", len(tr.TLSNextProto))
	}
	if client.Timeout != updateDownloadOverallTimeout {
		t.Fatalf("Timeout=%v want %v", client.Timeout, updateDownloadOverallTimeout)
	}
	if tr.ResponseHeaderTimeout != updateDownloadHeaderTimeout {
		t.Fatalf("ResponseHeaderTimeout=%v want %v", tr.ResponseHeaderTimeout, updateDownloadHeaderTimeout)
	}
}

func TestBuildUpdateByteRangesRespectsMinChunk(t *testing.T) {
	ranges := buildUpdateByteRanges(3<<20, 8) // 3 MiB
	if len(ranges) != 3 {
		t.Fatalf("got %d ranges, want 3 for 3MiB with 1MiB min chunk", len(ranges))
	}
	ranges = buildUpdateByteRanges(32<<20, 8) // 32 MiB
	if len(ranges) != 8 {
		t.Fatalf("got %d ranges, want 8", len(ranges))
	}
}

// 真实网络测速：直连/代理 × 单线程/多线程。
// 默认跳过；显式跑：
//
//	LUMIN_UPDATE_SPEED_TEST=1 go test -count=1 -v -run TestUpdateDownloadSpeedLive -timeout 20m .
func TestUpdateDownloadSpeedLive(t *testing.T) {
	if os.Getenv("LUMIN_UPDATE_SPEED_TEST") != "1" {
		t.Skip("set LUMIN_UPDATE_SPEED_TEST=1 to run live download speed test")
	}

	const (
		directURL = "https://github.com/wmwlwmwl/Lumin-SSH/releases/download/v1.2.2.1/Lumin-V1.2.2.1-amd64-installer.exe"
		// ~18.8 MiB，比 portable 小，测速足够
		expectedSize = int64(18832855)
	)
	proxies := []struct {
		name string
		url  string
	}{
		{"ghproxy.net", "https://ghproxy.net/" + directURL},
		{"gh-proxy.com", "https://gh-proxy.com/" + directURL},
		{"proxy.gitwarp.top", "https://proxy.gitwarp.top/" + directURL},
	}

	dir := t.TempDir()
	// 单次源最多 3 分钟，避免某个代理假死拖满 10 分钟
	client := newUpdateDownloadHTTPClient()
	client.Timeout = 3 * time.Minute

	type result struct {
		name string
		mbps float64
		sec  float64
		err  string
		size int64
	}
	var results []result

	runOne := func(name, url, mode string) {
		safe := strings.Map(func(r rune) rune {
			switch r {
			case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
				return '_'
			default:
				return r
			}
		}, name)
		target := filepath.Join(dir, safe+".bin")
		_ = os.Remove(target)
		start := time.Now()
		var err error
		switch mode {
		case "multi":
			// ctx 传 nil：避免 Wails EventsEmit 需要生命周期 context
			err = downloadUpdatePackageMultiPart(client, nil, url, target, "bench-progress")
		case "single":
			err = downloadUpdatePackageSingleThread(client, nil, url, target, "bench-progress")
		default:
			t.Fatalf("unknown mode %s", mode)
		}
		elapsed := time.Since(start).Seconds()
		if err != nil {
			results = append(results, result{name: name, err: err.Error(), sec: elapsed})
			t.Logf("%-36s FAIL  %.1fs  %v", name, elapsed, err)
			_ = os.Remove(target)
			return
		}
		st, stErr := os.Stat(target)
		size := int64(0)
		if stErr == nil {
			size = st.Size()
		}
		_ = os.Remove(target)
		if size <= 0 {
			results = append(results, result{name: name, err: "empty file", sec: elapsed})
			t.Logf("%-36s FAIL  empty file after %.1fs", name, elapsed)
			return
		}
		mbps := float64(size) / 1024 / 1024 / elapsed
		results = append(results, result{name: name, mbps: mbps, sec: elapsed, size: size})
		t.Logf("%-36s OK    %6.2f MB/s  %5.1fs  %d bytes", name, mbps, elapsed, size)
		if expectedSize > 0 && size != expectedSize {
			t.Logf("  note: size mismatch want %d got %d", expectedSize, size)
		}
	}

	// 直连：多线程 vs 单线程
	runOne("direct-multi", directURL, "multi")
	runOne("direct-single", directURL, "single")
	// 代理：单线程 + 多线程对照
	for _, p := range proxies {
		runOne("proxy-single/"+p.name, p.url, "single")
		runOne("proxy-multi/"+p.name, p.url, "multi")
	}

	t.Log("---- summary ----")
	best := -1.0
	bestName := ""
	for _, r := range results {
		if r.err != "" {
			t.Logf("%-36s %s (%.1fs)", r.name, r.err, r.sec)
			continue
		}
		line := fmt.Sprintf("%-36s %6.2f MB/s  %.1fs", r.name, r.mbps, r.sec)
		t.Log(line)
		if r.mbps > best {
			best = r.mbps
			bestName = r.name
		}
	}
	if bestName != "" {
		t.Logf("fastest: %s (%.2f MB/s)", bestName, best)
	}
}
