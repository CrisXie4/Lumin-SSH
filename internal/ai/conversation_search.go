package ai

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	_ "modernc.org/sqlite"
)

type AIConversationMessageSearchResult struct {
	ConversationID    string `json:"conversationId"`
	ConversationTitle string `json:"conversationTitle"`
	MessageID         string `json:"messageId"`
	Role              string `json:"role"`
	Snippet           string `json:"snippet"`
	UpdatedAt         int64  `json:"updatedAt"`
}

type aiConversationSearchState struct {
	ConversationID string
	UpdatedAt      int64
}

var aiConversationSearchDBCache sync.Map

func (c *configBridge) aiConversationSearchDBPath() string {
	return filepath.Join(c.configDir, "ai_conversation_search.db")
}

func (c *configBridge) getAIConversationSearchDB() (*sql.DB, error) {
	if c == nil || strings.TrimSpace(c.configDir) == "" {
		return nil, fmt.Errorf("配置管理器不可用")
	}
	dbPath := filepath.Clean(c.aiConversationSearchDBPath())
	if cached, ok := aiConversationSearchDBCache.Load(dbPath); ok {
		db, ok := cached.(*sql.DB)
		if ok && db != nil {
			return db, nil
		}
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		_ = db.Close()
		return nil, err
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000;"); err != nil {
		_ = db.Close()
		return nil, err
	}
	actual, loaded := aiConversationSearchDBCache.LoadOrStore(dbPath, db)
	if loaded {
		_ = db.Close()
		cached, ok := actual.(*sql.DB)
		if !ok || cached == nil {
			return nil, fmt.Errorf("AI 对话搜索数据库不可用")
		}
		return cached, nil
	}
	return db, nil
}

