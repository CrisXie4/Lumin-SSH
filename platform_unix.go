//go:build linux

package main

import (
	_ "embed"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed build/appicon.png
var icon []byte

// singletonLock holds the lock file descriptor to prevent GC from closing it
var singletonLock *os.File

// singletonSocketPath 是单实例 IPC 用的 Unix Domain Socket 路径。
// 与 flock 锁放在同一目录，目录受 $TMPDIR / 系统管理，权限 0700 足够。
const singletonSocketPath = "lumin-ssh.sock"

// singletonShowWindow 收到二次启动信号时被 main 注入：
// 主进程通过 Wails runtime 唤起自己的主窗口（与托盘点击同路径）。
var singletonShowWindow func()

// singletonSocketListener 主实例持有的 socket 监听器，退出时关闭。
var singletonSocketListener net.Listener

// findAndShowWindow 二次启动时调用：通知已运行的主实例显示窗口。
// 主实例在 ensureSingleInstance 拿到锁后会启动 socket server，
// 二实例连进来发 "show\n"，主实例回调 singletonShowWindow。
func findAndShowWindow() {
	conn, err := net.DialTimeout("unix", singleInstanceSocketPath(), 2*time.Second)
	if err != nil {
		return
	}
	defer func() { _ = conn.Close() }()
	_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_, _ = conn.Write([]byte("show\n"))
}

// platformForceShowWindow Linux 暂无原生兜底，依赖 Wails WindowShow（托盘路径已覆盖）
func platformForceShowWindow() {}

// removeTrayIconSync Windows 幽灵托盘修复专用；Linux 无此问题
func removeTrayIconSync() {}

// platformPrepareTrayMenu Windows 托盘右键菜单前台解锁专用；Linux 无此问题
func platformPrepareTrayMenu() {}

// singleInstanceSocketPath 返回 socket 文件路径（与 lock 文件同目录，区分用户避免多用户冲突）。
func singleInstanceSocketPath() string {
	if runDir := os.Getenv("XDG_RUNTIME_DIR"); runDir != "" {
		return filepath.Join(runDir, singletonSocketPath)
	}
	return filepath.Join(os.TempDir(), fmt.Sprintf("lumin-ssh-%d.sock", os.Getuid()))
}

// ensureSingleInstance 使用 flock 检查是否已有实例运行。
// 拿到锁的主实例随后应调用 startSingletonServer 注册窗口唤起回调。
func ensureSingleInstance() {
	lockFile := filepath.Join(os.TempDir(), fmt.Sprintf("lumin-ssh-%d.lock", os.Getuid()))
	f, err := os.OpenFile(lockFile, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return
	}
	err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	if err != nil {
		fmt.Println("Lumin is already running.")
		findAndShowWindow()
		os.Exit(0)
	}
	singletonLock = f
}

// startSingletonServer 在主实例上启动 Unix Socket 监听，
// 二次启动的实例会连接并发送 "show" 指令，此处回调 showFn 显示主窗口。
// showFn 通常包装 runtime.WindowShow（与托盘点击同路径）。
func startSingletonServer(showFn func()) {
	socketPath := singleInstanceSocketPath()
	_ = os.Remove(socketPath) // 清理上次崩溃残留

	l, err := net.Listen("unix", socketPath)
	if err != nil {
		return
	}
	singletonSocketListener = l
	singletonShowWindow = showFn

	go func() {
		for {
			conn, err := l.Accept()
			if err != nil {
				return // listener 已关闭
			}
			go handleSingletonConn(conn)
		}
	}()
}

// handleSingletonConn 读取一帧指令并执行，处理完即关闭连接。
func handleSingletonConn(conn net.Conn) {
	defer func() { _ = conn.Close() }()
	buf := make([]byte, 16)
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	n, _ := conn.Read(buf)
	cmd := string(buf[:n])
	switch cmd {
	case "show\n", "show":
		if singletonShowWindow != nil {
			singletonShowWindow()
		}
	}
}

// stopSingletonServer 关闭并清理 socket（主实例退出时调用）。
func stopSingletonServer() {
	if singletonSocketListener != nil {
		_ = singletonSocketListener.Close()
		singletonSocketListener = nil
	}
	_ = os.Remove(singleInstanceSocketPath())
}

func acquireMainLivenessLock(path string) (func(), error) {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err := file.Truncate(0); err == nil {
		_, _ = file.Write([]byte("1"))
		_, _ = file.Seek(0, 0)
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = file.Close()
		return nil, err
	}
	return func() {
		_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
		_ = file.Close()
	}, nil
}

// applyPlatformOptions 在 Linux 上无额外选项
func applyPlatformOptions(opts *options.App, configManager *ConfigManager) {}
