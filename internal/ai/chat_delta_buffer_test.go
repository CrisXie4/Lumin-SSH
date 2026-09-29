package ai

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"
)

// 捕获真实发出的事件。Service.ctx 为 nil 时 emitAIChatEventRaw 不发事件，
// 所以这里用一个哨兵 ctx 撑过 nil 判断，再把发出的 payload 记下来。
type aiDeltaEventRecorder struct {
	mu      sync.Mutex
	emitted []map[string]interface{}
}

func (r *aiDeltaEventRecorder) record(payload map[string]interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.emitted = append(r.emitted, payload)
}

func (r *aiDeltaEventRecorder) snapshot() []map[string]interface{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]map[string]interface{}, len(r.emitted))
	copy(result, r.emitted)
	return result
}

// 把真实投递点换成录制器，避免依赖 Wails 运行时；测试结束恢复。
func captureAIEmittedEvents(t *testing.T) *aiDeltaEventRecorder {
	t.Helper()
	recorder := &aiDeltaEventRecorder{}
	previous := emitAIChatEventSink
	emitAIChatEventSink = func(ctx context.Context, payload map[string]interface{}) {
		recorder.record(payload)
	}
	t.Cleanup(func() {
		emitAIChatEventSink = previous
	})
	return recorder
}

// contextWithSentinel 返回一个可用但未超时的 ctx：Service.ctx 为 nil 时不会投递事件。
func contextWithSentinel() context.Context {
	ctx, cancel := context.WithCancel(context.Background())
	runtimeCleanupCancels = append(runtimeCleanupCancels, cancel)
	return ctx
}

var runtimeCleanupCancels []context.CancelFunc

// 多轮对话的完整文字必须逐字无损、且按到达顺序到达。
func TestAIDeltaBufferStreamTextIsLosslessAndOrdered(t *testing.T) {
	recorder := captureAIEmittedEvents(t)
	service := &Service{ctx: contextWithSentinel()}

	// 模拟两轮：第一轮 reasoning 与 content 交替，第二轮纯 content
	segments := []aiDeltaChunk{
		{kind: "reasoning_delta", text: "先想一下"},
		{kind: "reasoning_delta", text: "再确认环境"},
		{kind: "delta", text: "好的，我来"},
		{kind: "delta", text: "检查 nginx。"},
		{kind: "reasoning_delta", text: "补充一点"},
		{kind: "delta", text: " 已处理完成。"},
	}
	for _, segment := range segments {
		service.bufferAIChatDelta("req-1", segment.kind, segment.text)
	}
	// 轮次收尾：下一个非 delta 事件前必须把待发文本冲干净
	service.flushAIDeltaBuffer("req-1")

	// 按 kind 分别还原文本，校验逐字无损
	got := map[string]string{}
	for _, payload := range recorder.snapshot() {
		kind, _ := payload["kind"].(string)
		delta, _ := payload["delta"].(string)
		got[kind] += delta
	}
	wantReasoning := "先想一下再确认环境补充一点"
	wantContent := "好的，我来检查 nginx。 已处理完成。"
	if got["reasoning_delta"] != wantReasoning {
		t.Fatalf("思考文本不符:\n实得 %q\n期望 %q", got["reasoning_delta"], wantReasoning)
	}
	if got["delta"] != wantContent {
		t.Fatalf("正文不符:\n实得 %q\n期望 %q", got["delta"], wantContent)
	}

	// 顺序校验：把事件流压平成 kind 序列，必须与到达顺序一致（相邻同类已合并）
	var kinds []string
	for _, payload := range recorder.snapshot() {
		kind, _ := payload["kind"].(string)
		if index := len(kinds); index > 0 && kinds[index-1] == kind {
			continue
		}
		kinds = append(kinds, kind)
	}
	wantKinds := []string{"reasoning_delta", "delta", "reasoning_delta", "delta"}
	if strings.Join(kinds, ",") != strings.Join(wantKinds, ",") {
		t.Fatalf("事件顺序错乱: 实得 %v 期望 %v", kinds, wantKinds)
	}
}

