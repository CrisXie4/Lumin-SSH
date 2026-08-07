package provider

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

type Profile struct {
	Provider                string
	Model                   string
	BaseURL                 string
	APIKey                  string
	CacheStrategy                   string
	ReasoningEffort                 string
	EnableReasoningEffort           bool
	OpenAILegacyReasoningFormatEnabled bool
	ModelMaxTokens                  int
	ModelMaxThinkingTokens  int
}

type OpenAIResponsesCacheObject struct {
	ResponseID string
	Output     []map[string]any
	Include    []string
	Store      bool
	CapturedAt int64
}

type ProviderCacheObjects struct {
	OpenAIResponses *OpenAIResponsesCacheObject
}

type ChatMessage struct {
	Role         string
	Content      string
	Images       []string
	CacheObjects *ProviderCacheObjects
}

func normalizeStringList(values []string) []string {
	if values == nil {
		return []string{}
	}
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func CloneOpenAIResponsesOutputItems(items []map[string]any) []map[string]any {
	if len(items) == 0 {
		return []map[string]any{}
	}
	data, err := json.Marshal(items)
	if err != nil {
		cloned := make([]map[string]any, 0, len(items))
		for _, item := range items {
			if item == nil {
				continue
			}
			copied := make(map[string]any, len(item))
			for key, value := range item {
				copied[key] = value
			}
			cloned = append(cloned, copied)
		}
		return cloned
	}
	var cloned []map[string]any
	if err := json.Unmarshal(data, &cloned); err != nil {
		return []map[string]any{}
	}
	if cloned == nil {
		return []map[string]any{}
	}
	return cloned
}

func cloneAIProviderCacheObjects(cacheObjects *ProviderCacheObjects) *ProviderCacheObjects {
	if cacheObjects == nil {
		return nil
	}
	if cacheObjects.OpenAIResponses == nil {
		return nil
	}
	return &ProviderCacheObjects{
		OpenAIResponses: &OpenAIResponsesCacheObject{
			ResponseID: strings.TrimSpace(cacheObjects.OpenAIResponses.ResponseID),
			Output:     CloneOpenAIResponsesOutputItems(cacheObjects.OpenAIResponses.Output),
			Include:    normalizeStringList(cacheObjects.OpenAIResponses.Include),
			Store:      cacheObjects.OpenAIResponses.Store,
			CapturedAt: cacheObjects.OpenAIResponses.CapturedAt,
		},
	}
}

var (
	responsesPromptCacheGPTVersionPattern = regexp.MustCompile(`^gpt-(\d+)(?:\.(\d+))?`)
	responsesPromptCache24hOnlyPattern    = regexp.MustCompile(`^gpt-5\.5(?:$|[-.])`)
	responsesPromptCache24hCapablePatterns = []*regexp.Regexp{
		regexp.MustCompile(`^gpt-5\.4(?:$|[-.])`),
		regexp.MustCompile(`^gpt-5\.2(?:$|[-.])`),
		regexp.MustCompile(`^gpt-5\.1(?:$|[-.])`),
		regexp.MustCompile(`^gpt-5-codex(?:$|[-.])`),
		regexp.MustCompile(`^gpt-5(?:$|-20\d{2}-\d{2}-\d{2})`),
		regexp.MustCompile(`^gpt-4\.1(?:$|[-.])`),
	}
)

func normalizeCacheStrategy(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "off":
		return "off"
	case "model":
		return "model"
	case "5m":
		return "5m"
	case "1h":
		return "1h"
	case "30m":
		return "30m"
	case "in_memory":
		return "in_memory"
	case "24h":
		return "24h"
	default:
		return "model"
	}
}

func normalizeResponsesPromptCacheModelID(modelID string) string {
	return strings.ToLower(strings.TrimSpace(modelID))
}

func supportsResponsesPromptCacheTTL(modelID string) bool {
	normalizedModelID := normalizeResponsesPromptCacheModelID(modelID)
	matches := responsesPromptCacheGPTVersionPattern.FindStringSubmatch(normalizedModelID)
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
	return majorVersion > 5 || (majorVersion == 5 && minorVersion >= 6)
}

