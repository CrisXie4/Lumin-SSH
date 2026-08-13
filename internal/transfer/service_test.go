package transfer

import (
	"context"
	"testing"
	"time"
)

func TestNormalizeTuningDefaultsAndBounds(t *testing.T) {
	defaults := DefaultTuning()
	if defaults.MaxPacketKiB != defaultMaxPacketKiB || defaults.MaxRequestsPerFile != defaultMaxRequestsPerFile {
		t.Fatalf("unexpected defaults: %+v", defaults)
	}
	if !defaults.ConcurrentWrites || !defaults.ApplyToSharedClient {
		t.Fatalf("legacy defaults must enable concurrent and shared client tuning: %+v", defaults)
	}

	bounded := NormalizeTuning(Tuning{
		MaxPacketKiB:       4096,
		MaxRequestsPerFile: 4096,
		Configured:         true,
	})
	if bounded.MaxPacketKiB != maxMaxPacketKiB || bounded.MaxRequestsPerFile != maxMaxRequestsPerFile {
		t.Fatalf("settings were not bounded: %+v", bounded)
	}
	if WindowBoundedRequests(bounded) != 4 {
		t.Fatalf("window bounded requests = %d, want 4", WindowBoundedRequests(bounded))
	}
}

func TestServiceTuningIsInstanceScoped(t *testing.T) {
	first := NewService(nil, nil)
	second := NewService(nil, nil)
	first.SetTuning(Tuning{MaxPacketKiB: 256, MaxRequestsPerFile: 3, Configured: true})

	if got := first.Tuning().MaxPacketKiB; got != 256 {
		t.Fatalf("first service packet size = %d, want 256", got)
	}
	if got := second.Tuning().MaxPacketKiB; got != defaultMaxPacketKiB {
		t.Fatalf("second service inherited first settings: %d", got)
	}
}

func TestTaskRegistryDuplicateCancelAndHistoryLimit(t *testing.T) {
	registry := newTaskRegistry(2)
	cancelled := make(chan string, 3)
	register := func(id, sessionID string) {
		t.Helper()
		if err := registry.register(id, sessionID, "test", func() { cancelled <- id }); err != nil {
			t.Fatal(err)
		}
	}

	register("one", "session-a")
	if err := registry.register("one", "session-a", "test", nil); err == nil {
		t.Fatal("duplicate task id was accepted")
	}
	register("two", "session-a")
	register("three", "session-b")

	if got := registry.cancelSession("session-a"); got != 2 {
		t.Fatalf("cancelled %d tasks, want 2", got)
	}
	if registry.cancelTask("one") {
		t.Fatal("task cancellation was not idempotent")
	}
	if !registry.finish("three") || registry.finish("three") {
		t.Fatal("task completion was not idempotent")
	}

	if len(registry.history) != 2 {
		t.Fatalf("history length = %d, want 2", len(registry.history))
	}
	if len(registry.active) != 0 {
		t.Fatalf("active task count = %d, want 0", len(registry.active))
	}
	if len(cancelled) != 2 {
		t.Fatalf("cancel callback count = %d, want 2", len(cancelled))
	}
}

func TestServiceCloseCancelsOnlyOwnTasks(t *testing.T) {
	first := NewService(nil, nil)
	second := NewService(nil, nil)
	firstCancelled := false
	secondCancelled := false
	if err := first.registry.register("first", "session", "test", func() { firstCancelled = true }); err != nil {
		t.Fatal(err)
	}
	if err := second.registry.register("second", "session", "test", func() { secondCancelled = true }); err != nil {
		t.Fatal(err)
	}

	first.Close()
	if !firstCancelled {
		t.Fatal("first service did not cancel its task")
	}
	if secondCancelled {
		t.Fatal("first service cancelled another service task")
	}
	second.CancelSession("session")
	if !secondCancelled {
		t.Fatal("second service did not cancel its task")
	}
}

func TestDisconnectSessionClosesChunkPoolWithoutAcquire(t *testing.T) {
	service := NewService(nil, nil)
	pool := newSFTPUploadPool(nil, 1, DefaultTuning())
	pool.mu.Lock()
	pool.created = 1 // 模拟唯一 client 正被 worker 占用，Acquire 会等待。
	pool.mu.Unlock()
	service.chunkTasks["task"] = &chunkedUploadTask{
		sessionId: "session",
		pool:      pool,
		files:     make(map[string]*chunkedUploadFile),
	}

	done := make(chan struct{})
	go func() {
		service.DisconnectSession("session")
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("DisconnectSession 等待了 SFTP Acquire")
	}
	pool.mu.Lock()
	closed := pool.closed
	pool.mu.Unlock()
	if !closed || len(service.chunkTasks) != 0 {
		t.Fatalf("断线清理未关闭 pool: closed=%v tasks=%d", closed, len(service.chunkTasks))
	}
}

func TestTaskRegistryAcceptsContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	registry := newTaskRegistry(1)
	if err := registry.register("task", "session", "test", cancel); err != nil {
		t.Fatal(err)
	}
	registry.cancelSession("session")
	if ctx.Err() != context.Canceled {
		t.Fatalf("context state = %v, want canceled", ctx.Err())
	}
}
