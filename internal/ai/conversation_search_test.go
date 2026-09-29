package ai

import (
	"testing"
)

// 增量索引必须覆盖三种变化：新增、内容修改、删除（含"不再可索引"）。
func TestReplaceAIConversationSearchRowsLockedIncremental(t *testing.T) {
	bridge := &configBridge{configDir: t.TempDir()}
	db, err := bridge.getAIConversationSearchDB()
	if err != nil {
		t.Fatalf("打开搜索库失败: %v", err)
	}
	// Windows 上打开的连接会锁住 db 文件，不关闭会让 TempDir 清理失败
	defer db.Close()

	applySnapshot := func(snapshot AIConversationSnapshot) {
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("开启事务失败: %v", err)
		}
		if err := bridge.ensureAIConversationSearchSchemaLocked(tx); err != nil {
			t.Fatalf("建表失败: %v", err)
		}
		if err := bridge.replaceAIConversationSearchRowsLocked(tx, snapshot); err != nil {
			t.Fatalf("写入索引失败: %v", err)
		}
		if err := tx.Commit(); err != nil {
			t.Fatalf("提交失败: %v", err)
		}
	}
	readBodies := func() map[string]string {
		rows, err := db.Query(`SELECT message_id, body FROM ai_conversation_message_index WHERE conversation_id = ?`, "conv-1")
		if err != nil {
			t.Fatalf("读取索引失败: %v", err)
		}
		defer rows.Close()
		result := map[string]string{}
		for rows.Next() {
			var messageID, body string
			if err := rows.Scan(&messageID, &body); err != nil {
				t.Fatalf("扫描索引失败: %v", err)
			}
			result[messageID] = body
		}
		return result
	}
	countFTS := func() int {
		var total int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ai_conversation_message_fts WHERE conversation_id = ?`, "conv-1").Scan(&total); err != nil {
			t.Fatalf("统计 FTS 失败: %v", err)
		}
		return total
	}
	readTitles := func() map[string]string {
		rows, err := db.Query(`SELECT message_id, conversation_title FROM ai_conversation_message_index WHERE conversation_id = ?`, "conv-1")
		if err != nil {
			t.Fatalf("读取索引标题失败: %v", err)
		}
		defer rows.Close()
		result := map[string]string{}
		for rows.Next() {
			var messageID, title string
			if err := rows.Scan(&messageID, &title); err != nil {
				t.Fatalf("扫描索引标题失败: %v", err)
			}
			result[messageID] = title
		}
		return result
	}
	readTimestamps := func() map[string]int64 {
		rows, err := db.Query(`SELECT message_id, updated_at FROM ai_conversation_message_index WHERE conversation_id = ?`, "conv-1")
		if err != nil {
			t.Fatalf("读取索引时间戳失败: %v", err)
		}
		defer rows.Close()
		result := map[string]int64{}
		for rows.Next() {
			var messageID string
			var updatedAt int64
			if err := rows.Scan(&messageID, &updatedAt); err != nil {
				t.Fatalf("扫描索引时间戳失败: %v", err)
			}
			result[messageID] = updatedAt
		}
		return result
	}

	first := AIConversationSnapshot{
		ID:    "conv-1",
		Title: "会话一",
		Messages: []AIConversationMessage{
			{ID: "m1", Kind: "user", Text: "第一条提问"},
			{ID: "m2", Kind: "assistant", Text: "第一条回答"},
			// kind 不在可索引范围内，应被忽略
			{ID: "m3", Kind: "tool", Text: "工具输出"},
		},
	}
	applySnapshot(first)
	bodies := readBodies()
	if len(bodies) != 2 || bodies["m1"] != "第一条提问" || bodies["m2"] != "第一条回答" {
		t.Fatalf("首次索引结果不符: %+v", bodies)
	}
	if got := countFTS(); got != 2 {
		t.Fatalf("首次 FTS 行数 = %d, 期望 2", got)
	}

	second := AIConversationSnapshot{
		ID:    "conv-1",
		Title: "会话一",
		Messages: []AIConversationMessage{
			{ID: "m1", Kind: "user", Text: "第一条提问（已编辑）"},
			{ID: "m2", Kind: "assistant", Text: "第一条回答"},
			{ID: "m4", Kind: "assistant", Text: "第二条回答"},
		},
	}
	applySnapshot(second)
	bodies = readBodies()
	if len(bodies) != 3 {
		t.Fatalf("增量后索引条数 = %d, 期望 3", len(bodies))
	}
	if bodies["m1"] != "第一条提问（已编辑）" {
		t.Fatalf("编辑后的消息未同步到索引: %q", bodies["m1"])
	}
	if bodies["m2"] != "第一条回答" || bodies["m4"] != "第二条回答" {
		t.Fatalf("未变化/新增消息索引错误: %+v", bodies)
	}
	if got := countFTS(); got != 3 {
		t.Fatalf("增量后 FTS 行数 = %d, 期望 3（编辑的行不能被重复插入）", got)
	}

	// 删除 m1/m4，只留 m2
	third := AIConversationSnapshot{
		ID:    "conv-1",
		Title: "会话一",
		Messages: []AIConversationMessage{
			{ID: "m2", Kind: "assistant", Text: "第一条回答"},
		},
	}
	applySnapshot(third)
	bodies = readBodies()
	if len(bodies) != 1 || bodies["m2"] != "第一条回答" {
		t.Fatalf("删除后索引错误: %+v", bodies)
	}
	if got := countFTS(); got != 1 {
		t.Fatalf("删除后 FTS 行数 = %d, 期望 1", got)
	}

	// 改名：索引里的 conversation_title 必须同步（title 参与变化判断）
	renamed := AIConversationSnapshot{
		ID:        "conv-1",
		Title:     "改名后的会话",
		UpdatedAt: 1000,
		Messages:  third.Messages,
	}
	applySnapshot(renamed)
	titles := readTitles()
	if len(titles) != 1 || titles["m2"] != "改名后的会话" {
		t.Fatalf("改名后索引标题未同步: %+v", titles)
	}
	// 时间戳变化：所有行的 updated_at 统一刷新为快照时间（保持会话级排序语义）
	timestamps := readTimestamps()
	if len(timestamps) != 1 || timestamps["m2"] != 1000 {
		t.Fatalf("时间戳未统一刷新: %+v", timestamps)
	}
}

func TestReplaceAIConversationSearchRowsLockedRequiresConversationID(t *testing.T) {
	bridge := &configBridge{configDir: t.TempDir()}
	db, err := bridge.getAIConversationSearchDB()
	if err != nil {
		t.Fatalf("打开搜索库失败: %v", err)
	}
	defer db.Close()
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("开启事务失败: %v", err)
	}
	defer tx.Rollback()
	if err := bridge.ensureAIConversationSearchSchemaLocked(tx); err != nil {
		t.Fatalf("建表失败: %v", err)
	}
	if err := bridge.replaceAIConversationSearchRowsLocked(tx, AIConversationSnapshot{}); err == nil {
		t.Fatal("缺少对话 ID 时应报错")
	}
}
