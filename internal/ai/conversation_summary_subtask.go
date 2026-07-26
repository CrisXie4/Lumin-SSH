package ai

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
)

const aiConversationRelationTypePhase = "phase"
const aiConversationRelationTypeAgent = "agent"
const aiConversationRelationSourceSummaryCondense = "summary_condense"

var aiConversationSubtaskTitleBlockPattern = regexp.MustCompile(`(?is)<subtask_title>\s*(.*?)\s*</subtask_title>`)
var aiConversationSubtaskSummaryBlockPattern = regexp.MustCompile(`(?is)<subtask_summary>\s*(.*?)\s*</subtask_summary>`)

type aiConversationCompressedSeed struct {
	APIMessages       []AIConversationAPIMessage
	PrevContextTokens int
	NewContextTokens  int
}

type aiConversationSummarySubtaskOutput struct {
	Title   string
	Summary string
}

func normalizeAIConversationRelationType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case aiConversationRelationTypePhase:
		return aiConversationRelationTypePhase
	case aiConversationRelationTypeAgent:
		return aiConversationRelationTypeAgent
	default:
		return ""
	}
}

func normalizeAIConversationRelationSource(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func buildAIConversationSummarySubtaskPrompt() string {
	templateText := readAIEmbeddedTemplate("context_condense")
	if strings.TrimSpace(templateText) == "" {
		return ""
	}
	return strings.TrimSpace(renderPromptBuilderTemplate(templateText, map[string]string{
		"DETAILED_ANALYSIS_INSTRUCTION_BASE": "Return only two XML blocks in this exact order: <subtask_title>...</subtask_title> then <subtask_summary>...</subtask_summary>. Do not include the <analysis> block. The <subtask_title> block must be a concise task title suitable for naming a new conversation. The <subtask_summary> block must contain the detailed summary body.",
	}))
}

func extractAIConversationSummarySubtaskOutput(value string) aiConversationSummarySubtaskOutput {
	trimmedValue := strings.TrimSpace(value)
	if trimmedValue == "" {
		return aiConversationSummarySubtaskOutput{}
	}
	title := ""
	titleMatches := aiConversationSubtaskTitleBlockPattern.FindStringSubmatch(trimmedValue)
	if len(titleMatches) == 2 {
		title = strings.TrimSpace(titleMatches[1])
	}
	summary := ""
	summaryMatches := aiConversationSubtaskSummaryBlockPattern.FindStringSubmatch(trimmedValue)
	if len(summaryMatches) == 2 {
		summary = strings.TrimSpace(summaryMatches[1])
	} else {
		summary = trimmedValue
	}
	return aiConversationSummarySubtaskOutput{
		Title:   title,
		Summary: summary,
	}
}

func buildAIConversationSummarySubtaskTitle(title string) string {
	normalizedTitle := strings.Join(strings.Fields(strings.TrimSpace(title)), " ")
	if normalizedTitle == "" {
		return "新对话"
	}
	titleRunes := []rune(normalizedTitle)
	if len(titleRunes) > 24 {
		return string(titleRunes[:24]) + "..."
	}
	return normalizedTitle
}

func buildAIConversationSummarySeedSystemContent(summary string) string {
	trimmedSummary := strings.TrimSpace(summary)
	if trimmedSummary == "" {
		return ""
	}
	return "<user_message>\n" + trimmedSummary + "\n</user_message>"
}

func buildAIConversationSummarySubtaskUIMessage(parentSnapshot AIConversationSnapshot, summary string, prevContextTokens int, newContextTokens int) AIConversationMessage {
	now := time.Now()
	messageID := fmt.Sprintf("summary-subtask-%d", now.UnixNano())
	return AIConversationMessage{
		ID:     messageID,
		TurnID: messageID,
		Kind:   "condense_context",
		Text:   strings.TrimSpace(summary),
		Time:   now.Format("15:04"),
		Extra: map[string]interface{}{
			"derivedSubtask":       true,
			"parentConversationId": strings.TrimSpace(parentSnapshot.ID),
			"parentTitleSnapshot":  strings.TrimSpace(parentSnapshot.Title),
			"prevContextTokens":    prevContextTokens,
			"newContextTokens":     newContextTokens,
		},
	}
}

func (a *App) buildAIConversationCompressedSeed(snapshot AIConversationSnapshot, sessionID string) (aiConversationCompressedSeed, error) {
	apiMessages := normalizeAIConversationAPIMessages(snapshot.APIMessages)
	if len(apiMessages) <= 2 {
		return aiConversationCompressedSeed{}, fmt.Errorf("当前消息不足，无法压缩上下文")
	}
	profile := AIProviderProfile{}
	if resolvedProfile, err := a.getAIProviderProfileForConversation(snapshot.ID); err == nil {
		profile = resolvedProfile
	}
	prevContextTokens, err := calculateAIConversationContextTokensWithProfile(snapshot.ID, strings.TrimSpace(sessionID), apiMessages, profile)
	if err != nil {
		return aiConversationCompressedSeed{}, err
	}
	toolResultIndices := make([]int, 0, len(apiMessages))
	lastUserMessageIndex := -1
	for index, message := range apiMessages {
		if strings.EqualFold(strings.TrimSpace(message.Role), "user") {
			lastUserMessageIndex = index
		}
		if isAIConversationToolResultMessage(message) {
			toolResultIndices = append(toolResultIndices, index)
		}
	}
	toolIndicesToCompress := make(map[int]struct{}, len(toolResultIndices))
	for _, index := range toolResultIndices[:max(0, len(toolResultIndices)-1)] {
		toolIndicesToCompress[index] = struct{}{}
	}
	newMessages := make([]AIConversationAPIMessage, 0, len(apiMessages))
	for index, message := range apiMessages {
		nextMessage := message
		if _, shouldCompressToolResult := toolIndicesToCompress[index]; shouldCompressToolResult {
			compressedText, compressedBody := compressAIConversationToolResultText(nextMessage.Content, index != lastUserMessageIndex, index != lastUserMessageIndex)
			nextMessage.Content = compressedText
			if len(normalizeAIStringList(nextMessage.Images)) > 0 {
				nextMessage.Images = nil
			}
			if compressedBody.ShouldRemove && len(normalizeAIStringList(nextMessage.Images)) == 0 {
				continue
			}
			newMessages = append(newMessages, nextMessage)
			continue
		}
		if index != lastUserMessageIndex {
			compressedText := compressAIConversationUserFacingText(nextMessage.Content, true, true)
			nextMessage.Content = compressedText.Text
			if compressedText.ShouldRemove {
				nextMessage.Content = ""
			}
			images := normalizeAIStringList(nextMessage.Images)
			if len(images) > 0 {
				nextMessage.Images = nil
				if strings.TrimSpace(nextMessage.Content) == "" {
					nextMessage.Content = aiConversationImageRemovedPlaceholder
				} else if !strings.Contains(nextMessage.Content, aiConversationImageRemovedPlaceholder) {
					nextMessage.Content = strings.TrimSpace(nextMessage.Content + "\n" + aiConversationImageRemovedPlaceholder)
				}
			}
		}
		if strings.TrimSpace(nextMessage.Content) == "" && len(normalizeAIStringList(nextMessage.Images)) == 0 {
			if strings.EqualFold(strings.TrimSpace(nextMessage.Role), "assistant") {
				continue
			}
		}
		if strings.TrimSpace(nextMessage.Content) == "" && len(normalizeAIStringList(nextMessage.Images)) == 0 {
			continue
		}
		newMessages = append(newMessages, nextMessage)
	}
	newContextTokens, err := calculateAIConversationContextTokensWithProfile(snapshot.ID, strings.TrimSpace(sessionID), newMessages, profile)
	if err != nil {
		return aiConversationCompressedSeed{}, err
	}
	if newContextTokens >= prevContextTokens {
		return aiConversationCompressedSeed{}, fmt.Errorf("压缩后上下文未减少")
	}
	return aiConversationCompressedSeed{
		APIMessages:       newMessages,
		PrevContextTokens: prevContextTokens,
		NewContextTokens:  newContextTokens,
	}, nil
}

func resolveAIConversationSummarySubtaskLineage(parentSnapshot AIConversationSnapshot) (string, string, string) {
	parentConversationID := strings.TrimSpace(parentSnapshot.ParentConversationID)
	if parentConversationID == "" {
		return strings.TrimSpace(parentSnapshot.ID), strings.TrimSpace(parentSnapshot.ID), strings.TrimSpace(parentSnapshot.Title)
	}
	rootConversationID := strings.TrimSpace(parentSnapshot.RootConversationID)
	if rootConversationID == "" {
		rootConversationID = parentConversationID
	}
	parentTitleSnapshot := strings.TrimSpace(parentSnapshot.ParentTitleSnapshot)
	if parentTitleSnapshot == "" {
		parentTitleSnapshot = strings.TrimSpace(parentSnapshot.Title)
	}
	return parentConversationID, rootConversationID, parentTitleSnapshot
}

func (a *App) CreateAIConversationSummarySubtask(conversationID string, sessionID string, requestID string) (AIConversationSnapshot, error) {
	if a == nil || a.configManager == nil {
		return AIConversationSnapshot{}, fmt.Errorf("配置管理器不可用")
	}
	trimmedConversationID := strings.TrimSpace(conversationID)
	if trimmedConversationID == "" {
		return AIConversationSnapshot{}, fmt.Errorf("缺少对话 ID")
	}
	trimmedRequestID := strings.TrimSpace(requestID)
	parentSnapshot, err := a.configManager.GetAIConversation(trimmedConversationID)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	compressedSeed, err := a.buildAIConversationCompressedSeed(parentSnapshot, sessionID)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	requestMessages := buildAIChatRequestMessagesFromConversationAPI(compressedSeed.APIMessages)
	if len(requestMessages) == 0 {
		return AIConversationSnapshot{}, fmt.Errorf("压缩后的上下文为空")
	}
	profile, err := a.getAIProviderProfileForConversation(parentSnapshot.ID)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	summaryPrompt := buildAIConversationSummarySubtaskPrompt()
	if strings.TrimSpace(summaryPrompt) == "" {
		return AIConversationSnapshot{}, fmt.Errorf("摘要模板不可用")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	if trimmedRequestID != "" {
		a.setAIChatRequestCancel(trimmedRequestID, cancel)
	}
	defer func() {
		cancel()
		if trimmedRequestID != "" {
			a.popAIChatRequestCancel(trimmedRequestID)
		}
	}()
	roundResult, err := a.requestAIProviderChatRound(ctx, trimmedRequestID, AIChatRequestPayload{
		ConversationID:       parentSnapshot.ID,
		SessionID:            strings.TrimSpace(sessionID),
		SystemPromptOverride: summaryPrompt,
		StreamEventPrefix:    aiCollaborationStreamEventPrefix,
		Messages:             requestMessages,
	}, profile, requestMessages)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	summaryOutput := extractAIConversationSummarySubtaskOutput(roundResult.Text)
	summaryTitle := buildAIConversationSummarySubtaskTitle(summaryOutput.Title)
	summaryText := strings.TrimSpace(summaryOutput.Summary)
	if summaryText == "" {
		return AIConversationSnapshot{}, fmt.Errorf("摘要内容为空")
	}
	globalSettings := a.configManager.GetAIGlobalSettings()
	childSettings := normalizeAIConversationTaskSettings(parentSnapshot.Settings)
	if strings.TrimSpace(childSettings.CurrentProviderID) == "" {
		childSettings.CurrentProviderID = strings.TrimSpace(globalSettings.CurrentProviderID)
	}
	now := time.Now()
	parentConversationID, rootConversationID, parentTitleSnapshot := resolveAIConversationSummarySubtaskLineage(parentSnapshot)
	uiMessage := buildAIConversationSummarySubtaskUIMessage(parentSnapshot, summaryText, compressedSeed.PrevContextTokens, compressedSeed.NewContextTokens)
	childSnapshot := normalizeAIConversationSnapshot(AIConversationSnapshot{
		ID:                        aiConversationID(),
		Title:                     summaryTitle,
		CreatedAt:                 now.UnixMilli(),
		UpdatedAt:                 now.UnixMilli(),
		Status:                    "idle",
		ToolProtocol:              "xml",
		PromptCacheBypassTimestamp: formatAIPromptCacheBypassTimestamp(now),
		ParentConversationID:      parentConversationID,
		RootConversationID:        rootConversationID,
		RelationType:              aiConversationRelationTypePhase,
		RelationSource:            aiConversationRelationSourceSummaryCondense,
		ParentTitleSnapshot:       parentTitleSnapshot,
		Archived:                  false,
		Messages: []AIConversationMessage{
			uiMessage,
		},
		APIMessages: []AIConversationAPIMessage{
			{
				Role:         "user",
				Content:      buildAIConversationSummarySeedSystemContent(summaryText),
				MessageID:    uiMessage.ID + "-user",
				UIMessageIDs: []string{uiMessage.ID},
				Ts:           now.UnixMilli(),
			},
		},
		Settings: childSettings,
	}, defaultAIConversationTaskSettings(globalSettings))
	return a.configManager.SaveAIConversation(childSnapshot)
}