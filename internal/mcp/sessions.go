package mcp

import "lumeterm/internal/mcpserver"

type activeFileManagerWorkspaceStateProvider interface {
	GetWorkspaceState() string
}

type staleSessionGroupResolver interface {
	StaleSessionConnKey(sessionID string) (string, bool)
}

type SessionProvider struct {
	host Host
}

func NewSessionProvider(host Host) SessionProvider {
	return SessionProvider{host: host}
}

func (p SessionProvider) ListConnectedSessions() ([]mcpserver.SessionDescriptor, error) {
	if p.host == nil {
		return []mcpserver.SessionDescriptor{}, nil
	}
	return p.host.ListSessionDescriptors()
}

// StaleSessionConnKey implements mcpserver.StaleSessionGroupResolver by
// forwarding to the host's closed-terminal → connection mapping.
func (p SessionProvider) StaleSessionConnKey(sessionID string) (string, bool) {
	if resolver, ok := p.host.(staleSessionGroupResolver); ok {
		return resolver.StaleSessionConnKey(sessionID)
	}
	return "", false
}

func (p SessionProvider) GetWorkspaceState() string {
	if provider, ok := p.host.(activeFileManagerWorkspaceStateProvider); ok {
		return provider.GetWorkspaceState()
	}
	return ""
}