func supportsResponsesExtendedPromptCacheRetention(modelID string, capability AIProviderModelCapability) bool {
	if strings.EqualFold(strings.TrimSpace(capability.PromptCacheRetention), "24h") {
		return true
	}
	normalizedModelID := normalizeResponsesPromptCacheModelID(modelID)
	for _, pattern := range responsesPromptCache24hCapablePatterns {
		if pattern.MatchString(normalizedModelID) {
			return true
		}
	}
	return false
}

func GetResponsesPromptCacheStrategyOptions(modelID string, capability AIProviderModelCapability) []string {
	normalizedModelID := normalizeResponsesPromptCacheModelID(modelID)
	if normalizedModelID == "" {
		return []string{"off", "model"}
	}
	if supportsResponsesPromptCacheTTL(normalizedModelID) {
		return []string{"off", "model", "30m"}
	}
	if responsesPromptCache24hOnlyPattern.MatchString(normalizedModelID) {
		return []string{"off", "model", "24h"}
	}
	supportsExtendedRetention := supportsResponsesExtendedPromptCacheRetention(normalizedModelID, capability)
	if !capability.SupportsPromptCache && !supportsExtendedRetention {
		return []string{"off", "model"}
	}
	options := []string{"off", "model", "in_memory"}
	if supportsExtendedRetention {
		options = append(options, "24h")
	}
	return options
}

func containsCacheStrategyOption(options []string, target string) bool {
	normalizedTarget := strings.TrimSpace(target)
	for _, option := range options {
		if option == normalizedTarget {
			return true
		}
	}
	return false
}

func ResolveResponsesPromptCacheStrategy(profile Profile, capability AIProviderModelCapability) string {
	if !providerSupportsAIQuickEditPromptCache(profile.Provider) {
		return "off"
	}
	modelID := strings.TrimSpace(profile.Model)
	if modelID == "" {
		modelID = capability.ModelID
	}
	availableOptions := GetResponsesPromptCacheStrategyOptions(modelID, capability)
	selectedStrategy := normalizeCacheStrategy(profile.CacheStrategy)
	if selectedStrategy != "model" && containsCacheStrategyOption(availableOptions, selectedStrategy) {
		return selectedStrategy
	}
	normalizedModelID := normalizeResponsesPromptCacheModelID(modelID)
	if supportsResponsesPromptCacheTTL(normalizedModelID) {
		return "30m"
	}
	if responsesPromptCache24hOnlyPattern.MatchString(normalizedModelID) {
		return "24h"
	}
	if supportsResponsesExtendedPromptCacheRetention(normalizedModelID, capability) {
		return "24h"
	}
	if capability.SupportsPromptCache {
		return "in_memory"
	}
	return "off"
}

const (
	defaultAIProviderMaxOutputTokens   = 16384
	defaultAIProviderMaxThinkingTokens = 8192
)

func containsAIProviderReasoningEffort(options []string, value string) bool {
	normalizedValue := strings.ToLower(strings.TrimSpace(value))
	if normalizedValue == "" {
		return false
	}
	for _, option := range normalizeAIProviderModelReasoningEffortOptions(options) {
		if option == normalizedValue {
			return true
		}
	}
	return false
}

func supportsAIProviderFallbackReasoningEffort(provider string) bool {
	switch normalizeProviderProtocol(provider) {
	case "Compatible", "Responses", "Messages":
		return true
	default:
		return false
	}
}

func ResolvePromptCacheStrategy(profile Profile, capability AIProviderModelCapability) string {
	if !providerSupportsAIQuickEditPromptCache(profile.Provider) {
		return "off"
	}
	switch normalizeCacheStrategy(profile.CacheStrategy) {
	case "off":
		return "off"
	case "5m":
		return "5m"
	case "1h":
		return "1h"
	default:
		if capability.SupportsPromptCache {
			return "5m"
		}
		return "off"
	}
}

func BuildResponsesPromptCacheKey(conversationID string, promptCacheBypassTimestamp string, systemPrompt string) string {
	trimmedConversationID := strings.TrimSpace(conversationID)
	if trimmedConversationID == "" {
		return ""
	}
	bypassSource := strings.TrimSpace(promptCacheBypassTimestamp)
	if bypassSource == "" {
		bypassSource = "stable"
	}
	trimmedSystemPrompt := strings.TrimSpace(systemPrompt)
	checksum := sha256.Sum256([]byte(bypassSource + "\n" + trimmedSystemPrompt))
	bypassHash := hex.EncodeToString(checksum[:])[:12]
	cacheKey := "LuminSSH:resp:v2:" + trimmedConversationID + ":" + bypassHash
	if len(cacheKey) > 64 {
		return cacheKey[len(cacheKey)-64:]
	}
	return cacheKey
}

