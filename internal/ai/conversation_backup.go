package ai

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const aiConversationBackupDirName = "backup"
const aiConversationBackupSummaryFileName = "backup_summary.json"
const aiConversationAutoBackupLimit = 200

var aiConversationBackupExcludedRelativePaths = []string{
	aiConversationBackupDirName,
	"setting.json",
}

type AIConversationBackupSummary struct {
	Message     string `json:"message"`
	MessageRole string `json:"messageRole,omitempty"`
}

type AIConversationBackup struct {
	ID          string `json:"id"`
	Ts          int64  `json:"ts"`
	Message     string `json:"message"`
	MessageRole string `json:"messageRole,omitempty"`
	Type        string `json:"type"`
}

func formatAIConversationBackupID(ts time.Time) string {
	return ts.UTC().Format("2006-01-02T15-04-05-000Z")
}

func parseAIConversationBackupID(backupID string) int64 {
	parsed, err := time.Parse("2006-01-02T15-04-05-000Z", strings.TrimSpace(backupID))
	if err != nil {
		return 0
	}
	return parsed.UnixMilli()
}

func formatAIConversationBackupTime(backupID string) string {
	parsed := parseAIConversationBackupID(backupID)
	if parsed <= 0 {
		return strings.TrimSpace(backupID)
	}
	ts := time.UnixMilli(parsed).Local()
	return fmt.Sprintf("%d-%d-%d %02d:%02d:%02d", ts.Year(), int(ts.Month()), ts.Day(), ts.Hour(), ts.Minute(), ts.Second())
}

func normalizeAIConversationBackupSummary(summary AIConversationBackupSummary, backupID string) AIConversationBackupSummary {
	summary.Message = strings.TrimSpace(summary.Message)
	if summary.Message == "" {
		summary.Message = formatAIConversationBackupTime(backupID)
	}
	switch strings.ToLower(strings.TrimSpace(summary.MessageRole)) {
	case "user":
		summary.MessageRole = "user"
	case "assistant":
		summary.MessageRole = "assistant"
	default:
		summary.MessageRole = ""
	}
	return summary
}

func buildAIConversationBackupSummary(messages []AIConversationAPIMessage, backupID string) AIConversationBackupSummary {
	summary := AIConversationBackupSummary{
		Message: formatAIConversationBackupTime(backupID),
	}
	for index := len(messages) - 1; index >= 0; index-- {
		message := messages[index]
		role := strings.ToLower(strings.TrimSpace(message.Role))
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if content == "" && len(message.Images) == 0 {
			continue
		}
		if content != "" {
			summary.Message = content
		}
		summary.MessageRole = role
		return normalizeAIConversationBackupSummary(summary, backupID)
	}
	return normalizeAIConversationBackupSummary(summary, backupID)
}

func normalizeAIConversationBackupRelativePath(value string) string {
	normalized := filepath.ToSlash(filepath.Clean(strings.TrimSpace(value)))
	if normalized == "." {
		return ""
	}
	return strings.TrimPrefix(normalized, "./")
}

func isAIConversationBackupExcludedDirectory(rootDir string, relativePath string) bool {
	raw := strings.TrimSpace(relativePath)
	if strings.HasSuffix(raw, "/") || strings.HasSuffix(raw, "\\") {
		return true
	}
	normalized := normalizeAIConversationBackupRelativePath(relativePath)
	if normalized == "" {
		return false
	}
	info, err := os.Stat(filepath.Join(rootDir, filepath.FromSlash(normalized)))
	return err == nil && info.IsDir()
}

func isAIConversationBackupExcludedRelativePath(rootDir string, relativePath string) bool {
	normalized := normalizeAIConversationBackupRelativePath(relativePath)
	if normalized == "" {
		return false
	}
	for _, item := range aiConversationBackupExcludedRelativePaths {
		excluded := normalizeAIConversationBackupRelativePath(item)
		if excluded == "" {
			continue
		}
		if normalized == excluded {
			return true
		}
		if isAIConversationBackupExcludedDirectory(rootDir, item) && strings.HasPrefix(normalized, excluded+"/") {
			return true
		}
	}
	return false
}

func (c *configBridge) aiConversationBackupRootDir(conversationID string) string {
	return filepath.Join(c.aiConversationDir(conversationID), aiConversationBackupDirName)
}

