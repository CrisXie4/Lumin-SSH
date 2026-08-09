import { useState, useEffect, useRef, useCallback } from 'react';
import * as AppGo from '../../bindings/luminssh-go/internal/wailsapp/app.js';
import { useTranslation } from '../i18n.js';
import { ScrollText, Keyboard, Clipboard, Trash2, Rocket } from 'lucide-react';

// 历史事件约定：
// - ssh-command-history { sessionId(归组id), command, time, source }  新增命令
// - ssh-history-cleared { sessionId, historyServerId, scope: 'server'|'global' }  清空
// - ssh-history-changed { sessionId, historyServerId, scope: 'server'|'global' }  删除等变更
// sessionId 作为「历史归组 ID」（= 父会话 s.id），用于过滤事件；
// historyServerId 作为服务器历史文件键（= s.serverId）；
// terminalId 作为「再次运行」实际写入终端的目标（= 活动终端 id）。
export default function CommandHistory({ sessionId, historyServerId, terminalId, addToast }) {
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

  // 返回写入后的数组，供调用方直接刷新显示，避免再次读取旧文件
  const updateGlobalHistory = useCallback((updater) => {
    const next = globalHistoryUpdateLock.current.then(async () => {
      try {
        const raw = await AppGo.GetGlobalCommandHistory();
        let current = [];
        try { current = JSON.parse(raw) || []; } catch {}
        if (!Array.isArray(current)) current = [];
        const result = updater(current);
        await AppGo.SaveGlobalCommandHistory(JSON.stringify(result));
        return result;
      } catch (e) {
        console.error('Failed to update global history:', e);
        return [];
      }
    });
    // 锁链断裂保护：任一步失败不应影响后续更新
    globalHistoryUpdateLock.current = next.catch(() => {});
    return next;
  }, []);

  // ── 加载显示数据（模式/服务器切换时）──
  // 用请求序号防止快速切换时旧请求覆盖新结果
  const loadSeqRef = useRef(0);
  useEffect(() => {
    const seq = ++loadSeqRef.current;
    (async () => {
      try {
        const raw = historyMode === 'global'
          ? await AppGo.GetGlobalCommandHistory()
          : await AppGo.GetCommandHistory(historyServerId);
        if (!mountedRef.current) return;
        if (seq !== loadSeqRef.current) return; // 已被后续切换取代
        const arr = JSON.parse(raw);
        const list = Array.isArray(arr) ? arr : [];
        setHistory(list);
        if (historyMode === 'server') {
          perServerRef.current = list;
        }
      } catch {
        if (!mountedRef.current) return;
        if (seq !== loadSeqRef.current) return;
        setHistory([]);
        if (historyMode === 'server') perServerRef.current = [];
      }
    })();
  }, [historyServerId, historyMode]);

  // 判断事件是否属于当前会话/服务器（按归组 id 或服务器 id 任一匹配）
  const matchesSession = useCallback((detail) => {
    if (!detail) return false;
    if (detail.historyServerId && detail.historyServerId === historyServerId) return true;
    if (detail.sessionId && detail.sessionId === sessionId) return true;
    return false;
  }, [sessionId, historyServerId]);

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
      const globalUpdate = updateGlobalHistory((list) => {
        if (!Array.isArray(list)) return [];
        // 全局历史去重：移除相同命令的旧条目
        const filtered = list.filter(e => e.command !== cmd);
        filtered.unshift({ id: Date.now() + Math.random(), command: cmd, time: d.time, source: 'input' });
        return filtered.slice(0, 100);
      });

      if (historyMode === 'server') {
        setHistory([...perServerRef.current]);
      } else {
        // 全局模式：等待写入完成后直接用结果刷新，避免读到尚未保存的旧文件
        globalUpdate.then((list) => {
          if (!mountedRef.current) return;
          setHistory(Array.isArray(list) ? list : []);
        });
      }
    };

    window.addEventListener('ssh-command-history', handler);

    const onClear = (e) => {
      const d = e.detail;
      if (!matchesSession(d)) return;
      const scope = d?.scope || 'server';
      if (scope === 'server') {
        // 服务器清空：清掉当前 ref + 持久化空
        perServerRef.current = [];
        persist();
        if (historyMode === 'server') setHistory([]);
      } else {
        // 全局清空：不触碰当前服务器历史文件
        if (historyMode === 'global') setHistory([]);
      }
    };
    window.addEventListener('ssh-history-cleared', onClear);

    // 删除/变更通知：按作用域刷新当前显示，避免历史页继续显示已删除条目
    const onChanged = (e) => {
      const d = e.detail;
      if (!matchesSession(d)) return;
      const scope = d?.scope || 'server';
      // 只刷新与当前模式一致的作用域，避免串模式
      if (scope !== historyMode) return;
      const refreshSeq = ++loadSeqRef.current;
      (async () => {
        try {
          const raw = scope === 'global'
            ? await AppGo.GetGlobalCommandHistory()
            : await AppGo.GetCommandHistory(historyServerId);
          if (!mountedRef.current) return;
          if (refreshSeq !== loadSeqRef.current) return;
          const arr = JSON.parse(raw);
          const list = Array.isArray(arr) ? arr : [];
          setHistory(list);
          if (scope === 'server') perServerRef.current = list;
        } catch {
          if (!mountedRef.current) return;
          if (refreshSeq !== loadSeqRef.current) return;
          setHistory([]);
        }
      })();
    };
    window.addEventListener('ssh-history-changed', onChanged);

    return () => {
      window.removeEventListener('ssh-command-history', handler);
      window.removeEventListener('ssh-history-cleared', onClear);
      window.removeEventListener('ssh-history-changed', onChanged);
    };
  }, [sessionId, historyServerId, historyMode, matchesSession, updateGlobalHistory]);

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
    // 「再次运行」写入活动终端，无活动终端时回退到归组会话
    const writeTarget = terminalId || sessionId;
    AppGo.WriteTerminal(writeTarget, cmd + '\r').catch((err) => {
      console.error('WriteTerminal failed:', err);
    });
    addToast?.(t('已发送指令到终端'), 'info', 2000);
  };

  const clear = async () => {
    const scope = historyMode; // 'server' | 'global'
    const msg = scope === 'global'
      ? t('确定要清空全部服务器的历史指令吗？')
      : t('确定要清空该服务器的历史指令吗？');
    if (!(await window.luminDialog?.confirm(msg))) return;
    try {
      if (scope === 'global') {
        await AppGo.SaveGlobalCommandHistory('[]');
      } else {
        perServerRef.current = [];
        await AppGo.SaveCommandHistory(historyServerId, '[]');
      }
      setHistory([]);
      window.dispatchEvent(new CustomEvent('ssh-history-cleared', {
        detail: { sessionId, historyServerId, scope }
      }));
    } catch (e) {
      console.error('Failed to clear history:', e);
      addToast?.(t('清空历史失败'), 'error', 2000);
    }
  };

  const deleteItem = async (id) => {
    const scope = historyMode;
    try {
      if (scope === 'server') {
        const next = perServerRef.current.filter(item => item.id !== id);
        perServerRef.current = next;
        await AppGo.SaveCommandHistory(historyServerId, JSON.stringify(next));
        setHistory([...next]);
      } else {
        // 全局模式：从全局历史文件中删除
        const raw = await AppGo.GetGlobalCommandHistory();
        if (!mountedRef.current) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const next = list.filter(item => item.id !== id);
        await AppGo.SaveGlobalCommandHistory(JSON.stringify(next));
        setHistory(next);
      }
      // 通知其它视图（终端弹窗 / 自动补全）刷新，避免继续显示已删除条目
      window.dispatchEvent(new CustomEvent('ssh-history-changed', {
        detail: { sessionId, historyServerId, scope }
      }));
    } catch (e) {
      console.error('Failed to delete history item:', e);
      addToast?.(t('删除失败'), 'error', 2000);
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