// 取消时机下的尾部文字：取消发生在 SSE 循环内，此时可能还有攒在 16ms 窗口里、
// 尚未发出的尾部片段。CancelAIChat 会发 cancelled 终态事件，而 emitAIChatEvent
// 对非 delta 事件会先冲刷 —— 因此已产生的文字必须在 cancelled 之前全部到达前端。
func TestAIDeltaBufferCancelFlushesTailTextBeforeCancelled(t *testing.T) {
	recorder := captureAIEmittedEvents(t)
	service := &Service{ctx: contextWithSentinel()}
	requestID := "req-cancel"

	// 首片段立即发出，之后的短片段进入 16ms 合并窗口（模拟被取消时攒着的尾部）
	service.emitAIChatEvent(map[string]interface{}{"kind": "delta", "requestId": requestID, "delta": "已完成前两步，"})
	service.emitAIChatEvent(map[string]interface{}{"kind": "delta", "requestId": requestID, "delta": "第三步正在执行"})
	service.emitAIChatEvent(map[string]interface{}{"kind": "delta", "requestId": requestID, "delta": "时被用户取消。"})

	// 取消：与后端 CancelAIChat 一致，先发 runtime_phase 再发 cancelled
	service.emitAIChatEvent(map[string]interface{}{"kind": "runtime_phase", "requestId": requestID, "phase": "ready"})
	service.emitAIChatEvent(map[string]interface{}{"kind": "cancelled", "requestId": requestID})

	events := recorder.snapshot()

	// 定位 cancelled 的位置：所有 delta 必须排在它之前
	cancelledIndex := -1
	for index, payload := range events {
		if kind, _ := payload["kind"].(string); kind == "cancelled" {
			cancelledIndex = index
			break
		}
	}
	if cancelledIndex < 0 {
		t.Fatal("未收到 cancelled 事件")
	}
	for index, payload := range events {
		if index >= cancelledIndex {
			break
		}
		if kind, _ := payload["kind"].(string); kind == "delta" {
			continue
		}
		if kind, _ := payload["kind"].(string); kind != "delta" && kind != "runtime_phase" {
			t.Fatalf("cancelled 之前混入了意外事件 %q", kind)
		}
	}

	// 尾部文字必须逐字无损，且在 cancelled 之前已全部发出
	streamed := ""
	for index, payload := range events {
		if index >= cancelledIndex {
			break
		}
		if kind, _ := payload["kind"].(string); kind != "delta" {
			continue
		}
		delta, _ := payload["delta"].(string)
		streamed += delta
	}
	want := "已完成前两步，第三步正在执行时被用户取消。"
	if streamed != want {
		t.Fatalf("取消时尾部文字丢失:\n实得 %q\n期望 %q", streamed, want)
	}

	// cancelled 之后不得再有任何 delta（缓冲必须已清空，不能延迟补发）
	for index, payload := range events {
		if index <= cancelledIndex {
			continue
		}
		if kind, _ := payload["kind"].(string); kind == "delta" {
			t.Fatalf("cancelled 之后仍补发 delta: %q", payload["delta"])
		}
	}
	if len(service.aiDeltaBuf) != 0 {
		t.Fatalf("取消后缓冲槽位应已释放, 残留 %d 项", len(service.aiDeltaBuf))
	}
}

// 并发冲刷不得交错：一次冲刷取出的片段必须整批连续发出。
// 定时冲刷跑在独立 goroutine，若「取片段」与「发送」不在同一临界区内，
// 它会与 SSE 读取协程的立即冲刷交错投递，前端收到即文字错序。
// 这里让 sink 慢速投递以拉大交错窗口，并把 kind 交替开，使错序可被观测。
func TestAIDeltaBufferConcurrentFlushKeepsOrder(t *testing.T) {
	service := &Service{ctx: contextWithSentinel()}
	var mu sync.Mutex
	var batches []string
	previous := emitAIChatEventSink
	emitAIChatEventSink = func(ctx context.Context, payload map[string]interface{}) {
		time.Sleep(time.Millisecond)
		mu.Lock()
		defer mu.Unlock()
		kind, _ := payload["kind"].(string)
		delta, _ := payload["delta"].(string)
		batches = append(batches, kind+":"+delta)
	}
	t.Cleanup(func() { emitAIChatEventSink = previous })

	var wg sync.WaitGroup
	// 一路：交替喂 reasoning / content，并触发「超长立即冲刷」（在调用方协程内发出）
	wg.Add(1)
	go func() {
		defer wg.Done()
		for index := 0; index < 40; index++ {
			kind := "delta"
			if index%2 == 0 {
				kind = "reasoning_delta"
			}
			service.bufferAIChatDelta("req-concurrent", kind, "片")
			time.Sleep(time.Millisecond)
		}
	}()
	// 另一路：与 16ms 定时冲刷竞争的显式收尾冲刷
	wg.Add(1)
	go func() {
		defer wg.Done()
		for index := 0; index < 20; index++ {
			time.Sleep(time.Millisecond)
			service.flushAIDeltaBuffer("req-concurrent")
		}
	}()
	wg.Wait()
	service.flushAIDeltaBuffer("req-concurrent")

	mu.Lock()
	defer mu.Unlock()
	// 错序判据：一次冲刷内的相邻同类片段必然已合并；若两次冲刷交错投递，
	// 就会出现「同一 kind 被拆成多个不相邻批次」以外的异常重复 kind 段。
	// 这里用一个更强的判据：把事件流还原成 kind 序列，相邻重复即说明交错。
	var kinds []string
	for _, batch := range batches {
		kind := strings.SplitN(batch, ":", 2)[0]
		kinds = append(kinds, kind)
	}
	for index := 1; index < len(kinds); index++ {
		if kinds[index] == kinds[index-1] {
			t.Fatalf("第 %d 个事件与前一个同类，说明两次冲刷交错投递: %v", index, kinds)
		}
	}

	total := 0
	for _, batch := range batches {
		total += len([]rune(strings.SplitN(batch, ":", 2)[1]))
	}
	if total != 40 {
		t.Fatalf("并发冲刷后文本总量 = %d, 期望 40（丢字或重复）", total)
	}
}