func (c *configBridge) aiConversationBackupDir(conversationID string, backupID string) string {
	return filepath.Join(c.aiConversationBackupRootDir(conversationID), backupID)
}

func (c *configBridge) aiConversationBackupSummaryPath(conversationID string, backupID string) string {
	return filepath.Join(c.aiConversationBackupDir(conversationID, backupID), aiConversationBackupSummaryFileName)
}

func copyAIConversationFile(sourcePath string, targetPath string, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(targetPath), 0700); err != nil {
		return err
	}
	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()
	tmpPath := targetPath + ".tmp"
	targetFile, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode.Perm())
	if err != nil {
		return err
	}
	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		targetFile.Close()
		_ = os.Remove(tmpPath)
		return err
	}
	if err := targetFile.Sync(); err != nil {
		targetFile.Close()
		_ = os.Remove(tmpPath)
		return err
	}
	if err := targetFile.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return os.Rename(tmpPath, targetPath)
}

func copyAIConversationDirExcludingBackups(sourceDir string, targetDir string) error {
	return filepath.Walk(sourceDir, func(currentPath string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relativePath, err := filepath.Rel(sourceDir, currentPath)
		if err != nil {
			return err
		}
		if relativePath == "." {
			return nil
		}
		if isAIConversationBackupExcludedRelativePath(sourceDir, relativePath) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		targetPath := filepath.Join(targetDir, relativePath)
		if info.IsDir() {
			return os.MkdirAll(targetPath, info.Mode().Perm())
		}
		return copyAIConversationFile(currentPath, targetPath, info.Mode())
	})
}

func copyAIConversationBackupDir(sourceDir string, targetDir string) error {
	return filepath.Walk(sourceDir, func(currentPath string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relativePath, err := filepath.Rel(sourceDir, currentPath)
		if err != nil {
			return err
		}
		if relativePath == "." {
			return nil
		}
		if relativePath == aiConversationBackupSummaryFileName || isAIConversationBackupExcludedRelativePath(sourceDir, relativePath) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		targetPath := filepath.Join(targetDir, relativePath)
		if info.IsDir() {
			return os.MkdirAll(targetPath, info.Mode().Perm())
		}
		return copyAIConversationFile(currentPath, targetPath, info.Mode())
	})
}

func readAIConversationBackupAPIMessagesFromDir(backupDir string) []AIConversationAPIMessage {
	data, err := os.ReadFile(filepath.Join(backupDir, "api_conversation_history.json"))
	if err != nil {
		return []AIConversationAPIMessage{}
	}
	var messages []AIConversationAPIMessage
	if err := json.Unmarshal(data, &messages); err != nil {
		return []AIConversationAPIMessage{}
	}
	return normalizeAIConversationAPIMessages(messages)
}

func (c *configBridge) writeAIConversationBackupSummaryLocked(conversationID string, backupID string) (AIConversationBackupSummary, error) {
	backupDir := c.aiConversationBackupDir(conversationID, backupID)
	summary := buildAIConversationBackupSummary(readAIConversationBackupAPIMessagesFromDir(backupDir), backupID)
	data, err := marshalAIConversationJSON(summary)
	if err != nil {
		return summary, err
	}
	if err := atomicWriteFile(c.aiConversationBackupSummaryPath(conversationID, backupID), data, 0600); err != nil {
		return summary, err
	}
	return summary, nil
}

func (c *configBridge) readAIConversationBackupSummaryLocked(conversationID string, backupID string) AIConversationBackupSummary {
	data, err := os.ReadFile(c.aiConversationBackupSummaryPath(conversationID, backupID))
	if err == nil {
		var summary AIConversationBackupSummary
		if json.Unmarshal(data, &summary) == nil {
			return normalizeAIConversationBackupSummary(summary, backupID)
		}
	}
	backupDir := c.aiConversationBackupDir(conversationID, backupID)
	return buildAIConversationBackupSummary(readAIConversationBackupAPIMessagesFromDir(backupDir), backupID)
}