func getAIProviderOpenAIPromptCacheControl(strategy string) map[string]any {
	switch strings.ToLower(strings.TrimSpace(strategy)) {
	case "1h":
		return map[string]any{
			"type": "ephemeral",
			"ttl":  "1h",
		}
	case "5m":
		return map[string]any{
			"type": "ephemeral",
		}
	default:
		return nil
	}
}

func buildAIProviderOpenAIImageContentParts(images []string) []map[string]any {
	parts := make([]map[string]any, 0, len(images))
	for _, image := range normalizeStringList(images) {
		if image == "" {
			continue
		}
		parts = append(parts, map[string]any{
			"type": "image_url",
			"image_url": map[string]any{
				"url": image,
			},
		})
	}
	return parts
}

func buildAIProviderOpenAIUserContent(message ChatMessage, cacheControl map[string]any) []map[string]any {
	parts := make([]map[string]any, 0, len(message.Images)+1)
	if text := strings.TrimSpace(message.Content); text != "" {
		textBlock := map[string]any{
			"type": "text",
			"text": text,
		}
		if cacheControl != nil {
			textBlock["cache_control"] = cacheControl
		}
		parts = append(parts, textBlock)
	}
	return append(parts, buildAIProviderOpenAIImageContentParts(message.Images)...)
}

func BuildOpenAIChatMessages(systemPrompt string, requestMessages []ChatMessage, promptCacheStrategy string) []map[string]any {
	cacheControl := getAIProviderOpenAIPromptCacheControl(promptCacheStrategy)
	systemMessage := map[string]any{
		"role":    "system",
		"content": systemPrompt,
	}
	if cacheControl != nil {
		systemMessage["content"] = []map[string]any{
			{
				"type":          "text",
				"text":          systemPrompt,
				"cache_control": cacheControl,
			},
		}
	}

	userIndexes := make([]int, 0, len(requestMessages))
	for index, message := range requestMessages {
		if strings.EqualFold(strings.TrimSpace(message.Role), "user") {
			userIndexes = append(userIndexes, index)
		}
	}
	if len(userIndexes) > 2 {
		userIndexes = userIndexes[len(userIndexes)-2:]
	}
	cacheIndexes := make(map[int]struct{}, len(userIndexes))
	for _, index := range userIndexes {
		cacheIndexes[index] = struct{}{}
	}

	messages := make([]map[string]any, 0, len(requestMessages)+1)
	messages = append(messages, systemMessage)
	for index, message := range requestMessages {
		role := strings.ToLower(strings.TrimSpace(message.Role))
		if role != "system" && role != "user" && role != "assistant" {
			continue
		}
		if role == "user" {
			var textCacheControl map[string]any
			if cacheControl != nil {
				if _, ok := cacheIndexes[index]; ok {
					textCacheControl = cacheControl
				}
			}
			messageImages := normalizeStringList(message.Images)
			contentParts := buildAIProviderOpenAIUserContent(ChatMessage{
				Role:    message.Role,
				Content: message.Content,
				Images:  messageImages,
			}, textCacheControl)
			if len(contentParts) == 0 {
				continue
			}
			if len(messageImages) == 0 && textCacheControl == nil {
				messages = append(messages, map[string]any{
					"role":    "user",
					"content": strings.TrimSpace(message.Content),
				})
			} else {
				messages = append(messages, map[string]any{
					"role":    "user",
					"content": contentParts,
				})
			}
			continue
		}
		messages = append(messages, map[string]any{
			"role":    role,
			"content": strings.TrimSpace(message.Content),
		})
	}
	return messages
}