func (c *configBridge) ensureAIConversationSearchSchemaLocked(tx *sql.Tx) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS ai_conversation_message_index (
			message_id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			conversation_title TEXT NOT NULL,
			role TEXT NOT NULL,
			body TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_conversation_message_index_conversation_id ON ai_conversation_message_index (conversation_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_conversation_message_index_updated_at ON ai_conversation_message_index (updated_at DESC)`,
		`CREATE VIRTUAL TABLE IF NOT EXISTS ai_conversation_message_fts USING fts5(
			message_id UNINDEXED,
			conversation_id UNINDEXED,
			conversation_title UNINDEXED,
			role UNINDEXED,
			body
		)`,
		`CREATE TABLE IF NOT EXISTS ai_conversation_search_state (
			conversation_id TEXT PRIMARY KEY,
			updated_at INTEGER NOT NULL
		)`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

func normalizeAIConversationSearchBody(message AIConversationMessage) string {
	kind := strings.TrimSpace(message.Kind)
	switch kind {
	case "followup":
		parts := make([]string, 0, 1+len(message.Suggestions))
		question := strings.TrimSpace(message.Question)
		if question != "" {
			parts = append(parts, question)
		}
		for _, suggestion := range message.Suggestions {
			trimmedSuggestion := strings.TrimSpace(suggestion)
			if trimmedSuggestion == "" {
				continue
			}
			parts = append(parts, trimmedSuggestion)
		}
		return strings.TrimSpace(strings.Join(parts, "\n\n"))
	case "completion":
		parts := make([]string, 0, 3)
		if trimmedSummary := strings.TrimSpace(message.Summary); trimmedSummary != "" {
			parts = append(parts, trimmedSummary)
		}
		if trimmedResult := strings.TrimSpace(message.Result); trimmedResult != "" {
			parts = append(parts, trimmedResult)
		}
		if len(parts) == 0 {
			if trimmedTitle := strings.TrimSpace(message.Title); trimmedTitle != "" {
				parts = append(parts, trimmedTitle)
			}
		}
		return strings.TrimSpace(strings.Join(parts, "\n\n"))
	default:
		body := strings.TrimSpace(message.Text)
		if body == "" {
			body = strings.TrimSpace(message.Summary)
		}
		if body == "" {
			body = strings.TrimSpace(message.Title)
		}
		body = strings.TrimSpace(strings.Trim(body, "▍"))
		return body
	}
}

func extractAIConversationSearchRecord(message AIConversationMessage) (string, string, string, bool) {
	messageID := strings.TrimSpace(message.ID)
	if messageID == "" {
		return "", "", "", false
	}
	kind := strings.TrimSpace(message.Kind)
	switch kind {
	case "user", "assistant", "followup", "completion":
	default:
		return "", "", "", false
	}
	body := normalizeAIConversationSearchBody(message)
	if body == "" {
		return "", "", "", false
	}
	role := "assistant"
	if kind == "user" {
		role = "user"
	}
	return messageID, role, body, true
}

func (c *configBridge) replaceAIConversationSearchRowsLocked(tx *sql.Tx, snapshot AIConversationSnapshot) error {
	conversationID := strings.TrimSpace(snapshot.ID)
	if conversationID == "" {
		return fmt.Errorf("缺少对话 ID")
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_message_index WHERE conversation_id = ?`, conversationID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_message_fts WHERE conversation_id = ?`, conversationID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_search_state WHERE conversation_id = ?`, conversationID); err != nil {
		return err
	}
	for _, message := range snapshot.Messages {
		messageID, role, body, ok := extractAIConversationSearchRecord(message)
		if !ok {
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO ai_conversation_message_index (message_id, conversation_id, conversation_title, role, body, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			messageID,
			conversationID,
			strings.TrimSpace(snapshot.Title),
			role,
			body,
			snapshot.UpdatedAt,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT INTO ai_conversation_message_fts (message_id, conversation_id, conversation_title, role, body) VALUES (?, ?, ?, ?, ?)`,
			messageID,
			conversationID,
			strings.TrimSpace(snapshot.Title),
			role,
			body,
		); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(
		`INSERT INTO ai_conversation_search_state (conversation_id, updated_at) VALUES (?, ?)`,
		conversationID,
		snapshot.UpdatedAt,
	); err != nil {
		return err
	}
	return nil
}

func (c *configBridge) deleteAIConversationSearchRowsLocked(tx *sql.Tx, conversationID string) error {
	normalizedConversationID := strings.TrimSpace(conversationID)
	if normalizedConversationID == "" {
		return nil
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_message_index WHERE conversation_id = ?`, normalizedConversationID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_message_fts WHERE conversation_id = ?`, normalizedConversationID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM ai_conversation_search_state WHERE conversation_id = ?`, normalizedConversationID); err != nil {
		return err
	}
	return nil
}

func (c *configBridge) loadAIConversationSearchStatesLocked(tx *sql.Tx) (map[string]int64, error) {
	rows, err := tx.Query(`SELECT conversation_id, updated_at FROM ai_conversation_search_state`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	states := make(map[string]int64)
	for rows.Next() {
		var state aiConversationSearchState
		if err := rows.Scan(&state.ConversationID, &state.UpdatedAt); err != nil {
			return nil, err
		}
		states[strings.TrimSpace(state.ConversationID)] = state.UpdatedAt
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return states, nil
}

func (c *configBridge) syncAIConversationSearchIndexLocked() error {
	db, err := c.getAIConversationSearchDB()
	if err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	if err := c.ensureAIConversationSearchSchemaLocked(tx); err != nil {
		return err
	}
	entries, err := os.ReadDir(c.aiConversationsRootDir())
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	summaries := make([]AIConversationSummary, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		summary, err := c.readAIConversationSummary(entry.Name())
		if err != nil {
			continue
		}
		summaries = append(summaries, summary)
	}
	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].UpdatedAt != summaries[j].UpdatedAt {
			return summaries[i].UpdatedAt > summaries[j].UpdatedAt
		}
		return summaries[i].ID > summaries[j].ID
	})
	states, err := c.loadAIConversationSearchStatesLocked(tx)
	if err != nil {
		return err
	}
	existingConversationIDs := make(map[string]struct{}, len(summaries))
	for _, summary := range summaries {
		conversationID := strings.TrimSpace(summary.ID)
		if conversationID == "" {
			continue
		}
		existingConversationIDs[conversationID] = struct{}{}
		if indexedUpdatedAt, ok := states[conversationID]; ok && indexedUpdatedAt == summary.UpdatedAt {
			continue
		}
		snapshot := AIConversationSnapshot{
			ID:                        summary.ID,
			Title:                     summary.Title,
			CreatedAt:                 summary.CreatedAt,
			UpdatedAt:                 summary.UpdatedAt,
			Status:                    summary.Status,
			ToolProtocol:              summary.ToolProtocol,
			PromptCacheBypassTimestamp: summary.PromptCacheBypassTimestamp,
			Messages:                  c.readAIConversationMessages(conversationID),
			APIMessages:               []AIConversationAPIMessage{},
			Settings:                  AIConversationTaskSettings{},
		}
		if err := c.replaceAIConversationSearchRowsLocked(tx, snapshot); err != nil {
			return err
		}
	}
	for conversationID := range states {
		if _, ok := existingConversationIDs[conversationID]; ok {
			continue
		}
		if err := c.deleteAIConversationSearchRowsLocked(tx, conversationID); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}

func normalizeAIConversationSearchLimit(limit int) int {
	if limit <= 0 {
		return 20
	}
	if limit > 100 {
		return 100
	}
	return limit
}

func normalizeAIConversationSearchQuery(query string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(query)), " ")
}

