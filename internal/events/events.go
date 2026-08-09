// Package events 提供 Wails v3 事件发射的全局桥接。
// v3 中 EventsEmit 从 context 调用改为 app.Event.Emit，
// 此包避免在每个使用事件的包里注入 *application.App。
package events

// emit 存储 app.Event.Emit 的函数引用，在 ServiceStartup 时注入。
var emit func(name string, data ...any) bool

// SetEmitter 在应用启动时设置事件发射器。
func SetEmitter(f func(string, ...any) bool) {
	emit = f
}

// Emit 发射自定义事件到前端。
func Emit(name string, data ...any) bool {
	if emit != nil {
		return emit(name, data...)
	}
	return false
}
