package mcpserver

type SessionDescriptor struct {
	SessionID string
	GroupSessionID string
	ConnectionRef string
	ConnectionID string
	// Address 是 user@host:port 形式的服务器地址，用于区分同名服务器。
	Address string
	Tags []string
	SFTPAvailable bool
}

type ConnectedSession struct {
	SessionID string `json:"session_id"`
	GroupSessionID string `json:"group_session_id,omitempty"`
	ConnectionRef string `json:"connection_ref"`
	ConnectionID string `json:"connection_id,omitempty"`
	// Address 是 user@host:port 形式的服务器地址，用于区分同名服务器。
	Address string `json:"address,omitempty"`
	Tags []string `json:"tags,omitempty"`
	SFTPAvailable bool `json:"sftp_available"`
	IsChildTerminal bool `json:"is_child_terminal"`
}

type SessionProvider interface {
	ListConnectedSessions() ([]SessionDescriptor, error)
}

// DisconnectedSessionInfo 描述一个已断开且可一键重连的会话,用于向 AI 返回可操作的错误信息。
type DisconnectedSessionInfo struct {
	// SessionID 是父会话 id,重连时复用。
	SessionID string
	ConnKey   string
	Reason    string
	ClosedAt  string
}

// DisconnectTracker 查询会话是否处于「已断开且可重连」状态。由宿主(sshmanager)实现。
type DisconnectTracker interface {
	LookupDisconnectedSession(sessionID string) (DisconnectedSessionInfo, bool)
}

// ReconnectResult reconnect_server 工具的返回结果。
type ReconnectResult struct {
	SessionID string            `json:"session_id"`
	ConnKey   string            `json:"conn_key,omitempty"`
	// OldToNew 是旧终端 id → 新终端 id 的映射;父会话 id 重连后保持不变。
	OldToNew         map[string]string `json:"old_to_new,omitempty"`
	TerminalCount    int               `json:"terminal_count"`
	AlreadyConnected bool              `json:"already_connected"`
}

// ReconnectProvider 由宿主实现:按断连记录重连会话(复用原父会话 id,重开子终端)。
type ReconnectProvider interface {
	ReconnectDisconnectedSession(sessionID string) (ReconnectResult, error)
}