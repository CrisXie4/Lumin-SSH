//go:build darwin

package platformruntime

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// ApplyOptions 设置 macOS 窗口选项。
func ApplyOptions(_ *application.Options, winOpts *application.WebviewWindowOptions, _ bool) {
	if winOpts == nil {
		return
	}
	winOpts.Mac = application.MacWindow{
		TitleBar:   application.MacTitleBarHiddenInset,
		Appearance: application.DefaultAppearance,
	}
}
