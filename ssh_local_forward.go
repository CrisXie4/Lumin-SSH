package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"syscall"
	"time"
)

type sshPortForward interface {
	Close() error
	Addr() net.Addr
}

type managedPortForward struct {
	id        string
	kind      string
	connKey   string
	forwarder sshPortForward
}

type PortForwardInfo struct {
	ID         string
	Kind       string
	Addr       string
	LocalAddr  string
	RemoteAddr string
}

// sshLocalPortForwardClient is a minimal interface for the SSH client used by
// local port forwarding. It can open a connection to a remote address through
// the SSH transport.
type sshLocalPortForwardClient interface {
	Dial(network, addr string) (net.Conn, error)
}

// SSHLocalPortForward exposes a local TCP listener and forwards each accepted
// connection to a remote address over an SSH-backed dialer.
//
// This is the client-side equivalent of ssh -L local_host:local_port:remote_host:remote_port.
type SSHLocalPortForward struct {
	listener    net.Listener
	ctx         context.Context
	cancel      context.CancelFunc
	once        sync.Once
	closeErr    error
	remoteAddr  string
	connMu      sync.Mutex
	activeConns map[net.Conn]struct{}
}

// StartSSHLocalPortForward creates a local listener and forwards each accepted
// connection to the given remote address through the SSH client.
//
// This implements the SSH -L behavior: local connections are proxied to a
// service reachable from the remote side.
func StartSSHLocalPortForward(ctx context.Context, client sshLocalPortForwardClient, localAddr, remoteAddr string) (*SSHLocalPortForward, error) {
	if client == nil {
		return nil, errors.New("nil ssh client")
	}
	if localAddr == "" {
		return nil, errors.New("local address is empty")
	}
	if remoteAddr == "" {
		return nil, errors.New("remote address is empty")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		if isAddrInUse(err) {
			return nil, fmt.Errorf("local port already in use: %s", localAddr)
		}
		return nil, fmt.Errorf("listen local addr %q: %w", localAddr, err)
	}

	forwardCtx, cancel := context.WithCancel(ctx)
	forwarder := &SSHLocalPortForward{
		listener:    listener,
		ctx:         forwardCtx,
		cancel:      cancel,
		remoteAddr:  remoteAddr,
		activeConns: make(map[net.Conn]struct{}),
	}

	go forwarder.acceptLoop(client, remoteAddr)
	return forwarder, nil
}

func isAddrInUse(err error) bool {
	if errors.Is(err, syscall.EADDRINUSE) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "address already in use") ||
		strings.Contains(message, "only one usage of each socket address")
}

func (f *SSHLocalPortForward) acceptLoop(client sshLocalPortForwardClient, remoteAddr string) {
	for {
		localConn, err := f.listener.Accept()
		if err != nil {
			select {
			case <-f.ctx.Done():
				return
			default:
				return
			}
		}

		remoteConn, err := client.Dial("tcp", remoteAddr)
		if err != nil {
			_ = localConn.Close()
			continue
		}

		if !f.proxy(localConn, remoteConn) {
			_ = localConn.Close()
			_ = remoteConn.Close()
		}
	}
}

// Addr returns the local listener address.
func (f *SSHLocalPortForward) Addr() net.Addr {
	if f == nil || f.listener == nil {
		return nil
	}
	return f.listener.Addr()
}

// Close stops the forwarder and closes the local listener.
func (f *SSHLocalPortForward) Close() error {
	if f == nil {
		return nil
	}
	f.once.Do(func() {
		if f.cancel != nil {
			f.cancel()
		}
		if f.listener != nil {
			f.closeErr = f.listener.Close()
		}
		f.closeActiveConnections()
	})
	return f.closeErr
}

// proxy starts a tracked copy between two connections. It returns false when
// the forwarder was closed while the connection was being established.
func (f *SSHLocalPortForward) proxy(left, right net.Conn) bool {
	f.connMu.Lock()
	if f.ctx.Err() != nil {
		f.connMu.Unlock()
		return false
	}
	f.activeConns[left] = struct{}{}
	f.activeConns[right] = struct{}{}
	f.connMu.Unlock()

	go func() {
		defer f.removeActiveConnections(left, right)
		proxyConn(left, right)
	}()
	return true
}