func trimAIConversationBackupDirectoriesLocked(backupRootDir string, maxCount int) {
	if maxCount < 1 {
		return
	}
	entries, err := os.ReadDir(backupRootDir)
	if err != nil {
		return
	}
	type backupDirInfo struct {
		id  string
		dir string
		ts  int64
	}
	items := make([]backupDirInfo, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		backupDir := filepath.Join(backupRootDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, backupDirInfo{
			id:  entry.Name(),
			dir: backupDir,
			ts:  info.ModTime().UnixMilli(),
		})
	}
	sort.Slice(items, func(left int, right int) bool {
		if items[left].ts != items[right].ts {
			return items[left].ts > items[right].ts
		}
		return items[left].id > items[right].id
	})
	if len(items) <= maxCount {
		return
	}
	for _, item := range items[maxCount:] {
		_ = os.RemoveAll(item.dir)
	}
}

func (c *configBridge) createAIConversationAutoBackupLocked(conversationID string) (AIConversationBackup, error) {
	trimmedConversationID := strings.TrimSpace(conversationID)
	if trimmedConversationID == "" {
		return AIConversationBackup{}, fmt.Errorf("缺少对话 ID")
	}
	sourceDir := c.aiConversationDir(trimmedConversationID)
	if _, err := os.Stat(sourceDir); err != nil {
		return AIConversationBackup{}, err
	}
	backupID := formatAIConversationBackupID(time.Now())
	backupRootDir := c.aiConversationBackupRootDir(trimmedConversationID)
	backupDir := c.aiConversationBackupDir(trimmedConversationID, backupID)
	if err := os.MkdirAll(backupRootDir, 0700); err != nil {
		return AIConversationBackup{}, err
	}
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return AIConversationBackup{}, err
	}
	if err := copyAIConversationDirExcludingBackups(sourceDir, backupDir); err != nil {
		_ = os.RemoveAll(backupDir)
		return AIConversationBackup{}, err
	}
	summary, _ := c.writeAIConversationBackupSummaryLocked(trimmedConversationID, backupID)
	info, err := os.Stat(backupDir)
	backupTs := time.Now().UnixMilli()
	if err == nil {
		backupTs = info.ModTime().UnixMilli()
	}
	trimAIConversationBackupDirectoriesLocked(backupRootDir, aiConversationAutoBackupLimit)
	return AIConversationBackup{
		ID:          backupID,
		Ts:          backupTs,
		Message:     summary.Message,
		MessageRole: summary.MessageRole,
		Type:        "auto",
	}, nil
}

func (c *configBridge) readAIGlobalSettingsUnlocked() AIGlobalSettings {
	settings := defaultAIGlobalSettings()
	if c == nil {
		return settings
	}
	data, err := os.ReadFile(c.aiGlobalSettingsPath())
	if err != nil {
		return settings
	}
	_ = json.Unmarshal(data, &settings)
	return normalizeAIGlobalSettings(settings)
}

func (c *configBridge) buildAIConversationSnapshotLocked(conversationID string) (AIConversationSnapshot, error) {
	summary, err := c.readAIConversationSummary(conversationID)
	if err != nil {
		return AIConversationSnapshot{}, err
	}
	fallbackSettings := defaultAIConversationTaskSettings(c.readAIGlobalSettingsUnlocked())
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
		Messages:                  c.readAIConversationMessages(conversationID),
		APIMessages:               c.readAIConversationAPIMessages(conversationID),
		Settings:                  c.readAIConversationSettings(conversationID, fallbackSettings),
	}
	return normalizeAIConversationSnapshot(snapshot, fallbackSettings), nil
}

