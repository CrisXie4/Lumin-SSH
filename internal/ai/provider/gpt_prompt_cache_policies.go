package provider

import (
	"regexp"
	"strconv"
	"strings"
)

const (
	ResponsesPromptCacheFormatOptions   = "prompt_cache_options"
	ResponsesPromptCacheFormatRetention = "prompt_cache_retention"
)

type ResponsesPromptCacheFormatPolicy struct {
	Format    string   `json:"format"`
	Durations []string `json:"durations"`
}

type ResponsesPromptCachePolicy struct {
	ModelID            string                             `json:"modelId"`
	Known              bool                               `json:"known"`
	Format             string                             `json:"format,omitempty"`
	SupportedDurations []string                           `json:"supportedDurations"`
	DefaultDuration    string                             `json:"defaultDuration,omitempty"`
	AvailableFormats   []ResponsesPromptCacheFormatPolicy `json:"availableFormats"`
}

type responsesPromptCachePolicyRule struct {
	MatchPrefix        string
	MinimumMajor       int
	MinimumMinor       int
	Format             string
	SupportedDurations []string
	DefaultDuration    string
}

var (
	responsesPromptCacheAvailableFormats = []ResponsesPromptCacheFormatPolicy{
		{
			Format:    ResponsesPromptCacheFormatOptions,
			Durations: []string{"30m", "24h"},
		},
		{
			Format:    ResponsesPromptCacheFormatRetention,
			Durations: []string{"in_memory", "24h"},
		},
	}
	gptResponsesPromptCacheVersionPattern = regexp.MustCompile(`^gpt-(\d+)(?:\.(\d+))?`)
	gptResponsesPromptCachePolicyRules    = []responsesPromptCachePolicyRule{
		{
			MinimumMajor:       5,
			MinimumMinor:       6,
			Format:             ResponsesPromptCacheFormatOptions,
			SupportedDurations: []string{"30m", "24h"},
			DefaultDuration:    "30m",
		},
		{
			MatchPrefix:        "gpt-5.5",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"24h"},
			DefaultDuration:    "24h",
		},
		{
			MatchPrefix:        "gpt-5.4",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
		{
			MatchPrefix:        "gpt-5.2",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
		{
			MatchPrefix:        "gpt-5.1",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
		{
			MatchPrefix:        "gpt-5-codex",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
		{
			MatchPrefix:        "gpt-5",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
		{
			MatchPrefix:        "gpt-4.1",
			Format:             ResponsesPromptCacheFormatRetention,
			SupportedDurations: []string{"in_memory", "24h"},
			DefaultDuration:    "",
		},
	}
)

func (rule responsesPromptCachePolicyRule) matches(modelID string) bool {
	if rule.MinimumMajor > 0 {
		matches := gptResponsesPromptCacheVersionPattern.FindStringSubmatch(modelID)
		if len(matches) < 2 {
			return false
		}
		majorVersion, err := strconv.Atoi(matches[1])
		if err != nil {
			return false
		}
		minorVersion := 0
		if len(matches) > 2 && strings.TrimSpace(matches[2]) != "" {
			minorVersion, err = strconv.Atoi(matches[2])
			if err != nil {
				return false
			}
		}
		return majorVersion > rule.MinimumMajor || (majorVersion == rule.MinimumMajor && minorVersion >= rule.MinimumMinor)
	}
	return rule.MatchPrefix != "" && strings.HasPrefix(modelID, rule.MatchPrefix)
}

func cloneResponsesPromptCacheFormatPolicies(values []ResponsesPromptCacheFormatPolicy) []ResponsesPromptCacheFormatPolicy {
	cloned := make([]ResponsesPromptCacheFormatPolicy, 0, len(values))
	for _, value := range values {
		cloned = append(cloned, ResponsesPromptCacheFormatPolicy{
			Format:    value.Format,
			Durations: append([]string{}, value.Durations...),
		})
	}
	return cloned
}

func GetResponsesPromptCachePolicy(modelID string) ResponsesPromptCachePolicy {
	trimmedModelID := strings.TrimSpace(modelID)
	policy := ResponsesPromptCachePolicy{
		ModelID:            trimmedModelID,
		SupportedDurations: []string{},
		AvailableFormats:   cloneResponsesPromptCacheFormatPolicies(responsesPromptCacheAvailableFormats),
	}
	normalizedModelID := strings.ToLower(trimmedModelID)
	if !strings.HasPrefix(normalizedModelID, "gpt-") {
		return policy
	}
	for _, rule := range gptResponsesPromptCachePolicyRules {
		if !rule.matches(normalizedModelID) {
			continue
		}
		policy.Known = true
		policy.Format = rule.Format
		policy.SupportedDurations = append([]string{}, rule.SupportedDurations...)
		policy.DefaultDuration = rule.DefaultDuration
		return policy
	}
	return policy
}
