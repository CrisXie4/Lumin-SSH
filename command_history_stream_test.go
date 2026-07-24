package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"testing"
)

func TestCommandHistoryStreamNormalMarker(t *testing.T) {
	s := newCommandHistoryStream()
	payload := []byte(base64.StdEncoding.EncodeToString([]byte("echo hello")))
	chunk := append(append([]byte{}, historyMarkerStart...), payload...)
	chunk = append(chunk, historyMarkerEnd)
	chunk = append([]byte("before"), chunk...)
	chunk = append(chunk, []byte("after")...)

	out, commands, _, promptSeen := s.Process(chunk)
	if !promptSeen {
		t.Fatal("expected promptSeen")
	}
	if string(out) != "beforeafter" {
		t.Fatalf("visible output = %q", out)
	}
	if len(commands) != 1 || commands[0] != "echo hello" {
		t.Fatalf("commands = %#v", commands)
	}
	if s.inMarker || len(s.payloadCarry) != 0 {
		t.Fatalf("marker state not reset: inMarker=%v payload=%d", s.inMarker, len(s.payloadCarry))
	}
}

func TestCommandHistoryStreamPayloadCap(t *testing.T) {
	s := newCommandHistoryStream()
	// 打开 marker 后灌入超过上限的无结束字节数据
	open := append([]byte(nil), historyMarkerStart...)
	if out, _, _, _ := s.Process(open); len(out) != 0 {
		t.Fatalf("open marker should hide payload, got %q", out)
	}
	if !s.inMarker {
		t.Fatal("expected inMarker after open")
	}

	// 第一批未超限
	mid := bytes.Repeat([]byte("A"), historyMarkerPayloadMax/2)
	if out, _, _, _ := s.Process(mid); len(out) != 0 {
		t.Fatalf("mid payload should stay hidden, got %d bytes", len(out))
	}
	if len(s.payloadCarry) != len(mid) {
		t.Fatalf("payloadCarry = %d want %d", len(s.payloadCarry), len(mid))
	}

	// 再来一批顶破上限：应丢弃 marker，剩余字节透传
	overflow := bytes.Repeat([]byte("B"), historyMarkerPayloadMax)
	out, commands, _, promptSeen := s.Process(overflow)
	if promptSeen {
		t.Fatal("overflow should not count as prompt")
	}
	if len(commands) != 0 {
		t.Fatalf("commands should be empty, got %#v", commands)
	}
	if s.inMarker || len(s.payloadCarry) != 0 {
		t.Fatalf("marker state should reset after cap, inMarker=%v payload=%d", s.inMarker, len(s.payloadCarry))
	}
	if !bytes.Equal(out, overflow) {
		t.Fatalf("overflow bytes should pass through, got %d want %d", len(out), len(overflow))
	}

	// 后续正常输出不受影响
	out, _, _, _ = s.Process([]byte("ok"))
	if string(out) != "ok" {
		t.Fatalf("after reset visible = %q", out)
	}
}

func TestReleaseCompressedUploadSlotRemovesIdleLimiter(t *testing.T) {
	sessionID := "slot-leak-test"
	compressedUploadSlots.Delete(sessionID)

	limiter, err := acquireCompressedUploadSlot(sessionID, 1, context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := compressedUploadSlots.Load(sessionID); !ok {
		t.Fatal("limiter should be stored while active")
	}
	releaseCompressedUploadSlot(sessionID, limiter)
	if _, ok := compressedUploadSlots.Load(sessionID); ok {
		t.Fatal("idle limiter should be deleted from map")
	}
}
