package main

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"
)

type fakeLocalPortForwardClient struct {
	conn net.Conn
	err  error
}

func (c *fakeLocalPortForwardClient) Dial(network, addr string) (net.Conn, error) {
	return c.conn, c.err
}

type fakeRemoteListener struct {
	incoming chan net.Conn
	closed   chan struct{}
}

func (l *fakeRemoteListener) Accept() (net.Conn, error) {
	select {
	case conn := <-l.incoming:
		return conn, nil
	case <-l.closed:
		return nil, net.ErrClosed
	}
}

func (l *fakeRemoteListener) Close() error {
	select {
	case <-l.closed:
	default:
		close(l.closed)
	}
	return nil
}

func (l *fakeRemoteListener) Addr() net.Addr {
	return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0}
}

type fakeRemotePortForwardClient struct {
	listener net.Listener
	err      error
}

func (c *fakeRemotePortForwardClient) Listen(network, addr string) (net.Listener, error) {
	return c.listener, c.err
}

func TestStartSSHLocalPortForward(t *testing.T) {
	clientConn, serverConn := net.Pipe()
	defer clientConn.Close()
	defer serverConn.Close()

	client := &fakeLocalPortForwardClient{conn: clientConn}
	forwarder, err := StartSSHLocalPortForward(context.Background(), client, "127.0.0.1:0", "example.com:80")
	if err != nil {
		t.Fatalf("StartSSHLocalPortForward returned error: %v", err)
	}
	defer forwarder.Close()

	localConn, err := net.Dial("tcp", forwarder.Addr().String())
	if err != nil {
		t.Fatalf("dial local forwarder: %v", err)
	}
	defer localConn.Close()

	if _, err := localConn.Write([]byte("hello")); err != nil {
		t.Fatalf("write to local conn: %v", err)
	}

	buf := make([]byte, 5)
	if err := readWithTimeout(serverConn, buf); err != nil {
		t.Fatalf("read from remote conn: %v", err)
	}
	if string(buf) != "hello" {
		t.Fatalf("unexpected payload: %q", string(buf))
	}
}

func TestSSHLocalPortForwardCloseStopsActiveConnections(t *testing.T) {
	clientConn, serverConn := net.Pipe()
	defer serverConn.Close()

	forwarder, err := StartSSHLocalPortForward(context.Background(), &fakeLocalPortForwardClient{conn: clientConn}, "127.0.0.1:0", "example.com:80")
	if err != nil {
		t.Fatalf("StartSSHLocalPortForward returned error: %v", err)
	}

	localConn, err := net.Dial("tcp", forwarder.Addr().String())
	if err != nil {
		t.Fatalf("dial local forwarder: %v", err)
	}
	defer localConn.Close()

	if _, err := localConn.Write([]byte("hello")); err != nil {
		t.Fatalf("write to local forwarder: %v", err)
	}
	buf := make([]byte, 5)
	if err := readWithTimeout(serverConn, buf); err != nil {
		t.Fatalf("read from remote conn: %v", err)
	}

	if err := forwarder.Close(); err != nil {
		t.Fatalf("close forwarder: %v", err)
	}
	if err := readWithTimeout(serverConn, make([]byte, 1)); err == nil {
		t.Fatal("expected active forwarded connection to close")
	}
}

