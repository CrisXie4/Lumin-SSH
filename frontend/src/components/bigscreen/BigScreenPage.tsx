import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ListChecks, Maximize, Minimize, Monitor, MonitorUp, RefreshCw, X } from 'lucide-react';
import { WindowFullscreen, WindowUnfullscreen } from '../../../wailsjs/runtime/runtime.js';
import { useTranslation } from '../../i18n.ts';
import { Z } from '../../constants/zIndex.ts';
import { cn } from '../../utils/cn.ts';
import { isUnsupportedMonitorSession, type SessionLike } from '../../utils/sessionWorkspace.ts';
import type { config } from '../../../wailsjs/go/models.ts';
import { BigScreenServerCard } from './BigScreenServerCard.tsx';
import { useBigScreenData } from './useBigScreenData.ts';
import {
  BIG_SCREEN_SELECTED_KEY,
  BIG_SCREEN_SEEN_KEY,
  readStringSet,
  writeStringSet,
  type BigScreenTarget,
} from './bigScreenTypes.ts';

/** 会话的最小形状（来自 useAppSessionHub 的 connectedSessions） */
interface BigScreenSessionLike {
  id?: unknown;
  serverId?: unknown;
  serverName?: unknown;
  host?: unknown;
  isLocal?: unknown;
  shellPath?: unknown;
  isSerial?: unknown;
}

export interface BigScreenPageProps {
  visible: boolean;
  servers: config.Connection[];
  sessions: BigScreenSessionLike[];
  onClose: () => void;
  onGoHome: () => void;
}

const buildTargets = (sessions: BigScreenSessionLike[], servers: config.Connection[]): BigScreenTarget[] => {
  const seen = new Set<string>();
  const targets: BigScreenTarget[] = [];
  sessions.forEach((session) => {
    const sessionId = typeof session.id === 'string' ? session.id : '';
    if (!sessionId) return;
    if (session.isSerial === true || isUnsupportedMonitorSession(session as SessionLike)) return;
    const serverId = typeof session.serverId === 'string' && session.serverId ? session.serverId : sessionId;
    if (seen.has(serverId)) return;
    seen.add(serverId);
    const server = servers.find((item) => item.id === serverId);
    targets.push({
      sessionId,
      serverId,
      name: String(session.serverName || server?.name || server?.host || fallbackName(serverId)),
      host: String(session.host || server?.host || ''),
      username: String(server?.username || ''),
      isLocal: session.isLocal === true,
    });
  });
  return targets;
};

const fallbackName = (serverId: string) => serverId.slice(0, 8);

if (import.meta.env.DEV) {
  const checkTargets = buildTargets([
    { id: 'local-pwsh', isLocal: true, shellPath: 'pwsh.exe' },
    { id: 'serial', isSerial: true },
    { id: 'ssh', serverId: 'ssh', isLocal: false },
  ], [{ id: 'ssh', name: 'SSH', host: 'example.com' } as config.Connection]);
  if (checkTargets.length !== 1 || checkTargets[0].serverId !== 'ssh') {
    throw new Error('数据大屏目标筛选自检失败');
  }
}

