import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as AppGo from '../../wailsjs/go/wailsapp/App.js';

const DEFAULT_PING_INTERVAL = 2;
const OFFLINE_FAIL_THRESHOLD = 2;

/** 单个服务器的 ping 结果 */
export interface ServerPingResult {
  online: boolean;
  latency: number | null;
}

/** 服务器列表项（宽松形状） */
export interface PingServerLike {
  id: string;
  [key: string]: unknown;
}

export interface UseServerPingOptions {
  serversRef: React.RefObject<PingServerLike[] | null>;
  activeSessionId: string | null;
  dashboardHostPageMode: string;
}

export interface PingCounts {
  online: number;
  offline: number;
  total: number;
}

export interface UseServerPingResult {
  pings: Record<string, ServerPingResult>;
  pingEnabled: boolean;
  pingInterval: number;
  pingMode: string;
  isRefreshingPing: boolean;
  pingCounts: PingCounts;
  pingAll: () => Promise<void>;
  handleRefreshPing: () => Promise<void>;
}

function readPingInterval(): number {
  const value = Number.parseInt(localStorage.getItem('pingInterval') || String(DEFAULT_PING_INTERVAL), 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PING_INTERVAL;
}

/** 限定并发的 map：避免一次性发起大量 Wails RPC 冲垮 dev 桥接的回调表（Callback not registered）。 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export default function useServerPing({ serversRef, activeSessionId, dashboardHostPageMode }: UseServerPingOptions): UseServerPingResult {
  const [pings, setPings] = useState<Record<string, ServerPingResult>>({});
  const [isRefreshingPing, setIsRefreshingPing] = useState(false);
  const [pingInterval, setPingInterval] = useState(readPingInterval);
  const [pingEnabled, setPingEnabled] = useState(() => localStorage.getItem('pingEnabled') !== 'false');
  const [pingMode, setPingMode] = useState(() => localStorage.getItem('pingMode') || 'auto');
  const pingTimerRef = useRef<number | null>(null);
  const pingInFlightRef = useRef(false);
  const pingModeRef = useRef(pingMode);
  const pingFailCountRef = useRef<Record<string, number>>({});
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    pingModeRef.current = pingMode;
  }, [pingMode]);

  useEffect(() => {
    const handler = () => setPingInterval(readPingInterval());
    window.addEventListener('pingIntervalChanged', handler);
    return () => window.removeEventListener('pingIntervalChanged', handler);
  }, []);

  useEffect(() => {
    const handler = () => setPingEnabled(localStorage.getItem('pingEnabled') !== 'false');
    window.addEventListener('pingEnabledChanged', handler);
    return () => window.removeEventListener('pingEnabledChanged', handler);
  }, []);

  useEffect(() => {
    const handler = () => setPingMode(localStorage.getItem('pingMode') || 'auto');
    window.addEventListener('pingModeChanged', handler);
    return () => window.removeEventListener('pingModeChanged', handler);
  }, []);

  const pingAll = useCallback(async () => {
    if (pingInFlightRef.current) return;
    const list = Array.isArray(serversRef.current) ? serversRef.current : [];
    if (list.length === 0) return;
    pingInFlightRef.current = true;
    try {
      const results = await mapWithConcurrency(list, 5, async (server) => {
        try {
          const result = await AppGo.PingServer(server.id, pingModeRef.current);
          return { id: server.id, ...result };
        } catch {
          return { id: server.id, online: false, latency: null };
        }
      });
      const failCounts = pingFailCountRef.current;
      setPings((prev) => {
        const next: Record<string, ServerPingResult> = {};
        results.forEach((result) => {
          if (result.online) {
            delete failCounts[result.id];
            next[result.id] = { online: true, latency: result.latency };
            return;
          }
          failCounts[result.id] = (failCounts[result.id] || 0) + 1;
          next[result.id] = failCounts[result.id] >= OFFLINE_FAIL_THRESHOLD
            ? { online: false, latency: prev[result.id]?.latency ?? null }
            : (prev[result.id] ? { ...prev[result.id] } : { online: false, latency: null });
        });
        return next;
      });
    } finally {
      pingInFlightRef.current = false;
    }
  }, [serversRef]);

  useEffect(() => {
    if (activeSessionId !== null || dashboardHostPageMode !== 'hosts') return undefined;
    if (!pingEnabled) {
      setPings({});
      pingFailCountRef.current = {};
      return undefined;
    }
    void pingAll();
    pingTimerRef.current = window.setInterval(pingAll, pingInterval * 1000);
    return () => {
      window.clearInterval(pingTimerRef.current!);
      pingTimerRef.current = null;
    };
  }, [activeSessionId, dashboardHostPageMode, pingAll, pingEnabled, pingInterval]);

  const handleRefreshPing = useCallback(async () => {
    if (!pingEnabled || isRefreshingPing) return;
    setIsRefreshingPing(true);
    await pingAll();
    refreshTimerRef.current = window.setTimeout(() => setIsRefreshingPing(false), 800);
  }, [isRefreshingPing, pingAll, pingEnabled]);

  useEffect(() => () => {
    window.clearInterval(pingTimerRef.current!);
    window.clearTimeout(refreshTimerRef.current!);
  }, []);

  const pingCounts = useMemo<PingCounts>(() => {
    const values = Object.values(pings);
    return {
      online: values.filter((value) => value.online).length,
      offline: values.filter((value) => !value.online).length,
      total: values.length,
    };
  }, [pings]);

  return {
    pings,
    pingEnabled,
    pingInterval,
    pingMode,
    isRefreshingPing,
    pingCounts,
    pingAll,
    handleRefreshPing,
  };
}
