//go:build linux

package platformruntime

import "github.com/wailsapp/wails/v3/pkg/application"

// ApplyOptions 在 Linux 上无需附加平台选项。
func ApplyOptions(_ *application.Options, _ *application.WebviewWindowOptions, _ bool) {}