/** 选中集合：新连接自动上屏；手动取消的选择在断开重连后仍然生效 */
function useBigScreenSelection(targets: BigScreenTarget[], visible: boolean) {
  const [selected, setSelected] = useState<Set<string>>(() => readStringSet(BIG_SCREEN_SELECTED_KEY));

  useEffect(() => {
    if (!visible || targets.length === 0) return;
    const seen = readStringSet(BIG_SCREEN_SEEN_KEY);
    const next = new Set(selected);
    targets.forEach((target) => {
      if (!seen.has(target.serverId)) {
        // 从未见过的服务器自动上屏
        next.add(target.serverId);
      }
    });
    [...next].forEach((id) => {
      if (!targets.some((target) => target.serverId === id)) next.delete(id);
    });
    const nextSeen = new Set(seen);
    targets.forEach((target) => nextSeen.add(target.serverId));
    writeStringSet(BIG_SCREEN_SEEN_KEY, nextSeen);
    const changed = next.size !== selected.size || [...next].some((id) => !selected.has(id));
    if (changed) setSelected(next);
  }, [visible, targets, selected]);

  useEffect(() => {
    writeStringSet(BIG_SCREEN_SELECTED_KEY, selected);
  }, [selected]);

  const toggle = useCallback((serverId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  }, []);

  const selectAll = useCallback((all: BigScreenTarget[]) => {
    const next = new Set(all.map((target) => target.serverId));
    setSelected(next);
  }, []);

  const clearAll = useCallback(() => {
    const next = new Set<string>();
    setSelected(next);
  }, []);

  return { selected, toggle, selectAll, clearAll };
}

const hasWailsWindowRuntime = () => {
  try {
    return typeof window !== 'undefined' && typeof (window as { runtime?: { WindowFullscreen?: unknown } }).runtime?.WindowFullscreen === 'function';
  } catch (_) {
    return false;
  }
};

