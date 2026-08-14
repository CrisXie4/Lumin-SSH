package wailsapp

import (
	"log"
	"os"
	"path/filepath"
	"testing"
)

// initLogFile 必须真正落盘：设置临时配置目录后，log.Printf 应写入 lumin.log。
func TestInitLogFileWritesToDisk(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("USERPROFILE", tmp) // Windows
	t.Setenv("HOME", tmp)        // Unix
	t.Setenv("APPDATA", filepath.Join(tmp, "AppData", "Roaming"))

	cleanup := initLogFile()
	if cleanup == nil {
		t.Fatal("initLogFile 返回 nil，日志未初始化")
	}
	defer func() {
		cleanup()
		log.SetOutput(os.Stderr)
	}()
	log.Printf("[channel-diag] TEST-MARKER connect session=probe")

	logPath := filepath.Join(tmp, "AppData", "Roaming", "Lumin", "config", "lumin.log")
	raw, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("lumin.log 未生成: %v", err)
	}
	if !contains(string(raw), "TEST-MARKER") {
		t.Fatalf("lumin.log 内容缺少测试标记: %q", string(raw))
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