func aiConversationSearchContainsCJK(value string) bool {
	for _, r := range value {
		if unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana, unicode.Hangul) {
			return true
		}
	}
	return false
}

func tokenizeAIConversationFTSQuery(value string) string {
	parts := strings.FieldsFunc(strings.ToLower(value), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	if len(parts) == 0 {
		return ""
	}
	tokens := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		tokens = append(tokens, trimmed+"*")
	}
	return strings.Join(tokens, " ")
}

func buildAIConversationSearchSnippet(body string, query string) string {
	normalizedBody := strings.TrimSpace(body)
	if normalizedBody == "" {
		return ""
	}
	normalizedQuery := normalizeAIConversationSearchQuery(query)
	if normalizedQuery == "" {
		runes := []rune(normalizedBody)
		if len(runes) <= 72 {
			return normalizedBody
		}
		return string(runes[:72]) + "…"
	}
	lowerBody := strings.ToLower(normalizedBody)
	lowerQuery := strings.ToLower(normalizedQuery)
	byteIndex := strings.Index(lowerBody, lowerQuery)
	if byteIndex < 0 {
		runes := []rune(normalizedBody)
		if len(runes) <= 72 {
			return normalizedBody
		}
		return string(runes[:72]) + "…"
	}
	prefixRuneCount := utf8.RuneCountInString(normalizedBody[:byteIndex])
	queryRuneCount := utf8.RuneCountInString(normalizedBody[byteIndex : byteIndex+len(normalizedQuery)])
	runes := []rune(normalizedBody)
	start := prefixRuneCount - 24
	if start < 0 {
		start = 0
	}
	end := prefixRuneCount + queryRuneCount + 36
	if end > len(runes) {
		end = len(runes)
	}
	snippet := string(runes[start:end])
	if start > 0 {
		snippet = "…" + snippet
	}
	if end < len(runes) {
		snippet += "…"
	}
	return snippet
}

func (c *configBridge) appendAIConversationSearchResultsFromFTS(db *sql.DB, results []AIConversationMessageSearchResult, seen map[string]struct{}, query string, conversationID string, limit int) ([]AIConversationMessageSearchResult, error) {
	ftsQuery := tokenizeAIConversationFTSQuery(query)
	if ftsQuery == "" {
		return results, nil
	}
	rows, err := db.Query(
		`SELECT idx.conversation_id, idx.conversation_title, idx.message_id, idx.role, idx.body, idx.updated_at
		FROM ai_conversation_message_fts
		JOIN ai_conversation_message_index idx ON idx.message_id = ai_conversation_message_fts.message_id
		WHERE ai_conversation_message_fts MATCH ? AND (? = '' OR idx.conversation_id = ?)
		ORDER BY bm25(ai_conversation_message_fts), idx.updated_at DESC
		LIMIT ?`,
		ftsQuery,
		conversationID,
		conversationID,
		limit,
	)
	if err != nil {
		return results, err
	}
	defer rows.Close()
	for rows.Next() {
		var result AIConversationMessageSearchResult
		var body string
		if err := rows.Scan(&result.ConversationID, &result.ConversationTitle, &result.MessageID, &result.Role, &body, &result.UpdatedAt); err != nil {
			return results, err
		}
		if _, exists := seen[result.MessageID]; exists {
			continue
		}
		seen[result.MessageID] = struct{}{}
		result.Snippet = buildAIConversationSearchSnippet(body, query)
		results = append(results, result)
		if len(results) >= limit {
			return results, nil
		}
	}
	if err := rows.Err(); err != nil {
		return results, err
	}
	return results, nil
}

