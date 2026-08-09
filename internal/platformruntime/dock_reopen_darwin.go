//go:build darwin

package platformruntime

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>

extern void dockReopenCallback(void);

// reopenHandler 是 applicationShouldHandleReopen:hasVisibleWindows: 的实现。
// 窗口隐藏到托盘后 hasVisibleWindows=NO，此时调 Go 回调恢复窗口。
static BOOL reopenHandler(id self, SEL cmd, NSApplication *application, BOOL hasVisibleWindows) {
    if (!hasVisibleWindows) {
        dockReopenCallback();
    }
    return YES;
}

// setupReopenHandler 通过 class_addMethod 给 Wails 的 AppDelegate 动态注入
// applicationShouldHandleReopen:hasVisibleWindows: 方法。
// Wails 未实现该方法，导致窗口隐藏后点 Dock 图标无反应。
static void setupReopenHandler(void) {
    Class appDelegateClass = NSClassFromString(@"AppDelegate");
    if (!appDelegateClass) {
        return;
    }
    SEL selector = @selector(applicationShouldHandleReopen:hasVisibleWindows:);
    if (class_getInstanceMethod(appDelegateClass, selector)) {
        return;
    }
    class_addMethod(appDelegateClass, selector, (IMP)reopenHandler, "B@:@B");
}
*/
import "C"

var dockReopenFunc func()

//export dockReopenCallback
func dockReopenCallback() {
	if dockReopenFunc != nil {
		dockReopenFunc()
	}
}

// SetupDockReopenHandler 注册 Dock 图标点击恢复窗口的回调（仅 macOS）。
// 窗口隐藏到托盘后，点 Dock 图标默认不恢复窗口：Wails 的 AppDelegate
// 未实现 applicationShouldHandleReopen:hasVisibleWindows:。
// 此函数通过 class_addMethod 动态注入该方法。
func SetupDockReopenHandler(callback func()) {
	dockReopenFunc = callback
	C.setupReopenHandler()
}
