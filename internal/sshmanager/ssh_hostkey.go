package sshmanager

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// getKnownHostsPath 返回跨平台的 known_hosts 文件路径
func getKnownHostsPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".ssh", "known_hosts")
}

// initKnownHostsCallback 初始化 known_hosts 文件并返回 HostKeyCallback
func initKnownHostsCallback() (ssh.HostKeyCallback, error) {
	knownHostsPath := getKnownHostsPath()
	if err := os.MkdirAll(filepath.Dir(knownHostsPath), 0700); err != nil {
		log.Printf("[initKnownHosts] MkdirAll failed: %v", err)
	}
	if _, err := os.Stat(knownHostsPath); os.IsNotExist(err) {
		if err := os.WriteFile(knownHostsPath, []byte(""), 0600); err != nil {
			log.Printf("[initKnownHosts] failed to create known_hosts: %v", err)
		}
	}
	cb, err := knownhosts.New(knownHostsPath)
	if err != nil {
		return nil, fmt.Errorf("无法初始化主机密钥校验，请检查 %s: %w", knownHostsPath, err)
	}
	return cb, nil
}

// TempAcceptedKey 读取该会话「只接受本次」记录的指纹。
// 供 ReconnectWithPassword 在 Disconnect 前后跨重连保留授权。
func (m *SSHManager) TempAcceptedKey(sessionId string) (string, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	fp, ok := m.tempAcceptedKeys[sessionId]
	return fp, ok
}

// RestoreTempAcceptedKey 恢复该会话的临时密钥授权。
func (m *SSHManager) RestoreTempAcceptedKey(sessionId string, fingerprint string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tempAcceptedKeys[sessionId] = fingerprint
}

// ClearTempAcceptedKey 清除该会话的临时密钥授权。
func (m *SSHManager) ClearTempAcceptedKey(sessionId string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tempAcceptedKeys, sessionId)
}

// AcceptHostKeyChange 处理用户对主机密钥变更的确认
// action: 0=取消, 1=仅本次接受, 2=接受并保存至 known_hosts
func (m *SSHManager) AcceptHostKeyChange(sessionId string, action int) error {
	m.mu.Lock()
	pending, exists := m.pendingHostKeys[sessionId]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("no pending host key change for session %s", sessionId)
	}
	delete(m.pendingHostKeys, sessionId)
	m.mu.Unlock()

	switch action {
	case 0: // 取消
		return fmt.Errorf("用户取消了主机密钥验证")

	case 1: // 仅本次接受 —— 不写 known_hosts，仅临时放行
		m.mu.Lock()
		m.tempAcceptedKeys[sessionId] = pending.NewFingerprint
		m.mu.Unlock()
		err := m.Connect(sessionId, pending.Conn)
		// Connect 失败时清除临时密钥，避免下次连接静默绕过主机密钥校验。
		// 认证失败除外：主机密钥此刻已校验通过，用户补对密码就会走
		// ReconnectWithPassword 重连，此时清掉会导致主机密钥确认二次弹出。
		if err != nil && !errors.Is(err, ErrAuthFailed) {
			m.mu.Lock()
			delete(m.tempAcceptedKeys, sessionId)
			m.mu.Unlock()
		}
		return err

	case 2: // 接受并保存到 known_hosts
		knownHostsPath := getKnownHostsPath()
		if err := os.MkdirAll(filepath.Dir(knownHostsPath), 0700); err != nil {
			log.Printf("[AcceptHostKeyChange] MkdirAll for known_hosts dir failed: %v", err)
		}

		newLine := knownhosts.Line([]string{pending.Hostname}, pending.NewKey)

		if len(pending.OldKeys) > 0 {
			// 密钥已变更：删除旧条目后追加新条目（原子写入：临时文件 + rename）
			data, err := os.ReadFile(knownHostsPath)
			if err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("无法读取 known_hosts: %w", err)
			}

			var newLines []string
			// ponytail: 预计算旧密钥字符串，避免循环内重复 MarshalAuthorizedKey
			oldKeyStrs := make([]string, len(pending.OldKeys))
			for i, k := range pending.OldKeys {
				oldKeyStrs[i] = strings.TrimSpace(string(ssh.MarshalAuthorizedKey(k.Key)))
			}
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					newLines = append(newLines, line)
					continue
				}
				isOld := false
				for _, oldStr := range oldKeyStrs {
					if strings.Contains(line, oldStr) {
						isOld = true
						break
					}
				}
				if !isOld {
					newLines = append(newLines, line)
				}
			}
			newLines = append(newLines, newLine)

			// 原子写入：写临时文件后直接 rename 覆盖。
			// ponytail: os.Rename 在 Unix 上是原子替换，在 Windows 上用 MoveFileEx+MOVEFILE_REPLACE_EXISTING 同样替换。
			// 旧实现先 rename 原文件到 .bak 再 rename tmp→原路径，当第二步失败且回滚也失败时原文件丢失。
			// 直接 rename 失败时原文件未被移动，始终完整，无数据丢失风险。
			tmpPath := knownHostsPath + ".tmp"
			if err := os.WriteFile(tmpPath, []byte(strings.Join(newLines, "\n")+"\n"), 0600); err != nil {
				return fmt.Errorf("无法写入 known_hosts: %w", err)
			}
			if err := os.Rename(tmpPath, knownHostsPath); err != nil {
				os.Remove(tmpPath)
				return fmt.Errorf("无法写入 known_hosts: %w", err)
			}
		} else {
			// 首次连接：直接追加新条目
			f, err := os.OpenFile(knownHostsPath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0600)
			if err != nil {
				return fmt.Errorf("无法写入 known_hosts: %w", err)
			}
			if _, err := f.WriteString(newLine + "\n"); err != nil {
				f.Close()
				return fmt.Errorf("无法写入 known_hosts: %w", err)
			}
			if err := f.Close(); err != nil {
				return fmt.Errorf("无法关闭 known_hosts: %w", err)
			}
		}

		return m.Connect(sessionId, pending.Conn)

	default:
		return fmt.Errorf("无效的操作")
	}
}
