import { useCallback, useEffect, useRef, useState } from 'react';
import * as AppGo from '../../../wailsjs/go/wailsapp/App.js';
import { useTranslation } from '../../i18n.ts';
import { translateProbeError, type ProbeInfo } from '../probe/probeTypes.ts';
import {
  BIG_SCREEN_FETCH_TIMEOUT_MS,
  BIG_SCREEN_HISTORY,
  createEmptyPoint,
  getBigScreenInterval,
  type BigScreenPoint,
  type BigScreenStatic,
  type BigScreenTarget,
} from './bigScreenTypes.ts';

const pushHist = (prev: number[], next: number) => [...prev, next].slice(-BIG_SCREEN_HISTORY);

export function useBigScreenData(targets: BigScreenTarget[], enabled: boolean) {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, BigScreenPoint>>({});
  const [staticInfo, setStaticInfo] = useState<Record<string, BigScreenStatic>>({});
  const [intervalSec, setIntervalSec] = useState(getBigScreenInterval);

  const dataRef = useRef(data);
  dataRef.current = data;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const staticRef = useRef(staticInfo);
  staticRef.current = staticInfo;
  const timersRef = useRef<Map<string, number>>(new Map());
  // 在途请求跟踪：超时只放弃等待，底层 SSH 采集仍在跑，必须阻止同一 serverId 重叠请求
  const inflightRef = useRef<Set<string>>(new Set());
  const runIdRef = useRef(0);
  const intervalRef = useRef(intervalSec);
  intervalRef.current = intervalSec;

  const mergePoint = useCallback((serverId: string, patch: Partial<BigScreenPoint>) => {
    setData((prev) => {
      const base = prev[serverId] || createEmptyPoint();
      return { ...prev, [serverId]: { ...base, ...patch } };
    });
  }, []);

  const fetchOne = useCallback(async (target: BigScreenTarget, runId: number) => {
    if (inflightRef.current.has(target.serverId)) return;
    inflightRef.current.add(target.serverId);
    mergePoint(target.serverId, { loading: true });
    let timeoutTimer: number | undefined;
    // 超时只是放弃等待，底层 SSH 采集仍在跑：底层 promise 结算（哪怕晚于超时）才释放在途标记
    const requestPromise = AppGo.SystemInfoLite(target.sessionId);
    requestPromise
      .finally(() => {
        inflightRef.current.delete(target.serverId);
      })
      .catch(() => { /* race 结算后到达的迟到拒绝在此吞掉 */ });
    try {
      const raw = await Promise.race([
        requestPromise,
        new Promise<never>((_, reject) => {
          timeoutTimer = window.setTimeout(
            () => reject(new Error('PROBE_FETCH_TIMEOUT')),
            BIG_SCREEN_FETCH_TIMEOUT_MS,
          );
        }),
      ]);
      if (runId !== runIdRef.current) return;
      const si = staticRef.current[target.serverId] || {};
      const uptimeData = (raw.uptime || {}) as { days?: number; hours?: number; mins?: number };
      let uptimeStr = t('0 小时');
      if ((uptimeData.days || 0) > 0) {
        uptimeStr = `${uptimeData.days}${t('天')} ${uptimeData.hours}${t('小时')}`;
      } else if ((uptimeData.hours || 0) > 0) {
        uptimeStr = `${uptimeData.hours}${t('小时')} ${uptimeData.mins}${t('分')}`;
      } else {
        uptimeStr = `${uptimeData.mins || 0}${t('分钟')}`;
      }
      const ni: ProbeInfo = {
        os: si.os || 'Linux',
        timezone: si.timezone || 'UTC',
        cpuModel: si.cpuModel || '',
        ip: si.ip || '',
        uptime: uptimeStr,
        load1: raw.load?.load1 || 0,
        load5: raw.load?.load5 || 0,
        load15: raw.load?.load15 || 0,
        cpuUsage: raw.cpu?.usage || 0,
        cpuCores: raw.cpu?.cores || [],
        memUsed: raw.memory?.used || 0,
        memTotal: raw.memory?.total || 0,
        memCache: raw.memory?.cache || 0,
        memFree: raw.memory?.free || 0,
        swapTotal: raw.memory?.swapTotal || 0,
        swapUsed: raw.memory?.swapUsed || 0,
        diskDevice: raw.disk?.device || 'disk',
        diskTotal: raw.disk?.total || 0,
        diskUsed: raw.disk?.used || 0,
        diskPercent: raw.disk?.usage || 0,
        diskReadSpeed: raw.disk?.readSpeed || 0,
        diskWriteSpeed: raw.disk?.writeSpeed || 0,
        diskPartitions: raw.disk?.partitions || [],
        netUp: raw.network?.uploadSpeed || 0,
        netDown: raw.network?.downloadSpeed || 0,
        netUpTotal: raw.network?.uploadTotal || 0,
        netDownTotal: raw.network?.downloadTotal || 0,
        networkInterfaces: raw.network?.interfaces || [],
      };
      const prevPoint = dataRef.current[target.serverId] || createEmptyPoint();
      mergePoint(target.serverId, {
        info: ni,
        hist: {
          cpu: pushHist(prevPoint.hist.cpu, ni.cpuUsage || 0),
          up: pushHist(prevPoint.hist.up, ni.netUp || 0),
          down: pushHist(prevPoint.hist.down, ni.netDown || 0),
        },
        loading: false,
        error: '',
        errorCount: 0,
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      const rawMessage = err instanceof Error ? err.message : String(err || '');
      const prevPoint = dataRef.current[target.serverId] || createEmptyPoint();
      mergePoint(target.serverId, {
        loading: false,
        error: translateProbeError(rawMessage),
        errorCount: prevPoint.errorCount + 1,
        updatedAt: prevPoint.updatedAt,
      });
    } finally {
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    }
  }, [mergePoint, t]);

  useEffect(() => {
    if (!enabled) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    targets.forEach((target, index) => {
      // 每台服务器独立 setTimeout 链，错峰启动避免同时打满
      let stopped = false;
      const tick = async () => {
        await fetchOne(target, runId);
        if (stopped || runId !== runIdRef.current) return;
        const timer = window.setTimeout(tick, intervalRef.current * 1000);
        timersRef.current.set(target.serverId, timer);
      };
      const first = window.setTimeout(tick, index * 250);
      timersRef.current.set(target.serverId, first);
    });

    return () => {
      runIdRef.current = runId + 1;
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchOne, targets]);

  // 静态信息（OS/时区/CPU 型号）每个会话只取一次
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    targets.forEach((target) => {
      if (staticRef.current[target.serverId]) return;
      AppGo.GetServerStaticInfo(target.sessionId).then((info) => {
        if (!mounted) return;
        setStaticInfo((prev) => ({
          ...prev,
          [target.serverId]: {
            os: info.os || 'Linux',
            timezone: info.timezone || 'UTC',
            cpuModel: info.cpu?.model || '',
            ip: info.ip || '',
          },
        }));
      }).catch(() => {
        // 失败时占位，避免每次采集都重试
        if (!mounted) return;
        setStaticInfo((prev) => prev[target.serverId] ? prev : { ...prev, [target.serverId]: {} });
      });
    });
    return () => { mounted = false; };
  }, [enabled, targets]);

  useEffect(() => {
    if (!enabled) return;
    const handleIntervalChange = () => setIntervalSec(getBigScreenInterval());
    window.addEventListener('probeIntervalChanged', handleIntervalChange);
    return () => window.removeEventListener('probeIntervalChanged', handleIntervalChange);
  }, [enabled]);

  return { data, staticInfo, intervalSec };
}