func TestMergeAIDeltaChunksKeepsOrderAndKind(t *testing.T) {
	chunks := []aiDeltaChunk{
		{kind: "reasoning_delta", text: "思考"},
		{kind: "reasoning_delta", text: "中"},
		{kind: "delta", text: "正文"},
		{kind: "delta", text: "一"},
		{kind: "delta", text: "二"},
		{kind: "reasoning_delta", text: "再想"},
	}
	merged := mergeAIDeltaChunks(chunks)
	if len(merged) != 3 {
		t.Fatalf("合并后片段数 = %d, 期望 3", len(merged))
	}
	expected := []aiDeltaChunk{
		{kind: "reasoning_delta", text: "思考中"},
		{kind: "delta", text: "正文一二"},
		{kind: "reasoning_delta", text: "再想"},
	}
	for index := range expected {
		if merged[index] != expected[index] {
			t.Fatalf("片段 %d = %+v, 期望 %+v", index, merged[index], expected[index])
		}
	}
}

func TestMergeAIDeltaChunksEmpty(t *testing.T) {
	if got := mergeAIDeltaChunks(nil); len(got) != 0 {
		t.Fatalf("空输入应返回空结果, 实际 %d", len(got))
	}
}

// 无 ctx 的 Service 不会真的发事件，正好用来验证缓冲/冲刷的记账行为。
func TestAIDeltaBufferFlushClearsPending(t *testing.T) {
	service := &Service{}
	requestID := "req-1"

	service.bufferAIChatDelta(requestID, "delta", "首字")
	// 首片段立即冲刷，缓冲里不应残留待发片段
	buffer := service.aiDeltaBuf[requestID]
	if buffer == nil || !buffer.started || len(buffer.chunks) != 0 {
		t.Fatalf("首片段应已立即冲刷且标记 started, 实际 %+v", buffer)
	}

	service.bufferAIChatDelta(requestID, "delta", "第二段")
	service.bufferAIChatDelta(requestID, "delta", "第三段")
	buffer = service.aiDeltaBuf[requestID]
	if buffer == nil || len(buffer.chunks) != 2 {
		t.Fatalf("后续片段应进入缓冲, 实际 %+v", buffer)
	}

	service.flushAIDeltaBuffer(requestID)
	if len(service.aiDeltaBuf) != 0 {
		t.Fatalf("冲刷后缓冲槽位应释放, 残留 %d 项", len(service.aiDeltaBuf))
	}
	// 空 requestID / 空缓冲重复冲刷必须安全
	service.flushAIDeltaBuffer("")
	service.flushAIDeltaBuffer(requestID)
}

func TestIsAIChatDeltaEventKind(t *testing.T) {
	cases := map[string]bool{
		"delta":                         true,
		"reasoning_delta":               true,
		"collaboration_delta":           true,
		"collaboration_reasoning_delta": true,
		"runtime_phase":                 false,
		"assistant_replace":             false,
		"cancelled":                     false,
	}
	for kind, expected := range cases {
		if got := isAIChatDeltaEventKind(kind); got != expected {
			t.Fatalf("%q = %v, 期望 %v", kind, got, expected)
		}
	}
	if !strings.HasSuffix("collaboration_reasoning_delta", "delta") {
		t.Fatal("前置假设失效: 协同 delta 事件名不再以 delta 结尾")
	}
}
