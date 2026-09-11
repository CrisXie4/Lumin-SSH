package provider

import (
	"reflect"
	"testing"
)

func TestNormalizeReasoningEffortMax(t *testing.T) {
	if got := normalizeReasoningEffort("max"); got != "max" {
		t.Fatalf("got %q", got)
	}
	expected := []string{"max", "xhigh"}
	if got := normalizeAIProviderModelReasoningEffortOptions([]string{"max", "xhigh", "max"}); !reflect.DeepEqual(got, expected) {
		t.Fatalf("got %#v", got)
	}
}

func TestGetModelContextWindow(t *testing.T) {
	cases := []struct {
		provider string
		modelID  string
		expected int
	}{
		{"Responses", "gpt-5.2", 400000},
		{"Compatible", "gpt-5-chat", 128000},
		{"Compatible", "gpt-5-chat-latest", 128000},
		{"Messages", "claude-sonnet-5", 200000},
		{"Compatible", "gemini-2.5-pro", 1000000},
		{"Compatible", "glm-4.6", 200000},
		{"Compatible", "kimi-k2-0905-preview", 262144},
		{"Compatible", "moonshot-v1-32k", 32768},
		{"Compatible", "minimax-m1", 1000000},
		{"Compatible", "MiniMax-M2", 200000},
		{"Compatible", "deepseek-chat", 131072},
		{"Compatible", "doubao-seed-1-6", 262144},
		{"Compatible", "doubao-1-5-pro-32k", 32768},
		{"Compatible", "qwen3-max", 262144},
		{"Compatible", "qwen-max", 131072},
		{"Compatible", "totally-unknown-model", DefaultAIModelContextWindow},
		{"Compatible", "", DefaultAIModelContextWindow},
	}
	for _, testCase := range cases {
		if got := GetModelContextWindow(testCase.provider, testCase.modelID); got != testCase.expected {
			t.Fatalf("GetModelContextWindow(%q, %q) = %d, want %d", testCase.provider, testCase.modelID, got, testCase.expected)
		}
	}
}