export default function BigScreenPage({ visible, servers, sessions, onClose, onGoHome }: BigScreenPageProps) {
  const { t, lang } = useTranslation();
  const targets = useMemo(() => (visible ? buildTargets(sessions, servers) : []), [visible, sessions, servers]);
  const { selected, toggle, selectAll, clearAll } = useBigScreenSelection(targets, visible);
  const selectedTargets = useMemo(
    () => targets.filter((target) => selected.has(target.serverId)),
    [targets, selected],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wailsRuntime = hasWailsWindowRuntime();
  const { data, staticInfo, intervalSec } = useBigScreenData(selectedTargets, visible && isFullscreen);

  useEffect(() => {
    if (!visible) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus();
    return () => {
      const element = restoreFocusRef.current;
      if (element && element.isConnected) element.focus();
      restoreFocusRef.current = null;
    };
  }, [visible]);

  // 时钟
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString(lang, { hour12: false }));
      setDateLabel(now.toLocaleDateString(lang, { month: 'short', day: 'numeric', weekday: 'short' }));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [visible, lang]);

  // 同步浏览器全屏状态（桌面端 wails 全屏以本地状态为准）
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleClose = useCallback(() => {
    if (wailsRuntime) {
      if (isFullscreen) {
        try { WindowUnfullscreen(); } catch (_) { /* 忽略 */ }
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* 忽略 */ });
    }
    setIsFullscreen(false);
    setPickerOpen(false);
    onClose();
  }, [isFullscreen, wailsRuntime, onClose]);

  const handleGoHome = useCallback(() => {
    handleClose();
    onGoHome();
  }, [handleClose, onGoHome]);

  const handleToggleFullscreen = useCallback(() => {
    try {
      if (wailsRuntime) {
        if (isFullscreen) WindowUnfullscreen();
        else WindowFullscreen();
        setIsFullscreen(!isFullscreen);
      } else if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { /* 忽略 */ });
      } else {
        document.documentElement.requestFullscreen().catch(() => { /* 忽略 */ });
      }
    } catch (_) { /* 忽略 */ }
  }, [isFullscreen, wailsRuntime]);

  // Esc 分层退出：选择器 → 全屏（浏览器原生退全屏 / wails 手动退） → 关闭大屏
  useEffect(() => {
    if (!visible) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      if (wailsRuntime && isFullscreen) {
        try { WindowUnfullscreen(); } catch (_) { /* 忽略 */ }
        setIsFullscreen(false);
        return;
      }
      if (document.fullscreenElement) return;
      handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, pickerOpen, isFullscreen, wailsRuntime, handleClose]);

  // 点击选择器外部关闭
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  if (!visible) return null;

  const hasTargets = targets.length > 0;
  const hasSelection = selectedTargets.length > 0;

  return (
    <div
      ref={rootRef}
      className="bs-root"
      style={{ zIndex: Z.FULLSCREEN_OVERLAY }}
      role="dialog"
      aria-modal="true"
      aria-label={t('数据大屏')}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        if (focusable.length === 0) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="bs-bg" aria-hidden="true" />

      <header className="bs-header">
        <div className="bs-header-brand">
          <span className="bs-brand-icon"><MonitorUp size={18} /></span>
          <div className="bs-header-titles">
            <h1 className="bs-title">{t('数据大屏')}</h1>
            <span className="bs-subtitle">
              {hasTargets
                ? t('已选 {count}/{total} 台服务器 · {interval}s 刷新', { count: selectedTargets.length, total: targets.length, interval: intervalSec })
                : t('多服务器实时监控大屏')}
            </span>
          </div>
        </div>

        <div className="bs-header-right">
          <div className="bs-clock">
            <div className="bs-clock-time">{clock}</div>
            <div className="bs-clock-date">{dateLabel}</div>
          </div>

          {hasTargets && (
            <div className="bs-picker-wrap" ref={pickerRef}>
              <button
                type="button"
                className={cn('bs-btn', pickerOpen && 'is-active')}
                onClick={() => setPickerOpen((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={pickerOpen}
              >
                <ListChecks size={14} />
                <span>{t('选择服务器')}</span>
                <ChevronDown size={13} className={cn('bs-caret', pickerOpen && 'is-open')} />
              </button>
              {pickerOpen && (
                <div className="bs-picker">
                  <div className="bs-picker-actions">
                    <button type="button" className="bs-link-btn" onClick={() => selectAll(targets)}>{t('全选')}</button>
                    <button type="button" className="bs-link-btn" onClick={clearAll}>{t('清空')}</button>
                  </div>
                  <div className="bs-picker-list">
                    {targets.map((target) => {
                      const checked = selected.has(target.serverId);
                      return (
                        <button
                          key={target.serverId}
                          type="button"
                          className="bs-picker-item"
                          onClick={() => toggle(target.serverId)}
                          role="checkbox"
                          aria-checked={checked}
                        >
                          <span className={cn('bs-check', checked && 'is-checked')}>
                            {checked && <Check size={11} />}
                          </span>
                          <span className="bs-picker-name" title={target.name}>{target.name}</span>
                          <span className="bs-picker-host" title={target.host}>{target.host || (target.isLocal ? t('本机') : '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="bs-btn"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? t('退出全屏') : t('全屏')}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{isFullscreen ? t('退出全屏') : t('全屏')}</span>
          </button>
          <button type="button" className="bs-btn" onClick={handleClose} aria-label={t('退出大屏')}>
            <X size={15} />
          </button>
        </div>
      </header>

      <main className="bs-body">
        {!hasTargets ? (
          <div className="bs-empty">
            <span className="bs-empty-icon"><Monitor size={44} /></span>
            <div className="bs-empty-title">{t('暂无已连接的服务器')}</div>
            <div className="bs-empty-text">{t('连接服务器后将自动出现在大屏')}</div>
            <button type="button" className="bs-btn is-primary" onClick={handleGoHome}>
              <RefreshCw size={14} />
              <span>{t('返回主页')}</span>
            </button>
          </div>
        ) : !hasSelection ? (
          <div className="bs-empty">
            <span className="bs-empty-icon"><ListChecks size={44} /></span>
            <div className="bs-empty-title">{t('未选择任何服务器')}</div>
            <button type="button" className="bs-btn is-primary" onClick={() => selectAll(targets)}>
              {t('全选')}
            </button>
          </div>
        ) : (
          <div className="bs-grid">
            {selectedTargets.map((target) => (
              <BigScreenServerCard
                key={target.serverId}
                target={target}
                point={data[target.serverId]}
                staticInfo={staticInfo[target.serverId]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
