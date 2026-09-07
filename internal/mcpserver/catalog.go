package mcpserver

import (
	"context"
	"fmt"
	"strings"
)

type ToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

type Catalog struct {
	service            *Service
	fileProvider       FileProvider
	commandProvider    CommandProvider
	remoteEditExecutor RemoteEditExecutor
	transferProvider   TransferProvider
	reporter           ActivityReporter
	callCtx            context.Context
	// disconnectTracker/reconnectProvider 支撑断线重连流程:工具调用命中已断开会话时
	// 返回指引性错误,并由 reconnect_server 工具代为重连。均为可选能力,未注入时
	// 相关工具不下发、不做拦截。
	disconnectTracker DisconnectTracker
	reconnectProvider ReconnectProvider
}

func NewCatalog(service *Service, fileProvider FileProvider, commandProvider CommandProvider, remoteEditExecutor RemoteEditExecutor, transferProviders ...TransferProvider) *Catalog {
	var transferProvider TransferProvider
	if len(transferProviders) > 0 {
		transferProvider = transferProviders[0]
	}
	return &Catalog{
		service:            service,
		fileProvider:       fileProvider,
		commandProvider:    commandProvider,
		remoteEditExecutor: remoteEditExecutor,
		transferProvider:   transferProvider,
		reporter:           NoopReporter(),
		callCtx:            context.Background(),
	}
}

// SetReporter sets the activity reporter used to emit per-call activity events.
// Must be called before the catalog serves any requests.
func (c *Catalog) SetReporter(reporter ActivityReporter) {
	if c == nil {
		return
	}
	if reporter != nil {
		c.reporter = reporter
	}
}

// SetDisconnectTracker 注入断连查询能力;注入后,指向已断开会话的工具调用会收到
// 指引调用 reconnect_server 的错误,而不是模糊的 session not found。
func (c *Catalog) SetDisconnectTracker(tracker DisconnectTracker) {
	if c == nil {
		return
	}
	if tracker != nil {
		c.disconnectTracker = tracker
	}
}

// SetReconnectProvider 注入重连能力;注入后 reconnect_server 工具才会出现在工具目录里。
func (c *Catalog) SetReconnectProvider(provider ReconnectProvider) {
	if c == nil {
		return
	}
	if provider != nil {
		c.reconnectProvider = provider
	}
}

func (c *Catalog) List() []ToolDefinition {
	definitions := []ToolDefinition{
		listConnectedSessionsToolDefinition(),
		getWorkPathToolDefinition(),
		listFilesToolDefinition(),
		readFileToolDefinition(),
		writeToFileToolDefinition(),
		transferBatchToolDefinition(),
		transferListToolDefinition(),
		executeCommandToolDefinition(),
		attemptCompletionToolDefinition(),
		searchReplaceToolDefinition(),
		editFileToolDefinition(),
		applyDiffToolDefinition(),
		applyPatchToolDefinition(),
	}
	// 重连工具只在宿主提供重连能力时下发,避免内置 AI 等无重连能力的调用方看到不可用工具。
	if c != nil && c.reconnectProvider != nil {
		definitions = append(definitions, reconnectServerToolDefinition())
	}
	return definitions
}

func (c *Catalog) Call(name string, arguments map[string]any) (any, error) {
	return c.CallWithContext(context.Background(), name, arguments)
}

func (c *Catalog) CallWithContext(ctx context.Context, name string, arguments map[string]any) (any, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	reporter := c.reporter
	if reporter == nil {
		reporter = NoopReporter()
	}
	clientName := ClientNameFromContext(ctx)
	ctx = ContextWithActivity(ctx, reporter, clientName)

	clone := *c
	clone.callCtx = ctx

	// execute_command emits its own full lifecycle via the command provider.
	if name == "execute_command" {
		if err := clone.checkSessionDisconnected(extractSessionID(arguments)); err != nil {
			return nil, err
		}
		return clone.callExecuteCommand(arguments)
	}

	// For all other tools, emit a catalog-level start/done envelope.
	sessionID := extractSessionID(arguments)
	serverName := clone.resolveServerName(sessionID)
	requestID := NewRequestID()
	isMutating := isMutatingTool(name)

	baseEvent := ActivityEvent{
		RequestID:  requestID,
		Source:     ActivitySourceExternalMCP,
		ClientName: clientName,
		Tool:       name,
		SessionID:  sessionID,
		ServerName: serverName,
		IsMutating: isMutating,
		Command:    extractToolTarget(name, arguments),
	}

	// 断连拦截:命中已断开的会话时直接返回指引性错误(而非底层报错),
	// 让 AI 知道应调用 reconnect_server 重连。list_connected_sessions 与
	// reconnect_server 自身豁免。
	if name != "list_connected_sessions" && name != "reconnect_server" {
		if err := clone.checkSessionDisconnected(sessionID); err != nil {
			reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusError, err.Error(), nil))
			return nil, err
		}
	}

	reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusStarted, "", nil))

	// 写操作审批门：与 execute_command 的 isMutating 审批对齐，
	// 覆盖 write_to_file / search_replace / apply_diff / edit_file / apply_patch / transfer_batch。
	if isMutating {
		approvalEvent := baseEvent
		approvalEvent.Status = ActivityStatusApprovalRequired
		approvalEvent.Timestamp = Now()
		approved, err := reporter.RequestApproval(approvalEvent)
		if err != nil {
			reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusError, "approval error: "+err.Error(), nil))
			return nil, err
		}
		if !approved {
			reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusRejected, "rejected by user", nil))
			return nil, fmt.Errorf("%s rejected by user", name)
		}
		reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusApproved, "", nil))
	}

	result, err := clone.dispatchTool(name, arguments)
	if err != nil {
		reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusError, err.Error(), nil))
		return nil, err
	}
	reporter.ReportActivity(fillTimestamp(baseEvent, ActivityStatusDone, "", nil))
	return result, nil
}

