package ai

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

type aiConversationDescendantSummary struct {
	Summary AIConversationSummary
	Depth   int
}

func sortAIConversationSummariesByCreatedAt(items []AIConversationSummary) {
	sort.SliceStable(items, func(leftIndex int, rightIndex int) bool {
		left := items[leftIndex]
		right := items[rightIndex]
		if left.CreatedAt != right.CreatedAt {
			return left.CreatedAt < right.CreatedAt
		}
		if left.UpdatedAt != right.UpdatedAt {
			return left.UpdatedAt < right.UpdatedAt
		}
		return strings.TrimSpace(left.ID) < strings.TrimSpace(right.ID)
	})
}

func (c *ConfigManager) listAIConversationSummariesLocked() []AIConversationSummary {
	entries, err := os.ReadDir(c.aiConversationsRootDir())
	if err != nil {
		return []AIConversationSummary{}
	}
	summaries := make([]AIConversationSummary, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		summary, readErr := c.readAIConversationSummary(entry.Name())
		if readErr != nil {
			continue
		}
		summaries = append(summaries, summary)
	}
	return summaries
}

func buildAIConversationChildrenMap(summaries []AIConversationSummary) map[string][]AIConversationSummary {
	childrenMap := make(map[string][]AIConversationSummary, len(summaries))
	for _, summary := range summaries {
		parentConversationID := strings.TrimSpace(summary.ParentConversationID)
		if parentConversationID == "" {
			continue
		}
		childrenMap[parentConversationID] = append(childrenMap[parentConversationID], summary)
	}
	for parentConversationID, items := range childrenMap {
		sortAIConversationSummariesByCreatedAt(items)
		childrenMap[parentConversationID] = items
	}
	return childrenMap
}

func collectAIConversationDescendants(childrenMap map[string][]AIConversationSummary, rootConversationID string) []aiConversationDescendantSummary {
	trimmedRootConversationID := strings.TrimSpace(rootConversationID)
	if trimmedRootConversationID == "" {
		return []aiConversationDescendantSummary{}
	}
	type queueItem struct {
		ConversationID string
		Depth          int
	}
	queue := []queueItem{{ConversationID: trimmedRootConversationID, Depth: 0}}
	visited := map[string]struct{}{trimmedRootConversationID: {}}
	descendants := make([]aiConversationDescendantSummary, 0)
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		children := childrenMap[current.ConversationID]
		for _, child := range children {
			childConversationID := strings.TrimSpace(child.ID)
			if childConversationID == "" {
				continue
			}
			if _, exists := visited[childConversationID]; exists {
				continue
			}
			visited[childConversationID] = struct{}{}
			descendants = append(descendants, aiConversationDescendantSummary{
				Summary: child,
				Depth:   current.Depth + 1,
			})
			queue = append(queue, queueItem{
				ConversationID: childConversationID,
				Depth:          current.Depth + 1,
			})
		}
	}
	return descendants
}

func pickPromotedAIConversationPhaseSummary(descendants []aiConversationDescendantSummary) (AIConversationSummary, bool) {
	directPhaseChildren := make([]AIConversationSummary, 0)
	phaseDescendants := make([]aiConversationDescendantSummary, 0)
	for _, item := range descendants {
		relationType := normalizeAIConversationRelationType(item.Summary.RelationType)
		if relationType != aiConversationRelationTypePhase {
			continue
		}
		if item.Depth == 1 {
			directPhaseChildren = append(directPhaseChildren, item.Summary)
		}
		phaseDescendants = append(phaseDescendants, item)
	}
	if len(directPhaseChildren) > 0 {
		sortAIConversationSummariesByCreatedAt(directPhaseChildren)
		return directPhaseChildren[0], true
	}
	if len(phaseDescendants) == 0 {
		return AIConversationSummary{}, false
	}
	sort.SliceStable(phaseDescendants, func(leftIndex int, rightIndex int) bool {
		left := phaseDescendants[leftIndex]
		right := phaseDescendants[rightIndex]
		if left.Depth != right.Depth {
			return left.Depth < right.Depth
		}
		if left.Summary.CreatedAt != right.Summary.CreatedAt {
			return left.Summary.CreatedAt < right.Summary.CreatedAt
		}
		if left.Summary.UpdatedAt != right.Summary.UpdatedAt {
			return left.Summary.UpdatedAt < right.Summary.UpdatedAt
		}
		return strings.TrimSpace(left.Summary.ID) < strings.TrimSpace(right.Summary.ID)
	})
	return phaseDescendants[0].Summary, true
}

