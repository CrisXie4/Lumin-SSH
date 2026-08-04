import { useState, useEffect, useRef, useCallback } from 'react';
import * as AppGo from '../../wailsjs/go/main/App.js';
import { useTranslation } from '../i18n.js';
import { ScrollText, Keyboard, Clipboard, Trash2, Rocket } from 'lucide-react';

export default function CommandHistory({ sessionId, historyServerId, addToast }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyMode, setHistoryMode] = useState('server'); // 'server' | 'global'
  const perServerRef = useRef([]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── 串行化全局历史更新，避免 read-modify-write 竞态 ──
  const globalHistoryUpdateLock = useRef(Promise.resolve());

  const updateGlobalHistory = useCallback((updater) => {
    globalHistoryUpdateLock.current = globalHistoryUpdateLock.current.then(async () => {
      try {
        const raw = await AppGo.GetGlobalCommandHistory();
        let current = [];
        try { current = JSON.parse(raw) || []; } catch {}
        if (!Array.isArray(current)) current = [];
        const next = updater(current);
        await AppGo.SaveGlobalCommandHistory(JSON.stringify(next));
      } catch (e) {
        console.error('Failed to update global history:', e);
      }
    });
  }, []);

  // ── 加载显示数据（模式/服务器切换时）──
  useEffect(() => {
    (async () => {
      try {
        const raw = historyMode === 'global'
          ? await AppGo.GetGlobalCommandHistory()
          : await AppGo.GetCommandHistory(historyServerId);
        if (!mountedRef.current) return;
        const arr = JSON.parse(raw);
        setHistory(Array.isArray(arr) ? arr : []);
        if (historyMode === 'server') {
          perServerRef.current = Array.isArray(arr) ? arr : [];
        }
      } catch {
        if (mountedRef.current) setHistory([]);
      }
    })();
  }, [historyServerId, historyMode]);

  // ── 事件监听 & 持久化（始终维护 per-server）──
  useEffect(() => {
    const persist = () => {
      AppGo.SaveCommandHistory(historyServerId, JSON.stringify(perServerRef.current.slice(0, 100))).catch(() => {});
    };

    const handler = (e) => {
      const d = e.detail;
      if (d.sessionId !== sessionId) return;
      const cmd = d.command;
      if (!cmd || !String(cmd).trim()) return;

      const entry = { id: Date.now() + Math.random(), command: cmd, time: d.time, source: 'input' };
      // 去重：如果历史已有相同命令，移除旧的，放到最新位置
      perServerRef.current = [entry, ...perServerRef.current.filter(e => e.command !== cmd)].slice(0, 100);
      persist();

      // 追加到全局历史（连续相同命令只更新时间）
      updateGlobalHistory((list) => {
        if (!Array.isArray(list)) return [];
        // 全局历史去重：移除相同命令的旧条目
        const filtered = list.filter(e => e.command !== cmd);
        filtered.unshift({ id: Date.now() + Math.random(), command: cmd, time: d.time, source: 'input' });
        return filtered.slice(0, 100);
      });

      if (historyMode === 'server') {
        setHistory([...perServerRef.current]);
      } else {
        // 全局模式：从文件刷新显示
        AppGo.GetGlobalCommandHistory().then(raw => {
          const arr = JSON.parse(raw);
          setHistory(Array.isArray(arr) ? arr : []);
        }).catch(() => {});
      }
    };

    window.addEventListener('ssh-command-history', handler);

    const onClear = (e) => {
      if (e.detail?.sessionId === sessionId) {
        perServerRef.current = [];
        setHistory([]);
        persist();
      }
    };
    window.addEventListener('ssh-history-cleared', onClear);

    return () => {
      window.removeEventListener('ssh-command-history', handler);
      window.removeEventListener('ssh-history-cleared', onClear);
    };
  }, [sessionId, historyServerId, historyMode]);

  // 搜索过滤
  const filteredHistory = searchQuery
    ? history.filter(item => item.command.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  // ── 操作 ──
  const copy = (cmd) => {
    navigator.clipboard.writeText(cmd);
    addToast?.(t('命令已复制到剪贴板'), 'success');
  };

  const exec = (cmd) => {
    window.dispatchEvent(new CustomEvent('ssh-command-history', {
      detail: { sessionId, command: cmd, time: new Date().toISOString(), source: 'input' }
    }));
    AppGo.WriteTerminal(sessionId, cmd + '\r').catch((err) => {
      console.error('WriteTerminal failed:', err);
    });
    addToast?.(t('已发送指令到终端'), 'info', 2000);
  };

  const clear = async () => {
    if (await window.luminDialog?.confirm(t('确定要清空该服务器的历史指令吗？'))) {
      if (historyMode === 'global') {
        AppGo.SaveGlobalCommandHistory('[]').catch(() => {});
      } else {
        perServerRef.current = [];
        AppGo.SaveCommandHistory(historyServerId, '[]').catch(() => {});
      }
      setHistory([]);
      window.dispatchEvent(new CustomEvent('ssh-history-cleared', { detail: { sessionId } }));
    }
  };

  const deleteItem = (id) => {
    if (historyMode === 'server') {
      perServerRef.current = perServerRef.current.filter(item => item.id !== id);
      const next = [...perServerRef.current];
      AppGo.SaveCommandHistory(historyServerId, JSON.stringify(next)).catch(() => {});
      setHistory(next);
    } else {
      // 全局模式：从全局历史文件中删除
      AppGo.GetGlobalCommandHistory().then(raw => {
        if (!mountedRef.current) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const next = list.filter(item => item.id !== id);
        AppGo.SaveGlobalCommandHistory(JSON.stringify(next)).catch(() => {});
        setHistory(next);
      }).catch(() => {});
    }
  };

  // ── UI ──
  return (
    <div className="data-page-scroll">
      {/* 标题行 */}
      <div className="data-page-header">
        <h3 className="data-page-title">
          <ScrollText size={16} /> {t('历史指令')}
        </h3>
        {history.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clear}>
            {t('清空列表')}
          </button>
        )}
      </div>

      {/* 搜索 + 模式切换 */}
      <div className="data-toolbar">
        <input
          className="input"
          type="search"
          autoComplete="off"
          name="commandHistorySearch"
          aria-label={t('搜索命令...')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('搜索命令...')}
        />
        <div className="segment-control">
          <button className={historyMode === 'server' ? 'active' : ''} onClick={() => setHistoryMode('server')}>
            {t('当前服务器')}
          </button>
          <button className={historyMode === 'global' ? 'active' : ''} onClick={() => setHistoryMode('global')}>
            {t('全部服务器')}
          </button>
        </div>
      </div>

      {/* 空状态 / 列表 */}
      {filteredHistory.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '10vh' }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}><Keyboard size={48} /></div>
          <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
            {searchQuery ? t('未找到匹配的命令') : t('您还没有执行过任何命令')}
          </p>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 300, textAlign: 'center', lineHeight: 1.6, marginTop: 8 }}>
            {searchQuery ? t('尝试其他搜索词') : t('在此服务器中执行过的命令会自动留存，方便您浏览与重复运行。')}
          </span>
        </div>
      ) : (
        <div className="history-list">
          {filteredHistory.map((item) => (
            <div key={item.id} className="card history-item-card">
              <div className="history-command-row">
                <span className="history-command-text">
                  {item.command}
                </span>
                <span className="history-time">
                  {new Date(item.time).toLocaleTimeString()}
                </span>
              </div>

              <div className="history-actions">
                <button className="btn btn-sm" onClick={() => copy(item.command)}>
                  <Clipboard size={12} /> {t('复制')}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>
                  <Trash2 size={12} /> {t('删除')}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => exec(item.command)}>
                  <Rocket size={13} /> {t('再次运行')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
