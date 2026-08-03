package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
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
	id         string
	kind       string
	connKey    string
	serverId   string
	localHost  string
	localPort  string
	remoteHost string
	remotePort string
	enabled    bool
	forwarder  sshPortForward
}

type PortForwardInfo struct {
	ID         string
	Kind       string
	Addr       string
	LocalAddr  string
	RemoteAddr string
	LocalHost  string
	LocalPort  string
	RemoteHost string
	RemotePort string
	Enabled    bool
}

func splitHostPortLoose(addr string) (string, string) {
	trimmed := strings.TrimSpace(addr)
	if trimmed == "" {
		return "", ""
	}
	idx := strings.LastIndex(trimmed, ":")
	if idx < 0 {
		return trimmed, ""
	}
	host := strings.Trim(trimmed[:idx], "[]")
	return host, trimmed[idx+1:]
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

// serverIdForConnKey 端口映射持久化按 serverId 分组; 当前 connKey 即为 Connection.ID(见 Connect),
// 故直接复用。若未来 connKey 语义变化, 只需改这里的映射。
func (m *SSHManager) serverIdForConnKey(connKey string) string {
	return connKey
}

// stopPortForwardsForConnKey 将某连接下所有运行态端口映射转为已停止态(关闭真实监听, 保留记录)。
// 用于 SSH 连接生命周期结束(断连/keepalive 失败/用户关闭最后一个终端)时自动回收监听器,
// 避免本地端口被泄漏占用; 转为已停止态而非删除, 保持"停止不删记录"语义, 重连后可重启。
// 调用方不得持有 m.mu。幂等: 已停止的 entry 会被跳过。
func (m *SSHManager) ensurePersistedPortForwardsLoadedForConnKey(connKey string) {
	if strings.TrimSpace(connKey) == "" || m.app == nil || m.app.configManager == nil {
		return
	}
	serverId := m.serverIdForConnKey(connKey)
	if strings.TrimSpace(serverId) == "" {
		return
	}
	persisted := m.app.configManager.GetPortForwards(serverId)
	if len(persisted) == 0 {
		return
	}
	persistNeeded := false
	m.mu.Lock()
	for _, item := range persisted {
		if strings.TrimSpace(item.ID) == "" {
			continue
		}
		if _, exists := m.portForwards[item.ID]; exists {
			continue
		}
		if item.Enabled {
			persistNeeded = true
		}
		m.portForwards[item.ID] = &managedPortForward{
			id:         item.ID,
			kind:       item.Kind,
			connKey:    connKey,
			serverId:   serverId,
			localHost:  item.LocalHost,
			localPort:  item.LocalPort,
			remoteHost: item.RemoteHost,
			remotePort: item.RemotePort,
			enabled:    false,
			forwarder:  nil,
		}
	}
	m.mu.Unlock()
	if persistNeeded {
		m.persistPortForwardsForServer(serverId)
	}
}

func (m *SSHManager) stopPortForwardsForConnKey(connKey string) {
	if strings.TrimSpace(connKey) == "" {
		return
	}
	m.mu.Lock()
	var toClose []sshPortForward
	serverId := ""
	for _, entry := range m.portForwards {
		if entry == nil || entry.connKey != connKey {
			continue
		}
		serverId = entry.serverId
		if entry.forwarder != nil {
			toClose = append(toClose, entry.forwarder)
			entry.forwarder = nil
		}
		entry.enabled = false
	}
	m.mu.Unlock()

	if len(toClose) == 0 {
		return
	}
	for _, fw := range toClose {
		_ = fw.Close()
	}
	m.persistPortForwardsForServer(serverId)
}

// persistPortForwardsForServer 将某 server 当前所有映射(运行态+已停止态)写盘。调用方不得持有 m.mu。
func (m *SSHManager) persistPortForwardsForServer(serverId string) {
	if m.app == nil || m.app.configManager == nil || strings.TrimSpace(serverId) == "" {
		return
	}
	m.mu.RLock()
	list := make([]PersistedPortForward, 0)
	now := time.Now().UnixMilli()
	for _, entry := range m.portForwards {
		if entry == nil || entry.serverId != serverId {
			continue
		}
		list = append(list, PersistedPortForward{
			ID:           entry.id,
			Kind:         entry.kind,
			LocalHost:    entry.localHost,
			LocalPort:    entry.localPort,
			RemoteHost:   entry.remoteHost,
			RemotePort:   entry.remotePort,
			Enabled:      entry.enabled,
			LastModified: now,
		})
	}
	m.mu.RUnlock()
	if err := m.app.configManager.SavePortForwards(serverId, list); err != nil {
		log.Printf("[persistPortForwardsForServer] save failed for %s: %v", serverId, err)
	}
}

func (m *SSHManager) StartLocalPortForward(connKey, localAddr, remoteAddr string) (string, error) {
	m.ensurePersistedPortForwardsLoadedForConnKey(connKey)
	m.mu.Lock()
	entry, ok := m.clients[connKey]
	if !ok || entry == nil || entry.Client == nil {
		m.mu.Unlock()
		return "", errors.New("ssh client not found")
	}
	forwarder, err := StartSSHLocalPortForward(context.Background(), entry.Client, localAddr, remoteAddr)
	if err != nil {
		m.mu.Unlock()
		return "", err
	}
	id := fmt.Sprintf("lf-%d", time.Now().UnixNano())
	serverId := m.serverIdForConnKey(connKey)
	localHost, localPort := splitHostPortLoose(localAddr)
	remoteHost, remotePort := splitHostPortLoose(remoteAddr)
	m.portForwards[id] = &managedPortForward{
		id: id, kind: "local", connKey: connKey, serverId: serverId,
		localHost: localHost, localPort: localPort, remoteHost: remoteHost, remotePort: remotePort,
		enabled: true, forwarder: forwarder,
	}
	m.mu.Unlock()
	m.persistPortForwardsForServer(serverId)
	return id, nil
}

func (m *SSHManager) StartRemotePortForward(connKey, remoteAddr, localAddr string) (string, error) {
	m.ensurePersistedPortForwardsLoadedForConnKey(connKey)
	m.mu.Lock()
	entry, ok := m.clients[connKey]
	if !ok || entry == nil || entry.Client == nil {
		m.mu.Unlock()
		return "", errors.New("ssh client not found")
	}
	forwarder, err := StartSSHRemotePortForward(context.Background(), entry.Client, remoteAddr, localAddr)
	if err != nil {
		m.mu.Unlock()
		return "", err
	}
	id := fmt.Sprintf("rf-%d", time.Now().UnixNano())
	serverId := m.serverIdForConnKey(connKey)
	localHost, localPort := splitHostPortLoose(localAddr)
	remoteHost, remotePort := splitHostPortLoose(remoteAddr)
	m.portForwards[id] = &managedPortForward{
		id: id, kind: "remote", connKey: connKey, serverId: serverId,
		localHost: localHost, localPort: localPort, remoteHost: remoteHost, remotePort: remotePort,
		enabled: true, forwarder: forwarder,
	}
	m.mu.Unlock()
	m.persistPortForwardsForServer(serverId)
	return id, nil
}

// StopPortForward 停止转发但保留记录(标记为已停止), 关闭真实监听, 不从 map 移除。
func (m *SSHManager) StopPortForward(id string) error {
	m.mu.RLock()
	existing, ok := m.portForwards[id]
	connKey := ""
	if ok && existing != nil {
		connKey = existing.connKey
	}
	m.mu.RUnlock()
	m.ensurePersistedPortForwardsLoadedForConnKey(connKey)
	m.mu.Lock()
	entry, ok := m.portForwards[id]
	if !ok || entry == nil {
		m.mu.Unlock()
		return errors.New("port forward not found")
	}
	forwarder := entry.forwarder
	entry.forwarder = nil
	entry.enabled = false
	serverId := entry.serverId
	m.mu.Unlock()

	if forwarder != nil {
		_ = forwarder.Close()
	}
	m.persistPortForwardsForServer(serverId)
	return nil
}

// DeletePortForward 彻底移除记录; 若仍在运行则先关闭监听。
func (m *SSHManager) DeletePortForward(id string) error {
	m.mu.RLock()
	existing, ok := m.portForwards[id]
	connKey := ""
	if ok && existing != nil {
		connKey = existing.connKey
	}
	m.mu.RUnlock()
	m.ensurePersistedPortForwardsLoadedForConnKey(connKey)
	m.mu.Lock()
	entry, ok := m.portForwards[id]
	if !ok || entry == nil {
		m.mu.Unlock()
		return errors.New("port forward not found")
	}
	forwarder := entry.forwarder
	serverId := entry.serverId
	delete(m.portForwards, id)
	m.mu.Unlock()

	if forwarder != nil {
		_ = forwarder.Close()
	}
	m.persistPortForwardsForServer(serverId)
	return nil
}

// RestartPortForward 重新拉起一个已停止的映射, 复用原配置, 分配新 id。
func (m *SSHManager) RestartPortForward(id string) (string, error) {
	m.mu.RLock()
	existing, ok := m.portForwards[id]
	connKeyForLoad := ""
	if ok && existing != nil {
		connKeyForLoad = existing.connKey
	}
	m.mu.RUnlock()
	m.ensurePersistedPortForwardsLoadedForConnKey(connKeyForLoad)
	m.mu.RLock()
	entry, ok := m.portForwards[id]
	if !ok || entry == nil {
		m.mu.RUnlock()
		return "", errors.New("port forward not found")
	}
	if entry.enabled && entry.forwarder != nil {
		m.mu.RUnlock()
		return id, nil
	}
	kind := entry.kind
	connKey := entry.connKey
	localAddr := net.JoinHostPort(entry.localHost, entry.localPort)
	remoteAddr := net.JoinHostPort(entry.remoteHost, entry.remotePort)
	m.mu.RUnlock()

	m.mu.Lock()
	delete(m.portForwards, id)
	m.mu.Unlock()

	if kind == "local" {
		return m.StartLocalPortForward(connKey, localAddr, remoteAddr)
	}
	return m.StartRemotePortForward(connKey, remoteAddr, localAddr)
}

func (m *SSHManager) ListPortForwards() []PortForwardInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]PortForwardInfo, 0, len(m.portForwards))
	for _, entry := range m.portForwards {
		info := PortForwardInfo{
			ID:         entry.id,
			Kind:       entry.kind,
			Enabled:    entry.enabled,
			LocalHost:  entry.localHost,
			LocalPort:  entry.localPort,
			RemoteHost: entry.remoteHost,
			RemotePort: entry.remotePort,
			LocalAddr:  net.JoinHostPort(entry.localHost, entry.localPort),
			RemoteAddr: net.JoinHostPort(entry.remoteHost, entry.remotePort),
		}
		if entry.forwarder != nil {
			if addr := entry.forwarder.Addr(); addr != nil {
				info.Addr = addr.String()
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

	m.ensurePersistedPortForwardsLoadedForConnKey(connKey)

	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]PortForwardInfo, 0, len(m.portForwards))
	for _, entry := range m.portForwards {
		if entry == nil || entry.connKey != connKey {
			continue
		}
		info := PortForwardInfo{
			ID:         entry.id,
			Kind:       entry.kind,
			Enabled:    entry.enabled,
			LocalHost:  entry.localHost,
			LocalPort:  entry.localPort,
			RemoteHost: entry.remoteHost,
			RemotePort: entry.remotePort,
		}
		if entry.forwarder != nil {
			if addr := entry.forwarder.Addr(); addr != nil {
				info.Addr = addr.String()
			}
		}
		switch entry.kind {
		case "local":
			info.LocalAddr = net.JoinHostPort(entry.localHost, entry.localPort)
			info.RemoteAddr = net.JoinHostPort(entry.remoteHost, entry.remotePort)
		case "remote":
			info.LocalAddr = net.JoinHostPort(entry.localHost, entry.localPort)
			info.RemoteAddr = net.JoinHostPort(entry.remoteHost, entry.remotePort)
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
