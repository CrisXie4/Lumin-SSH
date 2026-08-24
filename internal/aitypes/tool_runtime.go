package aitypes

type ToolExecutionAction string

const (
	ToolExecutionActionNone      ToolExecutionAction = ""
	ToolExecutionActionContinue  ToolExecutionAction = "continue"
	ToolExecutionActionTerminate ToolExecutionAction = "terminate"
)

type AIChatCommandTerminalCandidate struct {
	SessionID   string `json:"sessionId"`
	Busy        bool   `json:"busy"`
	Cwd         string `json:"cwd"`
	Current     bool   `json:"current"`
	Recommended bool   `json:"recommended"`
}
