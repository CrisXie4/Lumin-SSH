//go:build !darwin

package platformruntime

// SetupDockReopenHandler 非 macOS 平台的空实现。
func SetupDockReopenHandler(callback func()) {}
