package sshmanager

import (
	"errors"
	"testing"
)

// TestRecordAndLookupDisconnectedSession 验证整机断开后记录可按父/子会话 id 查到。
func TestRecordAndLookupDisconnectedSession(t *testing.T) {
	manager := NewSSHManager()
	manager.recordDisconnectedConn("srv-1", []string{"root", "term_a", "term_b"}, "root", "keepalive")

	record, ok := manager.LookupDisconnectedSession("root")
	if !ok || record.ParentSessionId != "root" || record.ConnKey != "srv-1" || record.Reason != "keepalive" {
		t.Fatalf("按父会话 id 查询断连记录失败: ok=%v record=%+v", ok, record)
	}
	if record, ok = manager.LookupDisconnectedSession("term_b"); !ok || record.ParentSessionId != "root" {
		t.Fatalf("按子终端 id 查询断连记录失败: ok=%v record=%+v", ok, record)
	}
	if _, ok = manager.LookupDisconnectedSession("unknown"); ok {
		t.Fatal("未知会话不应命中断连记录")
	}
}

// TestLookupStaleRecordWhenReconnected 会话重连(如由前端完成)后,断连记录应视为失效。
func TestLookupStaleRecordWhenReconnected(t *testing.T) {
	manager := NewSSHManager()
	manager.recordDisconnectedConn("srv-1", []string{"root"}, "root", "transport")
	manager.mu.Lock()
	manager.sessions["root"] = &SessionData{ConnKey: "srv-1"}
	manager.mu.Unlock()

	if _, ok := manager.LookupDisconnectedSession("root"); ok {
		t.Fatal("会话已重连后不应再命中断连记录")
	}
	manager.mu.RLock()
	_, remains := manager.recentDisconnects["root"]
	manager.mu.RUnlock()
	if remains {
		t.Fatal("失效记录应被清理")
	}
}

// TestReconnectIdempotentForAliveSession 对仍在线的会话调用重连应幂等成功。
func TestReconnectIdempotentForAliveSession(t *testing.T) {
	manager := NewSSHManager()
	manager.mu.Lock()
	manager.sessions["root"] = &SessionData{ConnKey: "srv-1"}
	manager.clients["srv-1"] = &sshClientEntry{}
	manager.mu.Unlock()

	outcome, err := manager.ReconnectDisconnectedSession("root")
	if err != nil {
		t.Fatalf("在线会话重连应幂等成功: %v", err)
	}
	if !outcome.AlreadyConnected || outcome.SessionId != "root" {
		t.Fatalf("意外的幂等结果: %+v", outcome)
	}
}

// TestReconnectUnavailableWithoutRecord 无断连记录时返回哨兵错误。
func TestReconnectUnavailableWithoutRecord(t *testing.T) {
	manager := NewSSHManager()
	if _, err := manager.ReconnectDisconnectedSession("ghost"); !errors.Is(err, ErrReconnectUnavailable) {
		t.Fatalf("应返回 ErrReconnectUnavailable, 实际: %v", err)
	}
}

// TestDisconnectClearsRecord 用户主动断开后,断连记录与失败计数应被清除。
func TestDisconnectClearsRecord(t *testing.T) {
	manager := NewSSHManager()
	manager.recordDisconnectedConn("srv-1", []string{"root", "term_a"}, "root", "transport")
	manager.mu.Lock()
	manager.mcpReconnectFailures["root"] = 2
	manager.mu.Unlock()

	manager.Disconnect("term_a")

	if _, ok := manager.LookupDisconnectedSession("root"); ok {
		t.Fatal("主动断开后断连记录应被清除")
	}
	manager.mu.RLock()
	fails := manager.mcpReconnectFailures["root"]
	manager.mu.RUnlock()
	if fails != 0 {
		t.Fatalf("主动断开后失败计数应被清除, 实际: %d", fails)
	}
}

// TestRecordReplacesStaleRecordForSameSession 同一会话反复断开时只保留最新记录。
func TestRecordReplacesStaleRecordForSameSession(t *testing.T) {
	manager := NewSSHManager()
	manager.recordDisconnectedConn("srv-1", []string{"root", "term_a"}, "root", "transport")
	manager.recordDisconnectedConn("srv-1", []string{"root", "term_a", "term_b"}, "root", "keepalive")

	manager.mu.RLock()
	count := len(manager.recentDisconnects)
	record := manager.recentDisconnects["root"]
	manager.mu.RUnlock()
	if count != 1 {
		t.Fatalf("同一会话重复断开应只保留一条记录, 实际: %d", count)
	}
	if record == nil || len(record.SessionIds) != 3 || record.Reason != "keepalive" {
		t.Fatalf("应保留最新现场: %+v", record)
	}
}

// TestReconnectRecordsCapped 断连记录数量应受上限约束(FIFO 淘汰)。
func TestReconnectRecordsCapped(t *testing.T) {
	manager := NewSSHManager()
	for i := 0; i < mcpReconnectMaxRecords+5; i++ {
		parent := "parent-" + string(rune('a'+i%26)) + string(rune('0'+i/26))
		manager.recordDisconnectedConn("srv", []string{parent}, parent, "transport")
	}
	manager.mu.RLock()
	count := len(manager.recentDisconnects)
	manager.mu.RUnlock()
	if count > mcpReconnectMaxRecords {
		t.Fatalf("断连记录应不超过 %d 条, 实际: %d", mcpReconnectMaxRecords, count)
	}
}