func (c *configBridge) appendAIConversationSearchResultsFromLike(db *sql.DB, results []AIConversationMessageSearchResult, seen map[string]struct{}, query string, conversationID string, limit int) ([]AIConversationMessageSearchResult, error) {
	pattern := "%" + strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(query, `\`, `\\`), `%`, `\%`), `_`, `\_`) + "%"
	rows, err := db.Query(
		`SELECT conversation_id, conversation_title, message_id, role, body, updated_at
		FROM ai_conversation_message_index
		WHERE body LIKE ? ESCAPE '\' AND (? = '' OR conversation_id = ?)
		ORDER BY updated_at DESC
		LIMIT ?`,
		pattern,
		conversationID,
		conversationID,
		limit,
	)
	if err != nil {
		return results, err
	}
	defer rows.Close()
	for rows.Next() {
		var result AIConversationMessageSearchResult
		var body string
		if err := rows.Scan(&result.ConversationID, &result.ConversationTitle, &result.MessageID, &result.Role, &body, &result.UpdatedAt); err != nil {
			return results, err
		}
		if _, exists := seen[result.MessageID]; exists {
			continue
		}
		seen[result.MessageID] = struct{}{}
		result.Snippet = buildAIConversationSearchSnippet(body, query)
		results = append(results, result)
		if len(results) >= limit {
			return results, nil
		}
	}
	if err := rows.Err(); err != nil {
		return results, err
	}
	return results, nil
}

func (c *configBridge) SearchAIConversationMessages(query string, conversationID string, limit int) ([]AIConversationMessageSearchResult, error) {
	if c == nil {
		return []AIConversationMessageSearchResult{}, fmt.Errorf("配置管理器不可用")
	}
	normalizedQuery := normalizeAIConversationSearchQuery(query)
	if normalizedQuery == "" {
		return []AIConversationMessageSearchResult{}, nil
	}
	normalizedConversationID := strings.TrimSpace(conversationID)
	normalizedLimit := normalizeAIConversationSearchLimit(limit)
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.syncAIConversationSearchIndexLocked(); err != nil {
		return []AIConversationMessageSearchResult{}, err
	}
	db, err := c.getAIConversationSearchDB()
	if err != nil {
		return []AIConversationMessageSearchResult{}, err
	}
	results := make([]AIConversationMessageSearchResult, 0, normalizedLimit)
	seen := make(map[string]struct{}, normalizedLimit)
	if !aiConversationSearchContainsCJK(normalizedQuery) {
		results, err = c.appendAIConversationSearchResultsFromFTS(db, results, seen, normalizedQuery, normalizedConversationID, normalizedLimit)
		if err != nil {
			return []AIConversationMessageSearchResult{}, err
		}
	}
	if len(results) < normalizedLimit {
		results, err = c.appendAIConversationSearchResultsFromLike(db, results, seen, normalizedQuery, normalizedConversationID, normalizedLimit)
		if err != nil {
			return []AIConversationMessageSearchResult{}, err
		}
	}
	return results, nil
}

func (a *Service) SearchAIConversationMessages(query string, conversationID string, limit int) ([]AIConversationMessageSearchResult, error) {
	if a == nil || a.configManager == nil {
		return []AIConversationMessageSearchResult{}, fmt.Errorf("配置管理器不可用")
	}
	return a.configManager.SearchAIConversationMessages(query, conversationID, limit)
}