//go:build linux

package platformruntime

import "github.com/wailsapp/wails/v3/pkg/application"

// ApplyOptions 设置 Linux 程序名，使 GTK 窗口与 lumin.desktop 的图标和任务栏条目匹配。
func ApplyOptions(opts *application.Options, _ *application.WebviewWindowOptions, _ bool) {
	opts.Linux.ProgramName = "lumin"
}