func (c *Catalog) dispatchTool(name string, arguments map[string]any) (any, error) {
	switch name {
	case "list_connected_sessions":
		return c.callListConnectedSessions(arguments)
	case "reconnect_server":
		return c.callReconnectServer(arguments)
	case "get_work_path":
		return c.callGetWorkPath(arguments)
	case "list_files":
		return c.callListFiles(arguments)
	case "read_file":
		return c.callReadFile(arguments)
	case "write_to_file":
		return c.callWriteToFile(arguments)
	case "transfer_batch":
		return c.callTransferBatch(arguments)
	case "transfer_list":
		return c.callTransferList(arguments)
	case "attempt_completion":
		return c.callAttemptCompletion(arguments)
	case "search_replace":
		return c.callSearchReplace(arguments)
	case "apply_diff":
		return c.callApplyDiff(arguments)
	case "edit_file":
		return c.callEditFile(arguments)
	case "apply_patch":
		return c.callApplyPatch(arguments)
	default:
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
}

func extractSessionID(arguments map[string]any) string {
	if arguments == nil {
		return ""
	}
	value, ok := arguments["session_id"]
	if !ok {
		return ""
	}
	text, _ := value.(string)
	return text
}

// isMutatingTool reports whether a tool modifies the remote server or transfers
// files. These tools are gated by the MCPRequireApproval setting, matching the
// isMutating approval already applied to execute_command.
func isMutatingTool(name string) bool {
	switch name {
	case "write_to_file", "search_replace", "apply_diff", "edit_file", "apply_patch", "transfer_batch":
		return true
	default:
		return false
	}
}

// extractToolTarget returns a short human-readable description of the target
// (file path or transfer direction) for display in the activity panel.
func extractToolTarget(name string, arguments map[string]any) string {
	if arguments == nil {
		return ""
	}
	// 文件编辑类工具：取 path 参数
	if path, ok := arguments["path"].(string); ok && path != "" {
		return path
	}
	// transfer_batch：取 operation + remote_parent
	if name == "transfer_batch" {
		op, _ := arguments["operation"].(string)
		parent, _ := arguments["remote_parent"].(string)
		if op != "" && parent != "" {
			return op + " → " + parent
		}
		if op != "" {
			return op
		}
	}
	return ""
}

// checkSessionDisconnected 在会话命中断连记录时返回指引性错误,引导 AI 调用
// reconnect_server 重连后再重试。未注入 tracker 或会话正常时返回 nil。
func (c *Catalog) checkSessionDisconnected(sessionID string) error {
	if c == nil || c.disconnectTracker == nil {
		return nil
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	info, dead := c.disconnectTracker.LookupDisconnectedSession(sessionID)
	if !dead {
		return nil
	}
	return fmt.Errorf(
		"会话 %s 对应的 SSH 服务器已断开连接 (reason=%s, closedAt=%s)。请先调用 reconnect_server 工具 (session_id=%s) 重连, 成功后再重试本操作。/ The SSH server for session %s is disconnected; call the reconnect_server tool with session_id=%s first, then retry.",
		sessionID, info.Reason, info.ClosedAt, info.SessionID, sessionID, info.SessionID,
	)
}

func (c *Catalog) resolveServerName(sessionID string) string {
	if c == nil || c.service == nil || sessionID == "" {
		return ""
	}
	session, err := c.service.GetConnectedSession(sessionID)
	if err != nil {
		return ""
	}
	if len(session.Tags) > 0 {
		return session.Tags[0]
	}
	return session.ConnectionRef
}

func fillTimestamp(base ActivityEvent, status ActivityStatus, output string, exitCode *int) ActivityEvent {
	base.Status = status
	base.Output = output
	base.ExitCode = exitCode
	base.Timestamp = Now()
	return base
}
