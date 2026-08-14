package wailsapp

import (
	"log"
	"os"
	"path/filepath"
	"testing"
)

// initLogFile 必须真正落盘：设置临时配置目录后，log.Printf 应写入 lumin.log。
// exe 同级目录通过 logExeDirSeam 指到临时目录，避免测试在构建缓存目录留下日志。
func TestInitLogFileWritesToDisk(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("USERPROFILE", tmp) // Windows
	t.Setenv("HOME", tmp)        // Unix
	t.Setenv("APPDATA", filepath.Join(tmp, "AppData", "Roaming"))
	logExeDirSeam = filepath.Join(tmp, "exe")
	if err := os.MkdirAll(logExeDirSeam, 0700); err != nil {
		t.Fatalf("创建 exe 缝目录失败: %v", err)
	}
	t.Cleanup(func() { logExeDirSeam = "" })

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
	// exe 同级目录也应落盘（便携版场景），且不能污染真实运行目录
	exeLog, err := os.ReadFile(filepath.Join(logExeDirSeam, "lumin.log"))
	if err != nil {
		t.Fatalf("exe 同级 lumin.log 未生成: %v", err)
	}
	if !contains(string(exeLog), "TEST-MARKER") {
		t.Fatalf("exe 同级 lumin.log 内容缺少测试标记: %q", string(exeLog))
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
