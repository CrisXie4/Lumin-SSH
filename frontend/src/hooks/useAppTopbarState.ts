import { useCallback, useEffect, useRef, useState } from 'react';
import useWindowState from './useWindowState.ts';
import type { SessionLike } from '../utils/sessionWorkspace.ts';

export interface UseAppTopbarStateOptions {
  sessions: SessionLike[];
}

export default function useAppTopbarState({ sessions }: UseAppTopbarStateOptions) {
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionListPos, setSessionListPos] = useState({ x: 0, y: 0 });
  const [sessionListQuery, setSessionListQuery] = useState('');
  const sessionListBtnRef = useRef<HTMLButtonElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabActionsRef = useRef<HTMLDivElement>(null);

  const handleToggleMaximise = useWindowState();
  const handleTopbarDoubleClick = useCallback((event?: React.MouseEvent<HTMLDivElement>) => {
    if (!event) return;
    try { window.getSelection?.()?.removeAllRanges?.(); } catch { }
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.no-drag') || target.closest('.topbar-logo') || target.closest('.tab-item')) return;
    event.preventDefault();
    handleToggleMaximise();
  }, [handleToggleMaximise]);

  useEffect(() => {
    if (!showSessionList) return;
    const handler = (e: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node) && sessionListBtnRef.current && !sessionListBtnRef.current.contains(e.target as Node)) {
        setShowSessionList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSessionList]);

  const toggleSessionList = useCallback(() => {
    if (showSessionList) { setShowSessionList(false); return; }
    const rect = sessionListBtnRef.current?.getBoundingClientRect();
    if (!rect) { setShowSessionList(false); return; }
    setSessionListPos({ x: rect.right, y: rect.bottom + 4 });
    setSessionListQuery('');
    setShowSessionList(true);
  }, [showSessionList]);

  // Ctrl+K（可在设置-快捷键中改绑，键名 serverSearch）：全局唤起服务器快连面板。
  // 焦点在输入框 / 终端模拟器内时不抢占。
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.shiftKey || e.altKey) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key.toLowerCase() !== 'k') return;
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || target.closest('.xterm'))) return;
      let combo = 'Ctrl+K';
      try {
        const saved = JSON.parse(localStorage.getItem('appShortcuts') || '{}');
        if (typeof saved.serverSearch === 'string' && saved.serverSearch) combo = saved.serverSearch;
        if (combo === '无' || combo === 'none') return;
      } catch { /* 使用默认 */ }
      const want = combo.toLowerCase();
      const modOk = want.startsWith('ctrl+') ? (e.ctrlKey || e.metaKey) : true;
      const mainKey = want.includes('+') ? want.split('+').pop() : want;
      if (mainKey !== 'k' || !modOk) return;
      e.preventDefault();
      toggleSessionList();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSessionList]);

  useEffect(() => {
    const scroll = tabScrollRef.current;
    const list = tabListRef.current;
    if (!scroll || !list) return;
    const check = () => setTabsOverflow(list.scrollWidth > scroll.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(scroll);
    ro.observe(list);
    return () => ro.disconnect();
  }, [sessions]);

  return {
    handleToggleMaximise,
    handleTopbarDoubleClick,
    showSessionList,
    setShowSessionList,
    sessionListPos,
    sessionListQuery,
    setSessionListQuery,
    sessionListBtnRef,
    sessionListRef,
    toggleSessionList,
    tabsOverflow,
    tabScrollRef,
    tabListRef,
    tabActionsRef,
  };
}
