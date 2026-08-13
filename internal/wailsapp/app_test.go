package wailsapp

import "testing"

func TestShutdownRunsOnce(t *testing.T) {
	calls := 0
	app := &App{
		onBeforeQuit: func() {
			calls++
		},
	}

	app.shutdown()
	app.shutdown()

	if calls != 1 {
		t.Fatalf("退出清理回调执行次数 = %d，期望 1", calls)
	}
}