func TestStartSSHLocalPortForwardRejectsOccupiedPort(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	_, err = StartSSHLocalPortForward(context.Background(), &fakeLocalPortForwardClient{}, listener.Addr().String(), "example.com:80")
	if err == nil {
		t.Fatal("expected occupied local port to be rejected")
	}
	if !strings.Contains(err.Error(), "local port already in use") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSSHManagerPortForwardLifecycle(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen local target: %v", err)
	}
	defer listener.Close()

	mgr := &SSHManager{portForwards: make(map[string]*managedPortForward)}
	mgr.portForwards["pf-1"] = &managedPortForward{id: "pf-1", kind: "local", forwarder: &SSHLocalPortForward{listener: listener}}

	infos := mgr.ListPortForwards()
	if len(infos) != 1 {
		t.Fatalf("expected 1 port forward, got %d", len(infos))
	}
	if infos[0].ID != "pf-1" {
		t.Fatalf("unexpected id: %s", infos[0].ID)
	}

	if err := mgr.StopPortForward("pf-1"); err != nil {
		t.Fatalf("stop port forward: %v", err)
	}
	if len(mgr.portForwards) != 1 {
		t.Fatalf("expected stopped port forward to remain in map, got %d", len(mgr.portForwards))
	}
	if entry := mgr.portForwards["pf-1"]; entry == nil || entry.enabled || entry.forwarder != nil {
		t.Fatalf("expected pf-1 marked stopped with released forwarder")
	}
	if err := mgr.DeletePortForward("pf-1"); err != nil {
		t.Fatalf("delete port forward: %v", err)
	}
	if len(mgr.portForwards) != 0 {
		t.Fatalf("expected no port forwards after delete, got %d", len(mgr.portForwards))
	}
}

func TestSSHManagerRemotePortForwardStop(t *testing.T) {
	fakeListener := &fakeRemoteListener{incoming: make(chan net.Conn, 1), closed: make(chan struct{})}
	mgr := &SSHManager{portForwards: make(map[string]*managedPortForward)}
	mgr.portForwards["pf-remote"] = &managedPortForward{id: "pf-remote", kind: "remote", forwarder: &SSHRemotePortForward{listener: fakeListener}}

	if err := mgr.StopPortForward("pf-remote"); err != nil {
		t.Fatalf("stop remote port forward: %v", err)
	}
	select {
	case <-fakeListener.closed:
	default:
		t.Fatalf("expected remote listener to be closed")
	}
	if len(mgr.portForwards) != 1 {
		t.Fatalf("expected stopped remote port forward to remain, got %d", len(mgr.portForwards))
	}
	if entry := mgr.portForwards["pf-remote"]; entry == nil || entry.enabled || entry.forwarder != nil {
		t.Fatalf("expected pf-remote marked stopped with released forwarder")
	}
	if err := mgr.DeletePortForward("pf-remote"); err != nil {
		t.Fatalf("delete remote port forward: %v", err)
	}
	if len(mgr.portForwards) != 0 {
		t.Fatalf("expected no port forwards after remote delete, got %d", len(mgr.portForwards))
	}
}

func TestStartSSHRemotePortForward(t *testing.T) {
	localListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen local target: %v", err)
	}
	defer localListener.Close()

	remoteConn, remotePeer := net.Pipe()
	defer remoteConn.Close()
	defer remotePeer.Close()

	fakeListener := &fakeRemoteListener{incoming: make(chan net.Conn, 1), closed: make(chan struct{})}
	fakeListener.incoming <- remoteConn

	client := &fakeRemotePortForwardClient{listener: fakeListener}
	forwarder, err := StartSSHRemotePortForward(context.Background(), client, "127.0.0.1:0", localListener.Addr().String())
	if err != nil {
		t.Fatalf("StartSSHRemotePortForward returned error: %v", err)
	}
	defer forwarder.Close()

	localConn, err := localListener.Accept()
	if err != nil {
		t.Fatalf("accept local forwarded connection: %v", err)
	}
	defer localConn.Close()

	if _, err := remotePeer.Write([]byte("hello")); err != nil {
		t.Fatalf("write to remote conn: %v", err)
	}

	buf := make([]byte, 5)
	if err := readWithTimeout(localConn, buf); err != nil {
		t.Fatalf("read from local conn: %v", err)
	}
	if string(buf) != "hello" {
		t.Fatalf("unexpected payload: %q", string(buf))
	}
}

func readWithTimeout(conn net.Conn, buf []byte) error {
	conn.SetDeadline(time.Now().Add(time.Second))
	defer conn.SetDeadline(time.Time{})
	_, err := conn.Read(buf)
	return err
}