func (f *SSHLocalPortForward) removeActiveConnections(conns ...net.Conn) {
	f.connMu.Lock()
	defer f.connMu.Unlock()
	for _, conn := range conns {
		delete(f.activeConns, conn)
	}
}

func (f *SSHLocalPortForward) closeActiveConnections() {
	f.connMu.Lock()
	defer f.connMu.Unlock()
	for conn := range f.activeConns {
		_ = conn.Close()
	}
	clear(f.activeConns)
}

// sshRemotePortForwardClient is a minimal interface for the SSH client used by
// remote port forwarding. It can request the SSH server to listen on a remote
// address and then expose incoming connections to the local target.
type sshRemotePortForwardClient interface {
	Listen(network, addr string) (net.Listener, error)
}

// SSHRemotePortForward exposes a remote TCP listener created by an SSH client
// and forwards each accepted connection to a local address.
//
// This is the client-side equivalent of ssh -R remote_host:remote_port:local_host:local_port.
type SSHRemotePortForward struct {
	listener    net.Listener
	ctx         context.Context
	cancel      context.CancelFunc
	once        sync.Once
	closeErr    error
	localAddr   string
	remoteAddr  string
	connMu      sync.Mutex
	activeConns map[net.Conn]struct{}
}

// StartSSHRemotePortForward creates a remote listener through the SSH client and
// forwards each accepted remote connection to the given local address.
//
// This implements the SSH -R behavior: connections received on the remote side
// are proxied to a local service on the machine running this process.
func StartSSHRemotePortForward(ctx context.Context, client sshRemotePortForwardClient, remoteAddr, localAddr string) (*SSHRemotePortForward, error) {
	if client == nil {
		return nil, errors.New("nil ssh client")
	}
	if remoteAddr == "" {
		return nil, errors.New("remote address is empty")
	}
	if localAddr == "" {
		return nil, errors.New("local address is empty")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	listener, err := client.Listen("tcp", remoteAddr)
	if err != nil {
		return nil, fmt.Errorf("listen remote addr %q: %w", remoteAddr, err)
	}

	forwardCtx, cancel := context.WithCancel(ctx)
	forwarder := &SSHRemotePortForward{
		listener:    listener,
		ctx:         forwardCtx,
		cancel:      cancel,
		localAddr:   localAddr,
		remoteAddr:  remoteAddr,
		activeConns: make(map[net.Conn]struct{}),
	}

	go forwarder.acceptLoop(localAddr)
	return forwarder, nil
}

func (f *SSHRemotePortForward) acceptLoop(localAddr string) {
	for {
		remoteConn, err := f.listener.Accept()
		if err != nil {
			select {
			case <-f.ctx.Done():
				return
			default:
				return
			}
		}

		localConn, err := net.Dial("tcp", localAddr)
		if err != nil {
			_ = remoteConn.Close()
			continue
		}

		if !f.proxy(remoteConn, localConn) {
			_ = remoteConn.Close()
			_ = localConn.Close()
		}
	}
}

func proxyConn(left, right net.Conn) {
	defer left.Close()
	defer right.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_, _ = io.Copy(left, right)
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(right, left)
	}()

	wg.Wait()
}

func (f *SSHRemotePortForward) proxy(left, right net.Conn) bool {
	f.connMu.Lock()
	if f.ctx.Err() != nil {
		f.connMu.Unlock()
		return false
	}
	f.activeConns[left] = struct{}{}
	f.activeConns[right] = struct{}{}
	f.connMu.Unlock()

	go func() {
		defer f.removeActiveConnections(left, right)
		proxyConn(left, right)
	}()
	return true
}

func (f *SSHRemotePortForward) removeActiveConnections(conns ...net.Conn) {
	f.connMu.Lock()
	defer f.connMu.Unlock()
	for _, conn := range conns {
		delete(f.activeConns, conn)
	}
}

func (f *SSHRemotePortForward) closeActiveConnections() {
	f.connMu.Lock()
	defer f.connMu.Unlock()
	for conn := range f.activeConns {
		_ = conn.Close()
	}
	clear(f.activeConns)
}