func (c *configBridge) ListAIConversationBackups(conversationID string) []AIConversationBackup {
	if c == nil {
		return []AIConversationBackup{}
	}
	trimmedConversationID := strings.TrimSpace(conversationID)
	if trimmedConversationID == "" {
		return []AIConversationBackup{}
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	entries, err := os.ReadDir(c.aiConversationBackupRootDir(trimmedConversationID))
	if err != nil {
		return []AIConversationBackup{}
	}
	backups := make([]AIConversationBackup, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		summary := c.readAIConversationBackupSummaryLocked(trimmedConversationID, entry.Name())
		backupTs := info.ModTime().UnixMilli()
		if backupTs <= 0 {
			backupTs = parseAIConversationBackupID(entry.Name())
		}
		backups = append(backups, AIConversationBackup{
			ID:          entry.Name(),
			Ts:          backupTs,
			Message:     summary.Message,
			MessageRole: summary.MessageRole,
			Type:        "auto",
		})
	}
	sort.Slice(backups, func(left int, right int) bool {
		if backups[left].Ts != backups[right].Ts {
			return backups[left].Ts > backups[right].Ts
		}
		return backups[left].ID > backups[right].ID
	})
	return backups
}

func (c *configBridge) GetAIConversationBackupHistory(conversationID string, backupID string) []AIConversationAPIMessage {
	if c == nil {
		return []AIConversationAPIMessage{}
	}
	trimmedConversationID := strings.TrimSpace(conversationID)
	trimmedBackupID := strings.TrimSpace(backupID)
	if trimmedConversationID == "" || trimmedBackupID == "" {
		return []AIConversationAPIMessage{}
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return readAIConversationBackupAPIMessagesFromDir(c.aiConversationBackupDir(trimmedConversationID, trimmedBackupID))
}

func (c *configBridge) RestoreAIConversationBackup(conversationID string, backupID string) (AIConversationSnapshot, error) {
	if c == nil {
		return AIConversationSnapshot{}, fmt.Errorf("配置管理器不可用")
	}
	trimmedConversationID := strings.TrimSpace(conversationID)
	trimmedBackupID := strings.TrimSpace(backupID)
	if trimmedConversationID == "" {
		return AIConversationSnapshot{}, fmt.Errorf("缺少对话 ID")
	}
	if trimmedBackupID == "" {
		return AIConversationSnapshot{}, fmt.Errorf("缺少备份 ID")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	backupDir := c.aiConversationBackupDir(trimmedConversationID, trimmedBackupID)
	if _, err := os.Stat(backupDir); err != nil {
		return AIConversationSnapshot{}, err
	}
	conversationDir := c.aiConversationDir(trimmedConversationID)
	if err := os.MkdirAll(conversationDir, 0700); err != nil {
		return AIConversationSnapshot{}, err
	}
	if err := copyAIConversationBackupDir(backupDir, conversationDir); err != nil {
		return AIConversationSnapshot{}, err
	}
	return c.buildAIConversationSnapshotLocked(trimmedConversationID)
}

func (c *configBridge) DeleteAIConversationBackup(conversationID string, backupID string) error {
	if c == nil {
		return fmt.Errorf("配置管理器不可用")
	}
	trimmedConversationID := strings.TrimSpace(conversationID)
	trimmedBackupID := strings.TrimSpace(backupID)
	if trimmedConversationID == "" {
		return fmt.Errorf("缺少对话 ID")
	}
	if trimmedBackupID == "" {
		return fmt.Errorf("缺少备份 ID")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return os.RemoveAll(c.aiConversationBackupDir(trimmedConversationID, trimmedBackupID))
}

func (a *Service) CreateAIConversationAutoBackup(conversationID string) (AIConversationBackup, error) {
	if a == nil || a.configManager == nil {
		return AIConversationBackup{}, fmt.Errorf("配置管理器不可用")
	}
	return a.configManager.CreateAIConversationAutoBackup(conversationID)
}

func (c *configBridge) CreateAIConversationAutoBackup(conversationID string) (AIConversationBackup, error) {
	if c == nil {
		return AIConversationBackup{}, fmt.Errorf("配置管理器不可用")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.createAIConversationAutoBackupLocked(conversationID)
}

func (a *Service) ListAIConversationBackups(conversationID string) []AIConversationBackup {
	if a == nil || a.configManager == nil {
		return []AIConversationBackup{}
	}
	return a.configManager.ListAIConversationBackups(conversationID)
}

func (a *Service) GetAIConversationBackupHistory(conversationID string, backupID string) []AIConversationAPIMessage {
	if a == nil || a.configManager == nil {
		return []AIConversationAPIMessage{}
	}
	return a.configManager.GetAIConversationBackupHistory(conversationID, backupID)
}

func (a *Service) RestoreAIConversationBackup(conversationID string, backupID string) (AIConversationSnapshot, error) {
	if a == nil || a.configManager == nil {
		return AIConversationSnapshot{}, fmt.Errorf("配置管理器不可用")
	}
	return a.configManager.RestoreAIConversationBackup(conversationID, backupID)
}

func (a *Service) DeleteAIConversationBackup(conversationID string, backupID string) error {
	if a == nil || a.configManager == nil {
		return fmt.Errorf("配置管理器不可用")
	}
	return a.configManager.DeleteAIConversationBackup(conversationID, backupID)
}