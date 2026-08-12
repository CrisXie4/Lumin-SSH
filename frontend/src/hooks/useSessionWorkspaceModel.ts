import { useEffect, useMemo } from 'react';
import { sortTerminalPaneCells, type TerminalPaneLayout } from '../utils/terminalPaneLayout.ts';
import type { SessionLike } from '../utils/sessionWorkspace.ts';

export interface UseSessionWorkspaceModelOptions {
  activeSessionId: string | null;
  activeTerminalId: string | null;
  getEffectiveTerminals: (session: SessionLike) => Array<{ id: string }>;
  getSessionWorkspaceTabs: (session: SessionLike) => unknown[];
  lastTerminalRef: React.MutableRefObject<Record<string, string>>;
  rememberSessionActiveTerminal: (sessionId: string, terminalId: string, label: string) => void;
  resolveSessionRootTerminalId: (
    session: SessionLike,
    fallbackTerminalId: string,
    layouts: Record<string, TerminalPaneLayout>,
    label: string,
  ) => string | null;
  restoringWorkspaceRef: React.MutableRefObject<boolean>;
  sessions: SessionLike[];
  sessionsRef: React.MutableRefObject<SessionLike[]>;
  setActiveTerminalId: (terminalId: string | null) => void;
  setTerminalPaneLayouts: React.Dispatch<React.SetStateAction<Record<string, TerminalPaneLayout>>>;
  terminalPaneLayouts: Record<string, TerminalPaneLayout>;
}

export interface UseSessionWorkspaceModelResult {
  activeSession: SessionLike | undefined;
  activeSessionRootTerminals: unknown[];
  isActiveSessionConnected: boolean;
  isSessionWorkspaceVisible: (session: SessionLike | null | undefined) => boolean;
}

export default function useSessionWorkspaceModel({
  activeSessionId,
  activeTerminalId,
  getEffectiveTerminals,
  getSessionWorkspaceTabs,
  lastTerminalRef,
  rememberSessionActiveTerminal,
  resolveSessionRootTerminalId,
  restoringWorkspaceRef,
  sessions,
  sessionsRef,
  setActiveTerminalId,
  setTerminalPaneLayouts,
  terminalPaneLayouts,
}: UseSessionWorkspaceModelOptions): UseSessionWorkspaceModelResult {
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId],
  );
  const isActiveSessionConnected = activeSession?.status === 'connected';
  const isSessionWorkspaceVisible = (session: SessionLike | null | undefined) => !!session;
  const activeSessionRootTerminals = useMemo(
    () => (activeSession ? getSessionWorkspaceTabs(activeSession) : []),
    [activeSession, getSessionWorkspaceTabs],
  );

  useEffect(() => {
    if (restoringWorkspaceRef.current) {
      return;
    }
    setTerminalPaneLayouts((prev) => {
      let changed = false;
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));
      const next: Record<string, TerminalPaneLayout> = {};
      Object.entries(prev).forEach(([layoutId, layout]) => {
        const session = sessionMap.get(layout?.sessionId as string);
        if (!session) {
          changed = true;
          return;
        }
        const validTerminalIds = new Set(getEffectiveTerminals(session).map((term) => term.id));
        if (!validTerminalIds.has(layout.rootTerminalId || layoutId)) {
          changed = true;
          return;
        }
        const nextPanes = (layout?.panes || [])
          .filter((pane) => validTerminalIds.has(pane.terminalId))
          .map((pane) => ({ ...pane, cells: sortTerminalPaneCells(pane.cells) }));
        if (nextPanes.length !== (layout?.panes || []).length) {
          changed = true;
        }
        next[layoutId] = {
          ...layout,
          sessionId: session.id,
          rootTerminalId: layout.rootTerminalId || layoutId,
          panes: nextPanes,
        };
      });
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [getEffectiveTerminals, restoringWorkspaceRef, sessions, setTerminalPaneLayouts]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    const session = sessionsRef.current.find((item) => item.id === activeSessionId);
    if (!session) {
      return;
    }
    const fallbackTerminalId = activeTerminalId
      || String(session.activeTerminalId || '')
      || lastTerminalRef.current[activeSessionId];
    const nextTerminalId = resolveSessionRootTerminalId(
      session,
      fallbackTerminalId,
      terminalPaneLayouts,
      String(session.activeTerminalLabel || ''),
    );
    if (nextTerminalId && nextTerminalId !== activeTerminalId) {
      setActiveTerminalId(nextTerminalId);
      rememberSessionActiveTerminal(activeSessionId, nextTerminalId, String(session.activeTerminalLabel || ''));
    }
  }, [activeSessionId, activeTerminalId, lastTerminalRef, rememberSessionActiveTerminal, resolveSessionRootTerminalId, sessions, sessionsRef, setActiveTerminalId, terminalPaneLayouts]);

  return { activeSession, activeSessionRootTerminals, isActiveSessionConnected, isSessionWorkspaceVisible };
}