func (m *SSHManager) StartLocalPortForward(connKey, localAddr, remoteAddr string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry, ok := m.clients[connKey]
	if !ok || entry == nil || entry.Client == nil {
		return "", errors.New("ssh client not found")
	}

	forwarder, err := StartSSHLocalPortForward(context.Background(), entry.Client, localAddr, remoteAddr)
	if err != nil {
		return "", err
	}

	id := fmt.Sprintf("lf-%d", time.Now().UnixNano())
	m.portForwards[id] = &managedPortForward{id: id, kind: "local", connKey: connKey, forwarder: forwarder}
	return id, nil
}

func (m *SSHManager) StartRemotePortForward(connKey, remoteAddr, localAddr string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry, ok := m.clients[connKey]
	if !ok || entry == nil || entry.Client == nil {
		return "", errors.New("ssh client not found")
	}

	forwarder, err := StartSSHRemotePortForward(context.Background(), entry.Client, remoteAddr, localAddr)
	if err != nil {
		return "", err
	}

	id := fmt.Sprintf("rf-%d", time.Now().UnixNano())
	m.portForwards[id] = &managedPortForward{id: id, kind: "remote", connKey: connKey, forwarder: forwarder}
	return id, nil
}

func (m *SSHManager) StopPortForward(id string) error {
	m.mu.Lock()
	entry, ok := m.portForwards[id]
	if !ok || entry == nil {
		m.mu.Unlock()
		return errors.New("port forward not found")
	}
	delete(m.portForwards, id)
	m.mu.Unlock()

	if entry.forwarder == nil {
		return nil
	}
	return entry.forwarder.Close()
}

func (m *SSHManager) ListPortForwards() []PortForwardInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]PortForwardInfo, 0, len(m.portForwards))
	for _, entry := range m.portForwards {
		info := PortForwardInfo{ID: entry.id, Kind: entry.kind}
		if entry.forwarder != nil {
			if addr := entry.forwarder.Addr(); addr != nil {
				info.Addr = addr.String()
			}
		}
		if entry.forwarder != nil {
			switch entry.kind {
			case "local":
				if forwarder, ok := entry.forwarder.(*SSHLocalPortForward); ok {
					info.LocalAddr = info.Addr
					info.RemoteAddr = forwarder.remoteAddr
				}
			case "remote":
				if forwarder, ok := entry.forwarder.(*SSHRemotePortForward); ok {
					info.LocalAddr = forwarder.localAddr
					info.RemoteAddr = info.Addr
				}
			}
		}
		infos = append(infos, info)
	}
	return infos
}

func (m *SSHManager) ListPortForwardsForSession(sessionId string) ([]PortForwardInfo, error) {
	m.mu.RLock()
	s, ok := m.sessions[sessionId]
	if !ok {
		m.mu.RUnlock()
		return nil, fmt.Errorf("session not found")
	}
	connKey := s.ConnKey
	m.mu.RUnlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]PortForwardInfo, 0, len(m.portForwards))
	for _, entry := range m.portForwards {
		if entry == nil || entry.connKey != connKey {
			continue
		}
		info := PortForwardInfo{ID: entry.id, Kind: entry.kind}
		if entry.forwarder != nil {
			if addr := entry.forwarder.Addr(); addr != nil {
				info.Addr = addr.String()
			}
		}
		switch entry.kind {
		case "local":
			if forwarder, ok := entry.forwarder.(*SSHLocalPortForward); ok {
				info.LocalAddr = info.Addr
				info.RemoteAddr = forwarder.remoteAddr
			}
		case "remote":
			if forwarder, ok := entry.forwarder.(*SSHRemotePortForward); ok {
				info.LocalAddr = forwarder.localAddr
				info.RemoteAddr = info.Addr
			}
		}
		infos = append(infos, info)
	}
	return infos, nil
}

// Addr returns the remote listener address.
func (f *SSHRemotePortForward) Addr() net.Addr {
	if f == nil || f.listener == nil {
		return nil
	}
	return f.listener.Addr()
}

// Close stops the forwarder and closes the remote listener.
func (f *SSHRemotePortForward) Close() error {
	if f == nil {
		return nil
	}
	f.once.Do(func() {
		if f.cancel != nil {
			f.cancel()
		}
		if f.listener != nil {
			f.closeErr = f.listener.Close()
		}
		f.closeActiveConnections()
	})
	return f.closeErr
}
