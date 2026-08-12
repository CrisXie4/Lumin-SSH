import { useCallback, useState } from 'react';

const RECENT_CONNECTIONS_KEY = 'recentConnectionIds';
const RECENT_CONNECTIONS_MAX = 30;

function readRecentConnectionIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_CONNECTIONS_KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && !!id) : [];
  } catch {
    return [];
  }
}

export type ServerListViewMode = 'grid' | 'table';
export type DashboardHostPageMode = 'hosts' | 'recent';

export interface UseDashboardPreferencesResult {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  serverListViewMode: ServerListViewMode;
  setServerListViewMode: (mode: unknown) => void;
  hideSensitive: boolean;
  setHideSensitive: (value: boolean) => void;
  dashboardHostPageMode: DashboardHostPageMode;
  setDashboardHostPageMode: (mode: unknown) => void;
  recentConnectionIds: string[];
  recordRecentConnection: (serverId: string) => void;
  clearRecentConnections: () => void;
  removeRecentConnection: (serverId: string) => void;
  removeRecentConnections: (serverIds: unknown) => void;
}

export default function useDashboardPreferences(): UseDashboardPreferencesResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [serverListViewMode, setServerListViewModeState] = useState<ServerListViewMode>(() => localStorage.getItem('serverListViewMode') === 'table' ? 'table' : 'grid');
  const [hideSensitive, setHideSensitiveState] = useState(() => localStorage.getItem('hideSensitive') === 'true');
  const [dashboardHostPageMode, setDashboardHostPageModeState] = useState<DashboardHostPageMode>(
    () => (localStorage.getItem('dashboardHostPageMode') === 'recent' ? 'recent' : 'hosts'),
  );
  const [recentConnectionIds, setRecentConnectionIds] = useState<string[]>(readRecentConnectionIds);

  const setServerListViewMode = useCallback((mode: unknown) => {
    const next: ServerListViewMode = mode === 'table' ? 'table' : 'grid';
    setServerListViewModeState(next);
    localStorage.setItem('serverListViewMode', next);
  }, []);

  const setHideSensitive = useCallback((value: boolean) => {
    setHideSensitiveState(value);
    localStorage.setItem('hideSensitive', value ? 'true' : 'false');
  }, []);

  const setDashboardHostPageMode = useCallback((mode: unknown) => {
    const next: DashboardHostPageMode = mode === 'recent' ? 'recent' : 'hosts';
    setDashboardHostPageModeState(next);
    localStorage.setItem('dashboardHostPageMode', next);
  }, []);

  const recordRecentConnection = useCallback((serverId: string) => {
    if (!serverId) return;
    setRecentConnectionIds((prev) => {
      const next = [serverId, ...prev.filter((id) => id !== serverId)].slice(0, RECENT_CONNECTIONS_MAX);
      localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecentConnections = useCallback(() => {
    setRecentConnectionIds([]);
    localStorage.removeItem(RECENT_CONNECTIONS_KEY);
  }, []);

  const removeRecentConnection = useCallback((serverId: string) => {
    if (!serverId) return;
    setRecentConnectionIds((prev) => {
      const next = prev.filter((id) => id !== serverId);
      localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeRecentConnections = useCallback((serverIds: unknown) => {
    const idSet = new Set(Array.isArray(serverIds) ? serverIds.filter((id): id is string => typeof id === 'string') : []);
    if (idSet.size === 0) return;
    setRecentConnectionIds((prev) => {
      const next = prev.filter((id) => !idSet.has(id));
      localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    serverListViewMode,
    setServerListViewMode,
    hideSensitive,
    setHideSensitive,
    dashboardHostPageMode,
    setDashboardHostPageMode,
    recentConnectionIds,
    recordRecentConnection,
    clearRecentConnections,
    removeRecentConnection,
    removeRecentConnections,
  };
}