func ParseBase64DataURL(dataURL string) (string, string, bool) {
	trimmed := strings.TrimSpace(dataURL)
	if !strings.HasPrefix(trimmed, "data:") {
		return "", "", false
	}
	body := strings.TrimPrefix(trimmed, "data:")
	parts := strings.SplitN(body, ";base64,", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	mediaType := strings.TrimSpace(parts[0])
	base64Data := strings.TrimSpace(parts[1])
	if mediaType == "" || base64Data == "" {
		return "", "", false
	}
	return mediaType, base64Data, true
}

func buildAIProviderResponsesImageContentParts(images []string) []map[string]any {
	parts := make([]map[string]any, 0, len(images))
	for _, image := range normalizeStringList(images) {
		if image == "" {
			continue
		}
		parts = append(parts, map[string]any{
			"type":      "input_image",
			"image_url": image,
		})
	}
	return parts
}

func BuildResponsesInputMessages(requestMessages []ChatMessage) []map[string]any {
	input := make([]map[string]any, 0, len(requestMessages))
	for _, message := range requestMessages {
		role := strings.ToLower(strings.TrimSpace(message.Role))
		switch role {
		case "assistant":
			cacheObjects := cloneAIProviderCacheObjects(message.CacheObjects)
			if cacheObjects != nil && cacheObjects.OpenAIResponses != nil && len(cacheObjects.OpenAIResponses.Output) > 0 {
				input = append(input, cacheObjects.OpenAIResponses.Output...)
				continue
			}
			input = append(input, map[string]any{
				"role": "assistant",
				"content": []map[string]any{
					{
						"type": "output_text",
						"text": message.Content,
					},
				},
			})
		case "user":
			contentParts := make([]map[string]any, 0, len(message.Images)+1)
			if text := strings.TrimSpace(message.Content); text != "" {
				contentParts = append(contentParts, map[string]any{
					"type": "input_text",
					"text": text,
				})
			}
			contentParts = append(contentParts, buildAIProviderResponsesImageContentParts(message.Images)...)
			if len(contentParts) == 0 {
				continue
			}
			input = append(input, map[string]any{
				"role":    "user",
				"content": contentParts,
			})
		}
	}
	return input
}

func NormalizeMessagesBaseURL(baseURL string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return ""
	}
	trimmed = strings.TrimRight(trimmed, "/")
	trimmed = strings.TrimSuffix(trimmed, "/v1/messages")
	trimmed = strings.TrimSuffix(trimmed, "/v1")
	return strings.TrimRight(trimmed, "/")
}

func GetAnthropicPromptCacheControl(strategy string) map[string]any {
	switch strings.ToLower(strings.TrimSpace(strategy)) {
	case "1h":
		return map[string]any{
			"type": "ephemeral",
			"ttl":  "1h",
		}
	case "5m":
		return map[string]any{
			"type": "ephemeral",
		}
	default:
		return nil
	}
}

func buildAIProviderAnthropicImageContentParts(images []string) []map[string]any {
	parts := make([]map[string]any, 0, len(images))
	for _, image := range normalizeStringList(images) {
		mediaType, base64Data, ok := ParseBase64DataURL(image)
		if !ok {
			continue
		}
		parts = append(parts, map[string]any{
			"type": "image",
			"source": map[string]any{
				"type":       "base64",
				"media_type": mediaType,
				"data":       base64Data,
			},
		})
	}
	return parts
}

func BuildAnthropicMessages(requestMessages []ChatMessage, promptCacheStrategy string) []map[string]any {
	cacheControl := GetAnthropicPromptCacheControl(promptCacheStrategy)
	userIndexes := make([]int, 0, len(requestMessages))
	for index, message := range requestMessages {
		if strings.EqualFold(strings.TrimSpace(message.Role), "user") {
			userIndexes = append(userIndexes, index)
		}
	}
	if len(userIndexes) > 2 {
		userIndexes = userIndexes[len(userIndexes)-2:]
	}
	cacheIndexes := make(map[int]struct{}, len(userIndexes))
	for _, index := range userIndexes {
		cacheIndexes[index] = struct{}{}
	}

	messages := make([]map[string]any, 0, len(requestMessages))
	for index, message := range requestMessages {
		role := strings.ToLower(strings.TrimSpace(message.Role))
		if role != "user" && role != "assistant" {
			continue
		}
		if role == "assistant" {
			messages = append(messages, map[string]any{
				"role":    "assistant",
				"content": strings.TrimSpace(message.Content),
			})
			continue
		}
		var textCacheControl map[string]any
		if cacheControl != nil {
			if _, ok := cacheIndexes[index]; ok {
				textCacheControl = cacheControl
			}
		}
		messageImages := normalizeStringList(message.Images)
		contentParts := make([]map[string]any, 0, len(messageImages)+1)
		if text := strings.TrimSpace(message.Content); text != "" {
			textBlock := map[string]any{
				"type": "text",
				"text": text,
			}
			if textCacheControl != nil {
				textBlock["cache_control"] = textCacheControl
			}
			contentParts = append(contentParts, textBlock)
		}
		contentParts = append(contentParts, buildAIProviderAnthropicImageContentParts(messageImages)...)
		if len(contentParts) == 0 {
			continue
		}
		if len(messageImages) == 0 && textCacheControl == nil {
			messages = append(messages, map[string]any{
				"role":    "user",
				"content": strings.TrimSpace(message.Content),
			})
		} else {
			messages = append(messages, map[string]any{
				"role":    "user",
				"content": contentParts,
			})
		}
	}
	return messages
}

