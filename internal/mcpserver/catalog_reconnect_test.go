package mcpserver

import (
	"context"
	"strings"
	"testing"
)

// mockDisconnectTracker/mockReconnectProvider 为断线重连流程的桩实现。
type mockDisconnectTracker struct {
	info DisconnectedSessionInfo
	dead bool
}

func (m *mockDisconnectTracker) LookupDisconnectedSession(sessionID string) (DisconnectedSessionInfo, bool) {
	return m.info, m.dead
}

type mockReconnectProvider struct {
	result ReconnectResult
	err    error
	called string
}

func (m *mockReconnectProvider) ReconnectDisconnectedSession(sessionID string) (ReconnectResult, error) {
	m.called = sessionID
	return m.result, m.err
}

// TestCheckSessionDisconnected 验证命中断连记录时返回指引 reconnect_server 的错误。
func TestCheckSessionDisconnected(t *testing.T) {
	catalog := NewCatalog(nil, nil, nil, nil)
	if err := catalog.checkSessionDisconnected("root"); err != nil {
		t.Fatalf("未注入 tracker 时不应拦截: %v", err)
	}
	catalog.SetDisconnectTracker(&mockDisconnectTracker{
		info: DisconnectedSessionInfo{SessionID: "root", ConnKey: "srv-1", Reason: "keepalive", ClosedAt: "2026-09-07T00:00:00Z"},
		dead: true,
	})
	err := catalog.checkSessionDisconnected("term_a")
	if err == nil {
		t.Fatal("命中断连记录时应返回错误")
	}
	for _, want := range []string{"reconnect_server", "term_a", "root"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("错误信息应包含 %q: %v", want, err)
		}
	}
	catalog.SetDisconnectTracker(&mockDisconnectTracker{dead: false})
	if err := catalog.checkSessionDisconnected("root"); err != nil {
		t.Fatalf("会话正常时不应拦截: %v", err)
	}
}

// TestReconnectServerToolLifecycle 验证 reconnect_server 仅在注入 provider 后下发,
// 且调用会透传 session_id。
func TestReconnectServerToolLifecycle(t *testing.T) {
	bare := NewCatalog(nil, nil, nil, nil)
	hasReconnectTool := false
	for _, definition := range bare.List() {
		if definition.Name == "reconnect_server" {
			hasReconnectTool = true
		}
	}
	if hasReconnectTool {
		t.Fatal("未注入 provider 时不应下发 reconnect_server")
	}
	if _, err := bare.CallWithContext(context.Background(), "reconnect_server", map[string]any{"session_id": "root"}); err == nil {
		t.Fatal("未注入 provider 时调用应报错")
	}

	provider := &mockReconnectProvider{result: ReconnectResult{SessionID: "root", TerminalCount: 1}}
	catalog := NewCatalog(nil, nil, nil, nil)
	catalog.SetReconnectProvider(provider)
	found := false
	for _, definition := range catalog.List() {
		if definition.Name == "reconnect_server" {
			found = true
		}
	}
	if !found {
		t.Fatal("注入 provider 后应下发 reconnect_server")
	}
	result, err := catalog.CallWithContext(context.Background(), "reconnect_server", map[string]any{"session_id": "root"})
	if err != nil {
		t.Fatalf("reconnect_server 调用失败: %v", err)
	}
	if provider.called != "root" {
		t.Fatalf("session_id 未透传: %q", provider.called)
	}
	if reconnectResult, ok := result.(ReconnectResult); !ok || reconnectResult.SessionID != "root" {
		t.Fatalf("意外的返回结果: %+v", result)
	}
}
