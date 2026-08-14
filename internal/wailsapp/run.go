package wailsapp

// ponytail: 应用入口逻辑（原 main.go 的 Wails 启动 + 托盘 + 生命周期回调）。
// main.go 仅保留 //go:embed（路径相对根目录）并把资源注入 Run。
// 回调与 App 同包，可直接访问未导出字段（ctx/quitting/closeAck/configManager），
// 故无需为迁移新增任何导出方法，绑定结构体方法集零变化。

import (
	"context"
	"embed"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"luminssh-go/internal/mcpbridge"
	"luminssh-go/internal/platformruntime"

	"github.com/energye/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// embeddedModuleFS 由 main 包的 //go:embed all:module 注入，供内置 Provider 释放用。
// 保留为包级变量，使 app.go 中既有的 embeddedModuleFS.ReadFile / ReleaseEmbeddedDirectory 调用零改动。
var embeddedModuleFS embed.FS

// forceShowWindow 唤醒隐藏到托盘/久置最小化的窗口。
// 不先 Hide 再 Show：久置后 Show 失败会把窗口永久卡在隐藏态。
// 先走平台原生激活抢前台（Windows 久置后 SetForeground 常被拒），再异步走 Wails 恢复。
// 原生激活放前后各一次：覆盖「仅最小化」和「托盘隐藏」两种状态。
// ponytail: 托盘消息线程只做调度，绝不在这里同步执行窗口调用。
// energye/systray 的 wndProc 在托盘线程上同步回调 onClick；若同步执行
// platformruntime.ForceShowWindow（内部含 EnumWindows/ShowWindow/
// SetWindowPos/SetForegroundWindow/RedrawWindow 等向主窗口线程的
// 消息发送，无超时），主线程一旦卡死（SSH 断线等）托盘线程会无限期阻塞，
// 单击/双击/右键全部无响应，只能重启软件恢复。全部异步化后即使窗口操作
// 阻塞，托盘消息泵也能立即返回继续响应。
func forceShowWindow(ctx context.Context) {
	defer func() { recover() }()
	go func() {
		defer func() { recover() }()
		platformruntime.ForceShowWindow()
	}()
	if ctx != nil {
		go func() {
			defer func() { recover() }()
			wailsruntime.WindowUnminimise(ctx)
			wailsruntime.WindowShow(ctx)
		}()
	}
	go func() {
		defer func() { recover() }()
		platformruntime.ForceShowWindow()
	}()
}

var systrayOnce sync.Once

func setupSystray(app *App) {
	systrayOnce.Do(func() {
		systray.SetIcon(app.icon)
		systray.SetTitle("Lumin")
		systray.SetTooltip("Lumin SSH")

		mShow := systray.AddMenuItem("显示主窗口", "Show Main Window")
		mQuit := systray.AddMenuItem("完全退出", "Quit Lumin")

		showMain := func() {
			forceShowWindow(app.ctx)
		}

		if runtime.GOOS == "darwin" {
			// macOS: CreateMenu 将菜单永久挂到 statusItem，
			// 左键点托盘图标自动弹菜单（macOS 惯例）。
			// 不调 SetOnClick/SetOnRClick：enableOnClick 会覆盖菜单行为，
			// 且库注释明确 ShowMenu() 在 macOS 只支持 OnRClick 回调内调用。
			systray.CreateMenu()
		} else {
			// Windows/Linux: 左键直接显示窗口
			systray.SetOnClick(func(menu systray.IMenu) {
				showMain()
			})
			// 右键弹菜单；Windows 久置后 TrackPopupMenu 常因前台锁不弹出，
			// 先解锁再 ShowMenu。
			systray.SetOnRClick(func(menu systray.IMenu) {
				platformruntime.PrepareTrayMenu()
				menu.ShowMenu()
			})
		}

		mShow.Click(func() {
			showMain()
		})

		mQuit.Click(func() {
			app.DoQuit()
		})
	})
}

// maxLogFileSize 日志单文件上限：超过则启动时轮转（lumin.log → lumin.log.1），
// 防止长期运行无限增长；保留一份历史便于回溯。
const maxLogFileSize = 5 << 20 // 5MB

// openLogFile 打开追加日志文件；超过上限先轮转再打开。
func openLogFile(path string) (*os.File, error) {
	if info, err := os.Stat(path); err == nil && info.Size() > maxLogFileSize {
		_ = os.Rename(path, path+".1")
	}
	return os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
}

// initLogFile 把标准 log 输出重定向到文件（双写）：
//  1. %AppData%\Lumin\config\lumin.log —— 主日志，始终写入
//  2. exe 同级目录 lumin.log —— 便携版场景：对方解压运行后日志就在运行目录，
//     无需进入隐藏的 %AppData%，直接取回即可；安装版（Program Files）写失败自动忽略
// Windows 窗口应用没有控制台，log.Printf 默认写 stderr 会被丢弃，
// 诊断信息需要落盘才能远程排查。追加模式，0600，单文件 5MB 轮转。
// 返回清理函数（关闭文件句柄），应用生命周期内不要调用。
func initLogFile() func() {
	var writers []io.Writer
	var closers []io.Closer

	dir, err := os.UserConfigDir()
	if err == nil {
		dir = filepath.Join(dir, "Lumin", "config")
		if err := os.MkdirAll(dir, 0700); err == nil {
			if f, err := openLogFile(filepath.Join(dir, "lumin.log")); err == nil {
				writers = append(writers, f)
				closers = append(closers, f)
			}
		}
	}
	if exePath, err := os.Executable(); err == nil {
		if f, err := openLogFile(filepath.Join(filepath.Dir(exePath), "lumin.log")); err == nil {
			writers = append(writers, f)
			closers = append(closers, f)
		}
	}
	if len(writers) == 0 {
		return func() {}
	}
	log.SetOutput(io.MultiWriter(writers...))
	log.Printf("[Lumin] Logger initialized. Log files: %d", len(writers))
	return func() {
		for _, c := range closers {
			_ = c.Close()
		}
	}
}

// Run 启动 Wails 应用。embed 资源由 main 包注入（//go:embed 路径必须相对根目录的 main.go）。
func Run(assets embed.FS, moduleFS embed.FS, icon []byte) {
	// 日志落盘：先于一切业务日志，保证 [channel-diag] 等诊断可追溯
	initLogFile()

	// 单实例检查（平台特定实现）
	platformruntime.EnsureSingleInstance()

	// 内置 Provider 释放所需的 module embed 注入包级变量
	embeddedModuleFS = moduleFS

	app := NewApp()
	app.icon = icon

	systrayEnd := platformruntime.PrepareSystray(func() { setupSystray(app) })

	// 退出时先同步删托盘图标，再 systray.Quit。
	// Windows 上纯异步 Quit 常在 NIM_DELETE 前进程已死，留下幽灵图标。
	var trayCleanupOnce sync.Once
	cleanupTray := func() {
		trayCleanupOnce.Do(func() {
			platformruntime.RemoveTrayIconSync()
			systrayEnd()
		})
	}
	app.onBeforeQuit = cleanupTray

	// Create application with options
	opts := &options.App{
		Title:     "Lumin",
		Width:     1440,
		Height:    900,
		Frameless: true,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 8, G: 12, B: 20, A: 255}, // #080c14
		OnStartup: func(ctx context.Context) {
			// 先挂托盘：startup 里 MCP 等可能阻塞，托盘若排后面会出现「窗口已能关到托盘但图标很久才出」。
			app.ctx = ctx
			// macOS: 窗口隐藏到托盘后，点 Dock 图标恢复窗口。
			// Wails 的 AppDelegate 未实现 applicationShouldHandleReopen:hasVisibleWindows:。
			platformruntime.SetupDockReopenHandler(func() { forceShowWindow(app.ctx) })
			platformruntime.StartSystray(func() { setupSystray(app) })
			// 启动单实例 socket：二次启动会发 show 指令，经 forceShowWindow 走托盘同一路径唤起主窗口。
			platformruntime.StartSingletonServer(func() {
				forceShowWindow(app.ctx)
			})
			app.startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			app.shutdown()
			platformruntime.StopSingletonServer()
			mcpbridge.StopServer(newMCPHost(app))
			cleanupTray()
		},
		// 拦截窗口关闭：弹出对话框让用户选择退出 / 系统托盘 / 取消
		OnBeforeClose: func(ctx context.Context) bool {
			if app.quitting.Load() {
				return false // 用户确认退出，放行
			}
			app.closeAck.Store(false) // 重置，等待本次前端响应
			wailsruntime.EventsEmit(ctx, "close-request")
			// 超时兜底：仅当前端 5 秒内无响应（崩溃/JS 异常）时强制退出；
			// 前端选 tray/cancel 会调 AckClose 置位 closeAck，跳过强制退出
			go func() {
				time.Sleep(5 * time.Second)
				if !app.quitting.Load() && !app.closeAck.Load() {
					// 前端无响应时也必须复用统一退出清理，先断开 SSH 再退出。
					app.DoQuit()
				}
			}()
			return true // 取消关闭，由前端弹窗决定后续操作
		},
		Bind: []interface{}{
			app,
			NewAIBindings(app),
			NewAIProviderBindings(app.configManager),
		},
	}

	if _, ok := os.LookupEnv("LUMIN_OPEN_DEVTOOLS"); ok {
		opts.Debug.OpenInspectorOnStartup = true
	}

	// 应用平台特定选项（平台特定实现）
	gpuDisabled := app.configManager != nil && app.configManager.GetWebviewGpuDisabled()
	platformruntime.ApplyOptions(opts, gpuDisabled)

	err := wails.Run(opts)

	if err != nil {
		println("Error:", err.Error())
	}
}