func (c *ConfigManager) readAIConversationSnapshotLocked(conversationID string) (AIConversationSnapshot, error) {
	trimmedConversationID := strings.TrimSpace(conversationID)
	if trimmedConversationID == "" {
		return AIConversationSnapshot{}, fmt.Errorf("缺少对话 ID")
	}
	summary, err := c.readAIConversationSummary(trimmedConversationID)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	snapshot := AIConversationSnapshot{
		ID:                        summary.ID,
		Title:                     summary.Title,
		CreatedAt:                 summary.CreatedAt,
		UpdatedAt:                 summary.UpdatedAt,
		Status:                    summary.Status,
		ToolProtocol:              summary.ToolProtocol,
		PromptCacheBypassTimestamp: summary.PromptCacheBypassTimestamp,
		ParentConversationID:      summary.ParentConversationID,
		RootConversationID:        summary.RootConversationID,
		RelationType:              summary.RelationType,
		RelationSource:            summary.RelationSource,
		ParentTitleSnapshot:       summary.ParentTitleSnapshot,
		Archived:                  summary.Archived,
		Messages:                  c.readAIConversationMessages(trimmedConversationID),
		APIMessages:               c.readAIConversationAPIMessages(trimmedConversationID),
		Settings:                  c.readAIConversationSettings(trimmedConversationID, AIConversationTaskSettings{}),
	}
	return normalizeAIConversationSnapshot(snapshot, AIConversationTaskSettings{}), nil
}

func normalizeAIConversationArchivedIndependentSnapshot(snapshot AIConversationSnapshot) AIConversationSnapshot {
	snapshot.ParentConversationID = ""
	snapshot.RootConversationID = ""
	snapshot.ParentTitleSnapshot = ""
	snapshot.Archived = true
	return normalizeAIConversationSnapshot(snapshot, AIConversationTaskSettings{})
}

func normalizeAIConversationPromotedPhaseRootSnapshot(snapshot AIConversationSnapshot) AIConversationSnapshot {
	snapshot.ParentConversationID = ""
	snapshot.RootConversationID = ""
	snapshot.ParentTitleSnapshot = ""
	snapshot.Archived = false
	return normalizeAIConversationSnapshot(snapshot, AIConversationTaskSettings{})
}

func normalizeAIConversationPhaseSnapshotUnderRoot(snapshot AIConversationSnapshot, promotedSummary AIConversationSummary) AIConversationSnapshot {
	promotedConversationID := strings.TrimSpace(promotedSummary.ID)
	snapshot.ParentConversationID = promotedConversationID
	snapshot.RootConversationID = promotedConversationID
	snapshot.ParentTitleSnapshot = strings.TrimSpace(promotedSummary.Title)
	snapshot.Archived = false
	return normalizeAIConversationSnapshot(snapshot, AIConversationTaskSettings{})
}

func (c *ConfigManager) reorganizeAIRootConversationDescendantsLocked(rootSummary AIConversationSummary) error {
	trimmedRootConversationID := strings.TrimSpace(rootSummary.ID)
	if trimmedRootConversationID == "" {
		return nil
	}
	allSummaries := c.listAIConversationSummariesLocked()
	childrenMap := buildAIConversationChildrenMap(allSummaries)
	descendants := collectAIConversationDescendants(childrenMap, trimmedRootConversationID)
	if len(descendants) == 0 {
		return nil
	}
	promotedSummary, hasPromotedSummary := pickPromotedAIConversationPhaseSummary(descendants)
	for _, item := range descendants {
		snapshot, err := c.readAIConversationSnapshotLocked(item.Summary.ID)
		if err != nil {
			return err
		}
		if normalizeAIConversationRelationType(snapshot.RelationType) == aiConversationRelationTypeAgent {
			snapshot = normalizeAIConversationArchivedIndependentSnapshot(snapshot)
		} else if hasPromotedSummary {
			if strings.TrimSpace(snapshot.ID) == strings.TrimSpace(promotedSummary.ID) {
				snapshot = normalizeAIConversationPromotedPhaseRootSnapshot(snapshot)
			} else {
				snapshot = normalizeAIConversationPhaseSnapshotUnderRoot(snapshot, promotedSummary)
			}
		} else {
			snapshot = normalizeAIConversationArchivedIndependentSnapshot(snapshot)
		}
		if err := c.writeAIConversationSnapshot(snapshot); err != nil {
			return err
		}
	}
	return nil
}