func GetEffectiveReasoningEffort(profile Profile, capability AIProviderModelCapability) string {
	defaultEffort := normalizeReasoningEffort(capability.ReasoningEffort)
	requestedEffort := normalizeReasoningEffort(profile.ReasoningEffort)

	if capability.ReasoningMode != AIProviderReasoningModeEffort {
		if !supportsAIProviderFallbackReasoningEffort(profile.Provider) || !profile.EnableReasoningEffort {
			return ""
		}
		if requestedEffort == "" {
			requestedEffort = defaultEffort
		}
		if requestedEffort == "" || requestedEffort == "disable" {
			return ""
		}
		return requestedEffort
	}

	supportedEfforts := normalizeAIProviderModelReasoningEffortOptions(capability.SupportsReasoningEffort)

	if capability.RequiredReasoningEffort {
		if requestedEffort != "" && requestedEffort != "disable" && (len(supportedEfforts) == 0 || containsAIProviderReasoningEffort(supportedEfforts, requestedEffort)) {
			return requestedEffort
		}
		if defaultEffort != "" && defaultEffort != "disable" && (len(supportedEfforts) == 0 || containsAIProviderReasoningEffort(supportedEfforts, defaultEffort)) {
			return defaultEffort
		}
		if len(supportedEfforts) > 0 {
			return supportedEfforts[0]
		}
		return ""
	}

	if !profile.EnableReasoningEffort {
		return ""
	}

	if requestedEffort == "" {
		requestedEffort = defaultEffort
	}
	if requestedEffort == "" || requestedEffort == "disable" {
		return ""
	}
	if len(supportedEfforts) == 0 || containsAIProviderReasoningEffort(supportedEfforts, requestedEffort) {
		return requestedEffort
	}
	if defaultEffort != "" && defaultEffort != "disable" {
		return defaultEffort
	}
	return ""
}

func ShouldUseBinaryReasoning(profile Profile, capability AIProviderModelCapability) bool {
	if capability.ReasoningMode != AIProviderReasoningModeBinary {
		return false
	}
	if capability.RequiredReasoningEffort {
		return true
	}
	return profile.EnableReasoningEffort
}

func ShouldUseReasoningBudget(profile Profile, capability AIProviderModelCapability) bool {
	if capability.ReasoningMode != AIProviderReasoningModeBudget {
		return false
	}
	if capability.RequiredReasoningBudget {
		return true
	}
	return profile.EnableReasoningEffort
}

func ResolveMaxOutputTokens(profile Profile, capability AIProviderModelCapability) int {
	if profile.ModelMaxTokens > 0 {
		return profile.ModelMaxTokens
	}
	if capability.MaxTokens > 0 {
		return capability.MaxTokens
	}
	return defaultAIProviderMaxOutputTokens
}

func ResolveMaxThinkingTokens(profile Profile, capability AIProviderModelCapability, maxOutputTokens int) int {
	maxThinkingTokens := profile.ModelMaxThinkingTokens
	if maxThinkingTokens <= 0 {
		maxThinkingTokens = capability.MaxThinkingTokens
	}
	if maxThinkingTokens <= 0 {
		maxThinkingTokens = defaultAIProviderMaxThinkingTokens
	}
	limit := int(float64(maxOutputTokens) * 0.8)
	if limit > 0 && maxThinkingTokens > limit {
		maxThinkingTokens = limit
	}
	if maxThinkingTokens <= 0 {
		maxThinkingTokens = defaultAIProviderMaxThinkingTokens
	}
	return maxThinkingTokens
}