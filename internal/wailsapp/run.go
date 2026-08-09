package wailsapp

// ponytail: 应用入口逻辑（原 main.go 的 Wails 启动 + 托盘 + 生命周期回调）。
// main.go 仅保留 //go:embed（路径相对根目录）并把资源注入 Run。
// 回调与 App 同包，可直接访问未导出字段（ctx/quitting/closeAck/configManager），
// 故无需为迁移新增任何导出方法，绑定结构体方法集零变化。

import (
	"embed"
	"log"
	"os"
	goruntime "runtime"
	"sync"
	"time"

	"luminssh-go/internal/events"
	"luminssh-go/internal/mcpbridge"
	"luminssh-go/internal/platformruntime"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailevents "github.com/wailsapp/wails/v3/pkg/events"
)

// embeddedModuleFS 由 main 包的 //go:embed all:module 注入，供内置 Provider 释放用。
// 保留为包级变量，使 app.go 中既有的 embeddedModuleFS.ReadFile / ReleaseEmbeddedDirectory 调用零改动。
var embeddedModuleFS embed.FS

// forceShowWindow 唤醒隐藏到托盘/久置最小化的窗口。
// 不先 Hide 再 Show：久置后 Show 失败会把窗口永久卡在隐藏态。
// 先走平台原生激活抢前台（Windows 久置后 SetForeground 常被拒），再用 Wails 恢复。
// 原生激活放前后各一次：覆盖「仅最小化」和「托盘隐藏」两种状态。
func forceShowWindow(wailsApp *application.App) {
	defer func() { recover() }()
	platformruntime.ForceShowWindow()
	if wailsApp != nil {
		if win := wailsApp.Window.Current(); win != nil {
			win.UnMinimise()
			win.Show()
		}
	}
	platformruntime.ForceShowWindow()
}

// Run 启动 Wails 应用。embed 资源由 main 包注入（//go:embed 路径必须相对根目录的 main.go）。
func Run(assets embed.FS, moduleFS embed.FS, icon []byte) {
	// 单实例检查（平台特定实现）
	platformruntime.EnsureSingleInstance()

	// 内置 Provider 释放所需的 module embed 注入包级变量
	embeddedModuleFS = moduleFS

	app := NewApp()
	app.icon = icon

	// ── 托盘清理（Wails v3 内置 SystemTray，退出时 Destroy） ──────
	var systemTray *application.SystemTray
	var trayCleanupOnce sync.Once
	cleanupTray := func() {
		trayCleanupOnce.Do(func() {
			if systemTray != nil {
				systemTray.Destroy()
			}
		})
	}
	app.onBeforeQuit = cleanupTray

	// ── 创建 v3 应用 ──────────────────────────────────────────────
	appOpts := &application.Options{
		Name:        "Lumin",
		Description: "Lumin SSH",
		Services: []application.Service{
			application.NewService(app),
			application.NewService(NewAIBindings(app)),
			application.NewService(NewAIProviderBindings(app.configManager)),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		OnShutdown: func() {
			platformruntime.StopSingletonServer()
			mcpbridge.StopServer(newMCPHost(app))
			cleanupTray()
		},
	}

	winOpts := &application.WebviewWindowOptions{
		Title:            "Lumin",
		Width:            1440,
		Height:           900,
		Frameless:        true,
		EnableFileDrop:   true,
		BackgroundColour: application.RGBA{Red: 8, Green: 12, Blue: 20, Alpha: 255},
	}

	if _, ok := os.LookupEnv("LUMIN_OPEN_DEVTOOLS"); ok {
		winOpts.OpenInspectorOnStartup = true
	}

	// 应用平台特定选项（平台特定实现）
	gpuDisabled := app.configManager != nil && app.configManager.GetWebviewGpuDisabled()
	platformruntime.ApplyOptions(appOpts, winOpts, gpuDisabled)

	// 创建 v3 应用实例（singleton）
	wailsApp := application.New(*appOpts)
	app.wailsApp = wailsApp

	// 注入事件发射器桥接：v3 用 app.Event.Emit，桥接到全局 events 包
	events.SetEmitter(func(name string, data ...any) bool {
		return wailsApp.Event.Emit(name, data...)
	})

	// 创建主窗口
	window := wailsApp.Window.NewWithOptions(*winOpts)

	// ── 拦截窗口关闭：弹出对话框让用户选择退出 / 系统托盘 / 取消 ──────
	// v3 用 RegisterHook（同步钩子）+ event.Cancel() 阻止内置关闭监听器。
	// OnWindowEvent 是异步 goroutine 监听器，无法可靠阻止关闭。
	window.RegisterHook(wailevents.Common.WindowClosing, func(event *application.WindowEvent) {
		if app.quitting.Load() {
			return // 用户确认退出，放行关闭
		}
		event.Cancel() // 取消关闭，由前端弹窗决定后续操作
		app.closeAck.Store(false)
		events.Emit("close-request")
		// 超时兜底：仅当前端 5 秒内无响应（崩溃/JS 异常）时强制退出；
		// 前端选 tray/cancel 会调 AckClose 置位 closeAck，跳过强制退出
		go func() {
			time.Sleep(5 * time.Second)
			if !app.quitting.Load() && !app.closeAck.Load() {
				app.quitting.Store(true)
				cleanupTray()
				wailsApp.Quit()
			}
		}()
	})

	// ── 文件拖放：转发 WindowFilesDropped 事件到前端 ──────────────
	// v3 的文件拖放是 Go 侧窗口事件，需手动 Emit 到前端。
	window.OnWindowEvent(wailevents.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		ctx := event.Context()
		files := ctx.DroppedFiles()
		dt := ctx.DropTargetDetails()
		x, y := 0, 0
		if dt != nil {
			x, y = dt.X, dt.Y
		}
		events.Emit("file-drop", map[string]any{
			"x":     x,
			"y":     y,
			"paths": files,
		})
	})

	// ── macOS: 窗口隐藏到托盘后，点 Dock 图标恢复窗口 ──────────────
	platformruntime.SetupDockReopenHandler(func() { forceShowWindow(wailsApp) })

	// ── 系统托盘（Wails v3 内置，替代 energye/systray 避免 MenuItem 符号冲突）──
	systemTray = wailsApp.SystemTray.New()
	systemTray.SetIcon(icon)
	systemTray.SetTooltip("Lumin SSH")

	trayMenu := wailsApp.NewMenu()
	trayMenu.Add("显示主窗口").OnClick(func(ctx *application.Context) {
		forceShowWindow(wailsApp)
	})
	trayMenu.AddSeparator()
	trayMenu.Add("完全退出").OnClick(func(ctx *application.Context) {
		app.DoQuit()
	})
	systemTray.SetMenu(trayMenu)

	if goruntime.GOOS == "darwin" {
		// macOS: 左键弹菜单（macOS 惯例）
		systemTray.OnClick(func() {
			systemTray.ShowMenu()
		})
	} else {
		// Windows/Linux: 左键显示窗口
		systemTray.OnClick(func() {
			forceShowWindow(wailsApp)
		})
	}

	// ── 单实例 socket（Linux/macOS）：二次启动发 show 指令唤起主窗口 ──
	platformruntime.StartSingletonServer(func() {
		forceShowWindow(wailsApp)
	})

	// ── 启动应用 ──────────────────────────────────────────────────
	err := wailsApp.Run()
	if err != nil {
		log.Printf("应用启动失败: %v", err)
	}
}
