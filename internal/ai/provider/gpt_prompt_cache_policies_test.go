package provider

import (
	"reflect"
	"testing"
)

func TestGetResponsesPromptCachePolicy(t *testing.T) {
	tests := []struct {
		modelID            string
		format             string
		supportedDurations []string
		defaultDuration    string
	}{
		{"gpt-5.6-sol", ResponsesPromptCacheFormatOptions, []string{"30m"}, "30m"},
		{"gpt-5.6-terra", ResponsesPromptCacheFormatOptions, []string{"30m"}, "30m"},
		{"gpt-5.6-luna", ResponsesPromptCacheFormatOptions, []string{"30m"}, "30m"},
		{"gpt-5.5", ResponsesPromptCacheFormatRetention, []string{"24h"}, "24h"},
		{"gpt-5.4-mini", ResponsesPromptCacheFormatRetention, []string{"in_memory", "24h"}, ""},
		{"gpt-5.2", ResponsesPromptCacheFormatRetention, []string{"in_memory", "24h"}, ""},
		{"gpt-5.1-codex", ResponsesPromptCacheFormatRetention, []string{"in_memory", "24h"}, ""},
		{"gpt-5", ResponsesPromptCacheFormatRetention, []string{"in_memory", "24h"}, ""},
		{"gpt-4.1-mini", ResponsesPromptCacheFormatRetention, []string{"in_memory", "24h"}, ""},
	}
	for _, test := range tests {
		policy := GetResponsesPromptCachePolicy(test.modelID)
		if !policy.Known || policy.Format != test.format || policy.DefaultDuration != test.defaultDuration || !reflect.DeepEqual(policy.SupportedDurations, test.supportedDurations) {
			t.Fatalf("%s: %+v", test.modelID, policy)
		}
	}
	if policy := GetResponsesPromptCachePolicy("gpt-4o"); policy.Known || policy.Format != "" || len(policy.SupportedDurations) != 0 {
		t.Fatalf("unexpected unsupported policy: %+v", policy)
	}
}

func TestResolveResponsesPromptCacheSelection(t *testing.T) {
	tests := []struct {
		profile         Profile
		format          string
		duration        string
		useModelDefault bool
	}{
		{Profile{Provider: "Responses", Model: "gpt-5.6-terra", CacheStrategy: "model", OpenAIResponsesUsePromptCacheRetention: true}, ResponsesPromptCacheFormatOptions, "30m", false},
		{Profile{Provider: "Responses", Model: "gpt-5.5", CacheStrategy: "model"}, ResponsesPromptCacheFormatRetention, "24h", false},
		{Profile{Provider: "Responses", Model: "gpt-5.4-mini", CacheStrategy: "model"}, "", "", true},
		{Profile{Provider: "Responses", Model: "gpt-5.5", CacheStrategy: "30m"}, ResponsesPromptCacheFormatOptions, "30m", false},
		{Profile{Provider: "Responses", Model: "gpt-5.6-sol", CacheStrategy: "24h", OpenAIResponsesUsePromptCacheRetention: true}, ResponsesPromptCacheFormatRetention, "24h", false},
	}
	for _, test := range tests {
		selection := ResolveResponsesPromptCacheSelection(test.profile)
		if selection.Format != test.format || selection.Duration != test.duration || selection.UseModelDefault != test.useModelDefault {
			t.Fatalf("%+v: %+v", test.profile, selection)
		}
	}
}

func TestApplyResponsesPromptCacheSelection(t *testing.T) {
	tests := []struct {
		selection ResponsesPromptCacheSelection
		expected  map[string]any
	}{
		{ResponsesPromptCacheSelection{}, map[string]any{}},
		{ResponsesPromptCacheSelection{UseModelDefault: true}, map[string]any{}},
		{ResponsesPromptCacheSelection{Format: ResponsesPromptCacheFormatOptions, Duration: "30m"}, map[string]any{"prompt_cache_options": map[string]any{"ttl": "30m"}}},
		{ResponsesPromptCacheSelection{Format: ResponsesPromptCacheFormatRetention, Duration: "in_memory"}, map[string]any{"prompt_cache_retention": "in_memory"}},
	}
	for _, test := range tests {
		requestBody := map[string]any{}
		ApplyResponsesPromptCacheSelection(requestBody, test.selection)
		if !reflect.DeepEqual(requestBody, test.expected) {
			t.Fatalf("%+v: %+v", test.selection, requestBody)
		}
	}
}

func TestResponsesPromptCacheAvailableFormats(t *testing.T) {
	policy := GetResponsesPromptCachePolicy("gpt-5.6-terra")
	expected := []ResponsesPromptCacheFormatPolicy{
		{Format: ResponsesPromptCacheFormatOptions, Durations: []string{"30m"}},
		{Format: ResponsesPromptCacheFormatRetention, Durations: []string{"in_memory", "24h"}},
	}
	if !reflect.DeepEqual(policy.AvailableFormats, expected) {
		t.Fatalf("%+v", policy.AvailableFormats)
	}
}
