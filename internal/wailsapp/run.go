package wailsapp

// ponytail: 应用入口逻辑（原 main.go 的 Wails 启动 + 托盘 + 生命周期回调）。
// main.go 仅保留 //go:embed（路径相对根目录）并把资源注入 Run。
// 回调与 App 同包，可直接访问未导出字段（ctx/quitting/closeAck/configManager），
// 故无需为迁移新增任何导出方法，绑定结构体方法集零变化。

import (
	"context"
	"embed"
	"os"
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
// ponytail: Wails 运行时调用异步化，避免阻塞 systray 消息线程。
// 久置后 WebView 恢复可能慢/卡，同步调用会冻结托盘消息泵，
// 导致单击/双击/右键全部无响应。
// 平台原生激活（activateHWND）内置主线程存活检查：主线程卡死时
// 只投递 ShowWindowAsync（非阻塞），跳过 SetActiveWindow/SetFocus/
// RedrawWindow/UpdateWindow 等同步消息发送，避免拖死托盘消息泵。
func forceShowWindow(ctx context.Context) {
	defer func() { recover() }()
	platformruntime.ForceShowWindow()
	if ctx != nil {
		go func() {
			defer func() { recover() }()
			wailsruntime.WindowUnminimise(ctx)
			wailsruntime.WindowShow(ctx)
		}()
	}
	platformruntime.ForceShowWindow()
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

// Run 启动 Wails 应用。embed 资源由 main 包注入（//go:embed 路径必须相对根目录的 main.go）。
func Run(assets embed.FS, moduleFS embed.FS, icon []byte) {
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
