import React, { useState, useEffect, useCallback, useRef, useMemo, type ReactNode, type CSSProperties } from 'react';
import * as AppGo from '../../wailsjs/go/wailsapp/App.js';
import type { sshmanager } from '../../wailsjs/go/models.ts';
import {
  formatCapacity,
  formatPartitionCapacity,
  formatRate,
  formatTransferTotal,
} from './probeFormatting.ts';
import { BarChart3, Cpu, HardDrive, Globe, ClipboardList, Clipboard, Search, Check, Monitor, EyeOff, Eye, RefreshCw, MemoryStick, ArrowLeftRight, Gauge, GripVertical, Power, Play, Trash2, Plus, ArrowRight } from 'lucide-react';
import Tiptop from './Tiptop.tsx';
import { Z } from '../constants/zIndex.ts';
import { useTranslation, t, type I18nKey } from '../i18n.ts';

const HISTORY_SIZE = 30;
// ponytail: 前端 fetch 超时兜底。后端 deployProbeScript(15s)+executeCmd(30s) 最坏约 45s,
// 设 50s 略余。超时保证递归 setTimeout 链不断裂,避免后端 hang 时面板永久停在旧数据。
const PROBE_FETCH_TIMEOUT_MS = 50000;

export interface ProbeHist {
  cpu: number[];
  up: number[];
  down: number[];
}

export interface ProbeInfo {
  os?: string;
  timezone?: string;
  cpuModel?: string;
  ip?: string;
  uptime?: string;
  load1?: number;
  load5?: number;
  load15?: number;
  cpuUsage?: number;
  cpuCores?: number[];
  memUsed?: number;
  memTotal?: number;
  memCache?: number;
  memFree?: number;
  swapTotal?: number;
  swapUsed?: number;
  diskDevice?: string;
  diskTotal?: number;
  diskUsed?: number;
  diskPercent?: number;
  diskReadSpeed?: number;
  diskWriteSpeed?: number;
  diskPartitions?: Array<{ mount?: string; size?: string; avail?: string; usedPct?: number }>;
  netUp?: number;
  netDown?: number;
  netUpTotal?: number;
  netDownTotal?: number;
  networkInterfaces?: Array<{ name?: string; uploadSpeed?: number; downloadSpeed?: number }>;
  processes?: Array<{ pid?: number | string; cpu?: number; mem?: number; cmd?: string }>;
}

export interface ProbeSnapshot {
  info: ProbeInfo | null;
  hist: ProbeHist;
}

export interface ProbePanelProps {
  sessionId: string;
  host: string;
  addToast: (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number;
  enabled: boolean;
  active: boolean;
  snapshot?: ProbeSnapshot;
  onSnapshot: (snapshot: ProbeSnapshot) => void;
  onEnable: () => void;
  onShowAllProcesses: () => void;
  onShowNetworkDetails: () => void;
  onOpenPortForward: () => void;
}

const clampPct = (value: number) => Math.min(Math.max(Number(value) || 0, 0), 100);
const pctColor = (pct: number, warn = 60, danger = 85) => pct >= danger ? 'var(--danger)' : pct >= warn ? 'var(--warning)' : 'var(--success)';
const createEmptyHist = (): ProbeHist => ({ cpu: Array(HISTORY_SIZE).fill(0), up: Array(HISTORY_SIZE).fill(0), down: Array(HISTORY_SIZE).fill(0) });
const PROBE_CARD_ORDER_KEY = 'probePanelCardOrder';
const PROBE_CARD_ORDER_CHANGED_EVENT = 'probeCardOrderChanged';
const DEFAULT_PROBE_CARD_ORDER = ['overview', 'cpu', 'memory', 'network', 'disk', 'process', 'portforward'];
const PROBE_HIDE_IP_KEY = 'probeHideIP';
const PROBE_HIDE_IP_CHANGED_EVENT = 'probeHideIPChanged';

const normalizeProbeCardOrder = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const next: string[] = [];
  source.forEach((item) => {
    if (typeof item === 'string' && DEFAULT_PROBE_CARD_ORDER.includes(item) && !seen.has(item)) {
      seen.add(item);
      next.push(item);
    }
  });
  DEFAULT_PROBE_CARD_ORDER.forEach((item) => {
    if (!seen.has(item)) next.push(item);
  });
  return next;
};

const readProbeCardOrder = (): string[] => {
  try {
    return normalizeProbeCardOrder(JSON.parse(localStorage.getItem(PROBE_CARD_ORDER_KEY) || '[]'));
  } catch (_) {
    return [...DEFAULT_PROBE_CARD_ORDER];
  }
};

const persistProbeCardOrder = (order: string[]) => {
  const next = normalizeProbeCardOrder(order);
  localStorage.setItem(PROBE_CARD_ORDER_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PROBE_CARD_ORDER_CHANGED_EVENT, { detail: next }));
};

const reorderProbeCard = (order: string[], activeId: string, targetId: string, position: 'before' | 'after') => {
  if (!activeId || !targetId || activeId === targetId) return order;
  const next = order.filter((item) => item !== activeId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return order;
  next.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, activeId);
  return next;
};

const readProbeHideIP = () => localStorage.getItem(PROBE_HIDE_IP_KEY) === 'true';

// ponytail: 所有会话的面板同时挂载（非当前会话仅 display:none），
// 故隐藏 IP 必须广播，否则只有点击的那个面板会变。
const persistProbeHideIP = (hide: boolean) => {
  localStorage.setItem(PROBE_HIDE_IP_KEY, String(hide));
  window.dispatchEvent(new CustomEvent(PROBE_HIDE_IP_CHANGED_EVENT, { detail: hide }));
};

// ── Sparkline SVG ──────────────────────────────────────────────────────────
interface SparklineSeries {
  data: number[];
  color: string;
  fill?: boolean;
}

const Sparkline = React.memo(function Sparkline({ data, series, height = 42 }: { data?: number[]; series?: SparklineSeries[]; height?: number }) {
  const lines = useMemo(() => {
    if (Array.isArray(series) && series.length > 0) return series;
    return [{ data: data || [], color: 'var(--success)', fill: true }];
  }, [data, series]);
  const max = useMemo(() => Math.max(...lines.flatMap(item => item.data || []), 1), [lines]);
  const paths = useMemo(() => lines.map((item) => {
    const pts = item.data || [];
    if (pts.length < 2) return { ...item, points: '', fillPts: '' };
    const W = 200;
    const p = pts.map((v, i) => `${(i / (pts.length - 1)) * W},${height - (clampPct(v / max * 100) / 100) * (height - 3) - 1}`).join(' ');
    return { ...item, points: p, fillPts: `0,${height} ${p} 200,${height}` };
  }), [height, lines, max]);
  if (!paths.some(item => item.points)) return <div className="probe-sparkline-empty" style={{ height }} />;
  return (
    <svg className="probe-sparkline" viewBox={`0 0 200 ${height}`} preserveAspectRatio="none" style={{ height }}>
      {paths.map((item, index) => item.points && item.fill ? (
        <polygon key={`fill-${index}`} points={item.fillPts} style={{ fill: item.color }} opacity={0.10} />
      ) : null)}
      {paths.map((item, index) => item.points ? (
        <polyline key={`line-${index}`} points={item.points} fill="none" style={{ stroke: item.color }} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
      ) : null)}
    </svg>
  );
});

// ── Memory Donut ──────────────────────────────────────────────────────────
const MemDonut = React.memo(function MemDonut({ used, free, total }: { used: number; free: number; total: number }) {
  const r = 27; const cx = 35; const cy = 35;
  const circ = 2 * Math.PI * r;
  // 用 available 分割，保证三段 = 100%
  const f1 = total > 0 ? Math.min(Math.max(used / total, 0), 1) : 0;
  const reclaimable = Math.max(total - used - free, 0);
  const f2 = total > 0 ? Math.min(Math.max(reclaimable / total, 0), 1 - f1) : 0;
  const f3 = Math.max(1 - f1 - f2, 0);
  const seg = (frac: number, color: string, start: number) => frac > 0.005 ? (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
      strokeDasharray={`${frac * circ} ${circ}`}
      strokeLinecap="butt"
      transform={`rotate(${-90 + start * 360} ${cx} ${cy})`} />
  ) : null;
  return (
    <svg width={70} height={70} className="probe-mem-donut" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      {seg(f1, 'var(--danger)', 0)}
      {seg(f2, 'var(--warning)', f1)}
      {seg(f3, 'var(--success)', f1 + f2)}
    </svg>
  );
});

// ── Common pieces ─────────────────────────────────────────────────────────
const ProgressBar = React.memo(function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = clampPct(value);
  return (
    <div className="probe-progress-track">
      <div className="probe-progress-fill" style={{ width: `${pct}%`, background: color || pctColor(pct) }} />
    </div>
  );
});

const Card = React.memo(function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`probe-card ${className}`} style={style}>{children}</div>;
});

interface DragHandleProps {
  draggable: boolean;
  dragReady: boolean;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

const SectionHeader = React.memo(function SectionHeader({ icon, title, badge, action, dragHandleProps = null }: { icon: ReactNode; title: ReactNode; badge?: ReactNode; action?: ReactNode; dragHandleProps?: DragHandleProps | null }) {
  return (
    <div className="probe-section-header">
      <div
        className={`probe-section-handle${dragHandleProps ? ' probe-section-handle-sortable' : ''}${dragHandleProps?.dragReady ? ' is-ready' : ''}${dragHandleProps?.dragging ? ' is-dragging' : ''}`}
        draggable={dragHandleProps?.draggable || false}
        onPointerDown={dragHandleProps?.onPointerDown}
        onPointerUp={dragHandleProps?.onPointerUp}
        onPointerCancel={dragHandleProps?.onPointerCancel}
        onDragStart={dragHandleProps?.onDragStart}
        onDragEnd={dragHandleProps?.onDragEnd}
      >
        <span className="probe-section-icon">{icon}</span>
        <span className="probe-section-title">{title}</span>
        <span className="probe-section-spacer" />
        <span className="probe-section-handle-hint" aria-hidden="true"><GripVertical size={13} /></span>
      </div>
      {badge ? <span className="probe-section-badge">{badge}</span> : null}
      {action}
    </div>
  );
});

const MetricCard = React.memo(function MetricCard({ label, value, sub, color, icon, progress = null }: { label: string; value: ReactNode; sub?: string; color?: string; icon?: ReactNode; progress?: number | null }) {
  const hasProgress = progress !== null;
  return (
    <div className="probe-metric-card">
      <div className="probe-metric-main">
        <div className="probe-metric-top">
          <span className="probe-metric-icon" style={{ color }}>{icon}</span>
          <span className="probe-metric-label" title={label}>{label}</span>
        </div>
        {sub ? <div className="probe-metric-sub" title={sub}>{sub}</div> : null}
      </div>
      <div className="probe-metric-value" style={{ color }}>{value}</div>
      {hasProgress ? <div className="probe-metric-bar"><ProgressBar value={progress} color={color} /></div> : null}
    </div>
  );
});

const CpuBar = React.memo(function CpuBar({ val = 0 }: { val?: number }) {
  const pct = clampPct(val);
  return <ProgressBar value={pct} color={pctColor(pct, 50, 80)} />;
});

const CoreHeatGrid = React.memo(function CoreHeatGrid({ cores }: { cores: number[] }) {
  return (
    <div className="probe-core-grid">
      {cores.map((val, i) => {
        const pct = clampPct(val);
        return (
          <div
            key={i}
            className="probe-core-cell"
            title={`CPU ${i}: ${pct.toFixed(1)}%`}
            style={{ background: pctColor(pct, 50, 80), opacity: 0.32 + (pct / 100) * 0.68 }}
          />
        );
      })}
    </div>
  );
});

const PartRow = React.memo(function PartRow({ mount, size, avail, usedPct }: { mount?: string; size?: string; avail?: string; usedPct?: number }) {
  const pct = clampPct(usedPct || 0);
  const color = pctColor(pct, 60, 85);
  return (
    <div className="probe-partition-row">
      <span className="probe-partition-mount" title={mount}>{mount}</span>
      <div className="probe-partition-bar">
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span className="probe-partition-value" title={String(size)}>{formatPartitionCapacity(size)}</span>
      <span className="probe-partition-value" title={String(avail)}>{formatPartitionCapacity(avail)}</span>
      <span className="probe-partition-percent" style={{ color }}>{Math.round(pct)}%</span>
    </div>
  );
});

const ProcessHotRow = React.memo(function ProcessHotRow({ process }: { process: { cpu?: number; mem?: number; cmd?: string } }) {
  const pct = clampPct(process.cpu || 0);
  return (
    <div className="probe-process-row">
      <div className="probe-process-cpu-cell">
        <span className="probe-process-cpu">{(process.cpu || 0).toFixed(1)}%</span>
        <CpuBar val={pct} />
      </div>
      <span className="probe-process-mem">{formatCapacity(process.mem || 0, 1)}</span>
      <span className="probe-process-cmd" title={process.cmd}>{process.cmd}</span>
    </div>
  );
});

// ── Format helpers ─────────────────────────────────────────────────────────
const fmem = (mb: number) => formatCapacity(mb, 1);
const fdisk = (gb: number) => formatCapacity((Number(gb) || 0) * 1024, 1);
const fspeed = (kb: number) => formatRate(kb);
const ftotal = (mb: number) => formatTransferTotal(mb);

function isInternalIP(ip: string): boolean {
  if (!ip) return true;
  const addr = ip.trim();
  // IPv6：回环 ::1、链路本地 fe80::/10、唯一本地 fc00::/7
  if (addr.includes(':')) {
    const lower = addr.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    const head = parseInt(lower.split(':')[0] || '0', 16);
    if (Number.isNaN(head)) return true;
    if (head >= 0xfe80 && head <= 0xfebf) return true;
    if (head >= 0xfc00 && head <= 0xfdff) return true;
    return false;
  }
  const parts = addr.split('.');
  if (parts.length !== 4) return true;
  const octets = parts.map((part) => parseInt(part, 10));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 169 && octets[1] === 254) return true; // 链路本地
  return false;
}

// ponytail: 掩码按地址形态走，否则 IPv6/主机名会被套上 IPv4 形状的 ***.***.***.***
const maskAddress = (addr: string) => {
  if (!addr) return '';
  if (addr.includes(':')) return '****:****:****:****';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return '***.***.***.***';
  return '*'.repeat(Math.min(addr.length, 16));
};

function ProbeHeader({ t, info, displayIP, hideIP, addToast }: { t: (key: I18nKey) => string; info: ProbeInfo; displayIP: string; hideIP: boolean; addToast?: (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number }) {
  const osParts = info.os?.split(' ') || ['Linux'];
  // ponytail: 隐藏时 toast 不回显 IP，否则点一下复制就把刚藏起来的地址暴露在屏幕上
  const handleCopyIP = () => {
    navigator.clipboard.writeText(displayIP)
      .then(() => addToast?.(hideIP ? t('已复制') : `${t('已复制')} ${displayIP}`, 'success'))
      .catch(() => addToast?.(t('复制失败'), 'error'));
  };
  return (
    <Card className="probe-header-card">
      <div className="probe-host-row">
        <div className="probe-host-title">
          <Monitor size={14} />
          <span>{t('系统监控')}</span>
        </div>
      </div>
      {displayIP && (
        <div className="probe-ip-actions">
          <span className="probe-ip-chip" title={hideIP ? '' : displayIP}>{hideIP ? maskAddress(displayIP) : displayIP}</span>
          <Tiptop text={t('复制 IP')} placement="bottom">
            <button onClick={handleCopyIP} aria-label={t('复制 IP')} className="probe-icon-btn"><Clipboard size={13} /></button>
          </Tiptop>
          <Tiptop text={hideIP ? t('显示 IP') : t('隐藏 IP')} placement="bottom">
            <button onClick={() => persistProbeHideIP(!hideIP)} aria-label={hideIP ? t('显示 IP') : t('隐藏 IP')} className="probe-icon-btn">{hideIP ? <Eye size={13} /> : <EyeOff size={13} />}</button>
          </Tiptop>
        </div>
      )}
      <div className="probe-system-grid">
        <div className="probe-os-row">
          <span className="probe-os-chip">{osParts[0]}</span>
          <span className="probe-os-detail" title={info.os}>{info.os?.replace(osParts[0], '').trim() || info.os}</span>
        </div>
        <span title={`${t('时区')} ${info.timezone}`}>{t('时区')} <b>{info.timezone}</b></span>
        <span title={`${t('运行')} ${info.uptime}`}>{t('运行')} <b>{info.uptime}</b></span>
      </div>
    </Card>
  );
}

function HealthOverview({ t, cpuAvg, memPct, diskPct, info, coreCount, dragHandleProps }: { t: (key: I18nKey) => string; cpuAvg: number; memPct: number; diskPct?: number; info: ProbeInfo; coreCount: number; dragHandleProps?: DragHandleProps | null }) {
  const netSpeed = (info.netUp || 0) + (info.netDown || 0);
  const loadPct = coreCount > 0 ? clampPct((info.load1 || 0) / coreCount * 100) : 0;
  return (
    <Card className="probe-overview-card">
      <SectionHeader icon={<BarChart3 size={14} />} title={t('概览')} dragHandleProps={dragHandleProps} />
      <div className="probe-overview-grid">
        <MetricCard label={t('系统负载')} value={`${loadPct.toFixed(0)}%`} sub={`1m ${info.load1?.toFixed(2) || '0.00'} · 5m ${info.load5?.toFixed(2) || '0.00'} · 15m ${info.load15?.toFixed(2) || '0.00'}`} color={pctColor(loadPct, 70, 100)} icon={<Gauge size={13} />} progress={loadPct} />
        <MetricCard label="CPU" value={`${cpuAvg}%`} sub={t('平均占用')} color={pctColor(cpuAvg, 50, 80)} icon={<Cpu size={13} />} progress={cpuAvg} />
        <MetricCard label={t('内存')} value={`${memPct}%`} sub={`${fmem(info.memUsed || 0)} / ${fmem(info.memTotal || 0)}`} color={pctColor(memPct, 60, 85)} icon={<MemoryStick size={13} />} progress={memPct} />
        <MetricCard label={t('磁盘')} value={`${Math.round(diskPct || 0)}%`} sub={`${fdisk(info.diskUsed || 0)} / ${fdisk(info.diskTotal || 0)}`} color={pctColor(diskPct || 0, 70, 90)} icon={<HardDrive size={13} />} progress={diskPct || 0} />
        <MetricCard label={t('网络')} value={fspeed(netSpeed)} sub={`↑ ${fspeed(info.netUp || 0)} · ↓ ${fspeed(info.netDown || 0)}`} color="var(--accent)" icon={<Globe size={13} />} />
      </div>
    </Card>
  );
}

function CpuSection({ t, info, hist, cores, cpuAvg, cpuExpanded, setCpuExpanded, dragHandleProps }: { t: (key: I18nKey) => string; info: ProbeInfo; hist: ProbeHist; cores: number[]; cpuAvg: number; cpuExpanded: boolean; setCpuExpanded: React.Dispatch<React.SetStateAction<boolean>>; dragHandleProps?: DragHandleProps | null }) {
  const showBars = cores.length <= 8 || cpuExpanded;
  return (
    <Card>
      <SectionHeader icon={<Cpu size={14} />} title={`CPU ${cores.length > 0 ? `${cores.length}${t('核')}` : ''}`} badge={`${cpuAvg}%`} dragHandleProps={dragHandleProps} />
      <Sparkline data={hist.cpu} height={44} />
      {info.cpuModel ? <div className="probe-muted-line" title={info.cpuModel}>{info.cpuModel}</div> : null}
      <CoreHeatGrid cores={cores} />
      {showBars && (
        <div className="probe-core-bars">
          {cores.map((val, i) => (
            <div key={i} className="probe-core-row">
              <span>{i}</span>
              <CpuBar val={val} />
              <b>{val.toFixed(1)}%</b>
            </div>
          ))}
        </div>
      )}
      {cores.length > 8 && (
        <button onClick={() => setCpuExpanded(v => !v)} className="probe-expand-btn">
          {cpuExpanded ? t('收起') : `${t('展开全部')} ${cores.length} ${t('核')}`}
        </button>
      )}
    </Card>
  );
}

function MemorySection({ t, info, memPct, dragHandleProps }: { t: (key: I18nKey) => string; info: ProbeInfo; memPct: number; dragHandleProps?: DragHandleProps | null }) {
  const memItems = [
    { dot: 'var(--danger)', label: t('已用'), val: fmem(info.memUsed || 0) },
    { dot: 'var(--warning)', label: t('缓存'), val: fmem(info.memCache || 0) },
    { dot: 'var(--success)', label: t('空闲'), val: fmem(info.memFree || 0) },
  ];
  const swapPct = (info.swapTotal || 0) > 0 ? clampPct((info.swapUsed || 0) / (info.swapTotal || 1) * 100) : 0;
  return (
    <Card>
      <SectionHeader icon={<MemoryStick size={14} />} title={t('内存')} badge={fmem(info.memTotal || 0)} dragHandleProps={dragHandleProps} />
      <div className="probe-memory-layout">
        <MemDonut used={info.memUsed || 0} free={info.memFree || 0} total={info.memTotal || 0} />
        <div className="probe-memory-main">
          <div className="probe-memory-total">
            <span>{t('使用率')}</span>
            <b style={{ color: pctColor(memPct, 60, 85) }}>{memPct}%</b>
          </div>
          <ProgressBar value={memPct} color={pctColor(memPct, 60, 85)} />
          <div className="probe-legend-list">
            {memItems.map(({ dot, label, val }) => (
              <div key={label} className="probe-legend-row">
                <span className="probe-dot" style={{ background: dot }} />
                <span>{label}</span>
                <b>{val}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(info.swapTotal || 0) > 0 && (
        <div className="probe-swap-box">
          <div className="probe-swap-head"><span><ArrowLeftRight size={12} /> SWAP</span><b>{fmem(info.swapUsed || 0)} / {fmem(info.swapTotal || 0)}</b></div>
          <ProgressBar value={swapPct} color="var(--info)" />
        </div>
      )}
    </Card>
  );
}

function NetworkSection({ t, info, hist, onShowNetworkDetails, dragHandleProps }: { t: (key: I18nKey) => string; info: ProbeInfo; hist: ProbeHist; onShowNetworkDetails: () => void; dragHandleProps?: DragHandleProps | null }) {
  const interfaces = Array.isArray(info.networkInterfaces) ? info.networkInterfaces : [];
  const topInterfaces = [...interfaces]
    .sort((a, b) => ((b.uploadSpeed || 0) + (b.downloadSpeed || 0)) - ((a.uploadSpeed || 0) + (a.downloadSpeed || 0)))
    .slice(0, 3);
  return (
    <Card>
      <SectionHeader
        icon={<Globe size={14} />}
        title={t('网络')}
        action={<button type="button" onClick={onShowNetworkDetails} className="probe-link-btn">{t('查看详情')}</button>}
        dragHandleProps={dragHandleProps}
      />
      <Sparkline
        height={46}
        series={[
          { data: hist.down, color: 'var(--accent)', fill: true },
          { data: hist.up, color: 'var(--success)', fill: false },
        ]}
      />
      <div className="probe-network-grid">
        {[
          { dot: 'var(--success)', label: t('上传'), speed: fspeed(info.netUp || 0), total: ftotal(info.netUpTotal || 0) },
          { dot: 'var(--accent)', label: t('下载'), speed: fspeed(info.netDown || 0), total: ftotal(info.netDownTotal || 0) },
        ].map(({ dot, label, speed, total }) => (
          <div key={label} className="probe-network-stat">
            <span><i style={{ background: dot }} />{label}</span>
            <b>{speed}</b>
            <small>{total}</small>
          </div>
        ))}
      </div>
      {topInterfaces.length > 0 && (
        <div className="probe-interface-list">
          {topInterfaces.map((item) => (
            <div key={item.name} className="probe-interface-row">
              <span title={item.name}>{item.name}</span>
              <b>↑ {fspeed(item.uploadSpeed || 0)} · ↓ {fspeed(item.downloadSpeed || 0)}</b>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DiskSection({ t, info, diskPartitions, visibleDiskPartitions, diskExpanded, setDiskExpanded, dragHandleProps }: { t: (key: I18nKey) => string; info: ProbeInfo; diskPartitions: Array<{ mount?: string; size?: string; avail?: string; usedPct?: number }>; visibleDiskPartitions: Array<{ mount?: string; size?: string; avail?: string; usedPct?: number }>; diskExpanded: boolean; setDiskExpanded: React.Dispatch<React.SetStateAction<boolean>>; dragHandleProps?: DragHandleProps | null }) {
  const diskPct = clampPct(info.diskPercent || 0);
  return (
    <Card>
      <SectionHeader icon={<HardDrive size={14} />} title={t('磁盘')} badge={`${fdisk(info.diskUsed || 0)} / ${fdisk(info.diskTotal || 0)}`} dragHandleProps={dragHandleProps} />
      <div className="probe-disk-main">
        <div className="probe-disk-head">
          <span title={info.diskDevice}>/ ({info.diskDevice})</span>
          <b style={{ color: pctColor(diskPct, 70, 90) }}>{Math.round(diskPct)}%</b>
        </div>
        <ProgressBar value={diskPct} color={pctColor(diskPct, 70, 90)} />
      </div>
      <div className="probe-io-grid">
        {[
          { label: t('读/s'), val: fspeed(info.diskReadSpeed || 0), color: 'var(--success)' },
          { label: t('写/s'), val: fspeed(info.diskWriteSpeed || 0), color: 'var(--warning)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="probe-io-card">
            <span>{label}</span>
            <b style={{ color }}>{val}</b>
          </div>
        ))}
      </div>
      <div className="probe-partition-header">
        <span>{t('挂载')}</span>
        <span></span>
        <span>{t('大小')}</span>
        <span>{t('可用')}</span>
        <span>{t('已用%')}</span>
      </div>
      {visibleDiskPartitions.map((p, i) => (
        <PartRow key={`${p.mount}-${i}`} mount={p.mount} size={p.size} avail={p.avail} usedPct={p.usedPct} />
      ))}
      {diskPartitions.length > 4 && (
        <button onClick={() => setDiskExpanded(v => !v)} className="probe-expand-btn">
          {diskExpanded ? t('收起') : `${t('展开全部')} ${diskPartitions.length} ${t('项')}`}
        </button>
      )}
    </Card>
  );
}

function ProcessSection({ t, info, onShowAllProcesses, dragHandleProps }: { t: (key: I18nKey) => string; info: ProbeInfo; onShowAllProcesses: () => void; dragHandleProps?: DragHandleProps | null }) {
  return (
    <Card className="probe-process-card">
      <SectionHeader
        icon={<ClipboardList size={14} />}
        title={t('进程管理')}
        action={<button type="button" onClick={onShowAllProcesses} className="probe-link-btn">{t('查看全部')}</button>}
        dragHandleProps={dragHandleProps}
      />
      <div className="probe-process-head">
        <span>CPU</span>
        <span>{t('内存')}</span>
        <span>{t('进程')}</span>
      </div>
      {Array.isArray(info.processes) && info.processes.length > 0 ? info.processes.slice(0, 5).map((p, i) => (
        <ProcessHotRow key={`${p.pid || i}-${p.cmd || ''}`} process={p} />
      )) : (
        <div className="probe-empty-row">{t('暂无热点进程')}</div>
      )}
    </Card>
  );
}

function PortForwardSection({ t, sessionId, active, onOpenPortForward, dragHandleProps }: { t: (key: I18nKey) => string; sessionId: string; active: boolean; onOpenPortForward: () => void; dragHandleProps?: DragHandleProps | null }) {
  const [forwards, setForwards] = useState<sshmanager.PortForwardInfo[]>([]);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const list = await AppGo.ListPortForwards(sessionId);
      if (activeRef.current) setForwards(Array.isArray(list) ? list : []);
    } catch (_) {
      // 端口映射查询失败不应打断监控面板
    }
  }, [sessionId]);

  useEffect(() => {
    setForwards([]);
    if (!sessionId || !active) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (activeRef.current) refresh();
    }, 5000);
    const handleChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: unknown }>).detail || {};
      if (!detail?.sessionId || detail.sessionId === sessionId) refresh();
    };
    window.addEventListener('port-forward-changed', handleChanged);
    return () => {
      clearInterval(timer);
      window.removeEventListener('port-forward-changed', handleChanged);
    };
  }, [sessionId, active, refresh]);

  const handleStop = useCallback(async (id: string) => {
    try {
      await AppGo.StopPortForwardForSession(sessionId, id);
      refresh();
    } catch (_) {
      // 停止失败保持原状, 下次刷新自动纠正
    }
  }, [sessionId, refresh]);

  const handleRestart = useCallback(async (id: string) => {
    try {
      await AppGo.RestartPortForwardForSession(sessionId, id);
      refresh();
    } catch (_) {
      // 重启失败下次刷新自动纠正
    }
  }, [sessionId, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await AppGo.DeletePortForwardForSession(sessionId, id);
      setForwards((prev) => prev.filter((item) => item.ID !== id));
      refresh();
    } catch (_) {
      // 删除失败下次刷新自动纠正
    }
  }, [sessionId, refresh]);

  // 方向文案对齐后端语义: local=SSH -L 本地监听→远程目标; remote=SSH -R 远程监听→本机目标
  const renderLabel = (info: sshmanager.PortForwardInfo) => {
    if (info.Kind === 'local') {
      return `${t('本地监听')} ${info.LocalAddr} → ${t('远程目标')} ${info.RemoteAddr}`;
    }
    return `${t('远程监听')} ${info.RemoteAddr} → ${t('本机目标')} ${info.LocalAddr}`;
  };

  // 本地回环地址(127.0.0.1 / localhost / ::1)只显示端口, 其余显示 host:port, 让常见场景标签更短
  const isLoopbackHost = (host: string) => {
    const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    return h === '' || h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '0.0.0.0' || h === '::';
  };
  const compactAddr = (host: string, port: string) => (isLoopbackHost(host) ? `:${port}` : `${host}:${port}`);

  // 图标化方向: 监听端 → 目标端, 用箭头图标替代冗长中文方向词, 完整语义靠 Tiptop 承载
  const renderCompactLabel = (info: sshmanager.PortForwardInfo) => {
    const listen = info.Kind === 'local'
      ? compactAddr(info.LocalHost, info.LocalPort)
      : compactAddr(info.RemoteHost, info.RemotePort);
    const target = info.Kind === 'local'
      ? compactAddr(info.RemoteHost, info.RemotePort)
      : compactAddr(info.LocalHost, info.LocalPort);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listen}</span>
        <ArrowRight size={12} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target}</span>
      </span>
    );
  };

  const iconBtn = (onClick: () => void, title: string, color: string, node: ReactNode) => (
    <Tiptop text={title}>
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        style={{ flexShrink: 0, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs, 4px)', background: 'var(--surface)', color, cursor: 'pointer', transition: 'var(--transition-fast)' }}
      >
        {node}
      </button>
    </Tiptop>
  );

  return (
    <Card>
      <SectionHeader
        icon={<ArrowLeftRight size={14} />}
        title={t('端口映射')}
        badge={forwards.length > 0 ? String(forwards.length) : undefined}
        action={(
          <Tiptop text={t('新建映射')}>
            <button type="button" onClick={onOpenPortForward} className="probe-icon-btn" aria-label={t('新建映射')}>
              <Plus size={14} />
            </button>
          </Tiptop>
        )}
        dragHandleProps={dragHandleProps}
      />
      {forwards.length === 0 ? (
        <div className="probe-empty-row">{t('当前会话没有端口映射。')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {forwards.map((info) => {
            const isLocal = info.Kind === 'local';
            const stopped = info.Enabled === false;
            const label = renderLabel(info);
            return (
              <div
                key={info.ID}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 8px)', background: 'var(--surface-raised)', opacity: stopped ? 0.6 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span
                    style={{ flexShrink: 0, width: 15, height: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1, background: isLocal ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'color-mix(in srgb, var(--success) 16%, transparent)', color: isLocal ? 'var(--accent)' : 'var(--success)' }}
                  >
                    {isLocal ? 'L' : 'R'}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tiptop text={label} className="probe-portforward-label" style={{ minWidth: 0, flex: 1 }} triggerClassName="probe-portforward-label-trigger">
                        {renderCompactLabel(info)}
                      </Tiptop>
                      {stopped && (
                        <span style={{ flexShrink: 0, fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--text-tertiary) 18%, transparent)', color: 'var(--text-tertiary)' }}>{t('已停止')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {stopped
                    ? iconBtn(() => handleRestart(info.ID), t('重启'), 'var(--success)', <Play size={13} />)
                    : iconBtn(() => handleStop(info.ID), t('停止'), 'var(--warning)', <Power size={13} />)}
                  {iconBtn(() => handleDelete(info.ID), t('删除'), 'var(--danger)', <Trash2 size={13} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 探针错误码翻译：后端返回 PROBE_ 前缀的稳定错误码（含 | 分隔的参数），
// 前端根据当前语言翻译为用户可读消息。非 PROBE_ 前缀的错误原样返回。
function translateProbeError(error: string): string {
  if (!error || !error.startsWith('PROBE_')) return error;
  const sep = error.indexOf('|');
  const code = sep === -1 ? error : error.substring(0, sep);
  const detail = sep === -1 ? '' : error.substring(sep + 1);
  switch (code) {
    case 'PROBE_CLIENT_UNAVAILABLE':
      return t('SSH 客户端不可用');
    case 'PROBE_DEPLOY_GIVEUP':
      return t('探针部署失败 {count} 次，已放弃', { count: detail });
    case 'PROBE_DEPLOY_TIMEOUT':
      return t('探针脚本部署超时（{duration}）', { duration: detail });
    case 'PROBE_DEPLOY_IO':
      return detail ? t('探针脚本部署失败：{detail}', { detail }) : t('探针脚本部署失败');
    case 'PROBE_EXEC_FAILED':
      return detail ? t('探针脚本执行失败：{detail}', { detail }) : t('探针脚本执行失败');
    case 'PROBE_FETCH_TIMEOUT':
      return t('探针数据获取超时');
    default:
      return error;
  }
}

export default function ProbePanel({ sessionId, host, addToast, enabled, active, onEnable, onShowAllProcesses, onShowNetworkDetails, onOpenPortForward, snapshot, onSnapshot }: ProbePanelProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ProbeInfo | null>(() => snapshot?.info || null);
  // ponytail: 合并 3 个历史数组为 1 个状态更新，减少 3 次渲染为 1 次
  const [hist, setHist] = useState<ProbeHist>(() => snapshot?.hist || createEmptyHist());
  const histRef = useRef(hist);
  histRef.current = hist;
  const [showConfirm, setShowConfirm] = useState(false);
  const [hideIP, setHideIP] = useState(readProbeHideIP);
  const [cpuExpanded, setCpuExpanded] = useState(false);
  const [diskExpanded, setDiskExpanded] = useState(false);
  const [probeError, setProbeError] = useState(false);
  const [probeErrorDetail, setProbeErrorDetail] = useState('');
  const probeErrorCountRef = useRef(0);
  const staticInfoRef = useRef<{ os?: string; timezone?: string; cpuModel?: string; ip?: string } | null>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  // ponytail: 跟踪当前 sessionId，用于丢弃切换服务器前在飞的异步响应（key remount 下冗余但安全）
  const activeSessionIdRef = useRef(sessionId);
  const onSnapshotRef = useRef(onSnapshot);
  const [cardOrder, setCardOrder] = useState<string[]>(readProbeCardOrder);
  const [dragReadyId, setDragReadyId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: 'before' | 'after' } | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  useEffect(() => { activeSessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);
  useEffect(() => {
    const handleOrderChanged = (event: Event) => {
      setCardOrder(normalizeProbeCardOrder((event as CustomEvent<unknown>).detail));
    };
    window.addEventListener(PROBE_CARD_ORDER_CHANGED_EVENT, handleOrderChanged);
    return () => window.removeEventListener(PROBE_CARD_ORDER_CHANGED_EVENT, handleOrderChanged);
  }, []);

  useEffect(() => {
    const handleHideIPChanged = (event: Event) => setHideIP(!!(event as CustomEvent<unknown>).detail);
    window.addEventListener(PROBE_HIDE_IP_CHANGED_EVENT, handleHideIPChanged);
    return () => window.removeEventListener(PROBE_HIDE_IP_CHANGED_EVENT, handleHideIPChanged);
  }, []);

  const clearCardDragGhost = useCallback(() => {
    if (dragGhostRef.current?.parentNode) {
      dragGhostRef.current.parentNode.removeChild(dragGhostRef.current);
    }
    dragGhostRef.current = null;
    document.body.classList.remove('probe-card-dragging-cursor');
  }, []);

  const resetCardDragState = useCallback(() => {
    setDragReadyId(null);
    setDraggingCardId(null);
    setDropIndicator(null);
    clearCardDragGhost();
  }, [clearCardDragGhost]);

  useEffect(() => clearCardDragGhost, [clearCardDragGhost]);

  useEffect(() => {
    if (!dragReadyId || draggingCardId) return;
    const handlePointerRelease = () => setDragReadyId(null);
    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    return () => {
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
    };
  }, [dragReadyId, draggingCardId]);

  // ponytail: 按下即可拖，无长按延迟；松手由上面的 pointerup 兜底清理
  const handleCardHandlePointerDown = useCallback((cardId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    setDragReadyId(cardId);
  }, []);

  const handleCardHandlePointerUp = useCallback((cardId: string) => {
    if (draggingCardId === cardId) return;
    if (dragReadyId === cardId) setDragReadyId(null);
  }, [dragReadyId, draggingCardId]);

  const handleCardDragStart = useCallback((cardId: string, event: React.DragEvent<HTMLElement>) => {
    if (dragReadyId !== cardId) {
      event.preventDefault();
      return;
    }
    setDraggingCardId(cardId);
    setDropIndicator(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardId);
    clearCardDragGhost();
    const sourceCard = event.currentTarget.closest('.probe-card-sortable');
    if (sourceCard) {
      const ghost = sourceCard.cloneNode(true) as HTMLElement;
      ghost.classList.add('probe-card-drag-ghost');
      ghost.style.width = `${sourceCard.getBoundingClientRect().width}px`;
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, 28, 18);
    }
    document.body.classList.add('probe-card-dragging-cursor');
  }, [clearCardDragGhost, dragReadyId]);

  const handleCardDragEnd = useCallback(() => {
    resetCardDragState();
  }, [resetCardDragState]);

  const handleCardDragOver = useCallback((targetId: string, event: React.DragEvent<HTMLElement>) => {
    if (!draggingCardId || draggingCardId === targetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator((prev) => prev?.targetId === targetId && prev?.position === position ? prev : { targetId, position });
  }, [draggingCardId]);

  const handleCardDrop = useCallback((targetId: string, event: React.DragEvent<HTMLElement>) => {
    if (!draggingCardId) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = dropIndicator?.targetId === targetId
      ? dropIndicator.position
      : (event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    const nextOrder = reorderProbeCard(cardOrder, draggingCardId, targetId, position);
    if (nextOrder.join('|') !== cardOrder.join('|')) {
      setCardOrder(nextOrder);
      persistProbeCardOrder(nextOrder);
    }
    resetCardDragState();
  }, [cardOrder, draggingCardId, dropIndicator, resetCardDragState]);

  const getSectionDragHandleProps = useCallback((cardId: string): DragHandleProps => ({
    draggable: dragReadyId === cardId,
    dragReady: dragReadyId === cardId,
    dragging: draggingCardId === cardId,
    onPointerDown: (event) => handleCardHandlePointerDown(cardId, event),
    onPointerUp: () => handleCardHandlePointerUp(cardId),
    onPointerCancel: () => handleCardHandlePointerUp(cardId),
    onDragStart: (event) => handleCardDragStart(cardId, event),
    onDragEnd: handleCardDragEnd,
  }), [dragReadyId, draggingCardId, handleCardDragEnd, handleCardDragStart, handleCardHandlePointerDown, handleCardHandlePointerUp]);

  // 切换服务器时立即清空旧数据和静态缓存
  useEffect(() => {
    const nextHist = snapshot?.hist || createEmptyHist();
    setInfo(snapshot?.info || null);
    staticInfoRef.current = null;
    histRef.current = nextHist;
    setHist(nextHist);
    setCpuExpanded(false);
    setDiskExpanded(false);
    setProbeError(false);
    setProbeErrorDetail('');
    probeErrorCountRef.current = 0;
  }, [sessionId]);

  // 启用监控时获取一次静态信息（OS/时区/主机名/CPU 型号）
  // ponytail: 已缓存则跳过，避免重复 IPC
  useEffect(() => {
    if (!enabled || !active || !sessionId) return;
    if (staticInfoRef.current) return;
    let mounted = true;
    (async () => {
      try {
        const data = await AppGo.GetServerStaticInfo(sessionId);
        if (!mounted || !activeRef.current || activeSessionIdRef.current !== sessionId) return;
        staticInfoRef.current = {
          os: data.os || 'Linux',
          timezone: data.timezone || 'UTC',
          cpuModel: data.cpu?.model || '',
          ip: data.ip || '',
        };
      } catch (_) {
        // ponytail: 失败时不写缓存，否则守卫 staticInfoRef 会让这台服务器永久停留在兜底值。
        // fetchInfo 内已有同样的兜底，显示效果一致，但下次面板切回来会重试。
      }
    })();
    return () => { mounted = false; };
  }, [enabled, active, sessionId]);

  const handleShowAllProcesses = useCallback(() => {
    if (!sessionId || !onShowAllProcesses) return;
    onShowAllProcesses();
  }, [sessionId, onShowAllProcesses]);

  const handleShowNetworkDetails = useCallback(() => {
    if (!sessionId || !onShowNetworkDetails) return;
    onShowNetworkDetails();
  }, [sessionId, onShowNetworkDetails]);

  const fetchInfo = useCallback(async () => {
    if (!sessionId || !enabled || !activeRef.current) return;
    try {
      // ponytail: 后端 SystemInfo 在 SFTP/命令慢时可能长期 pending(deployProbeScript 已有 15s 兜底,
      // executeCmd 30s 兜底,合计约 45s)。race 超时保证 await 必返回,递归 setTimeout 链不断裂,
      // 面板不会停在最后一次数据。超时后后端 goroutine 仍独立跑完,不阻塞下次调用。
      const data = await Promise.race([
        AppGo.SystemInfo(sessionId),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error('PROBE_FETCH_TIMEOUT')),
          PROBE_FETCH_TIMEOUT_MS,
        )),
      ]);
      if (!activeRef.current || activeSessionIdRef.current !== sessionId) return; // 切换服务器后丢弃旧响应
      const si = staticInfoRef.current || { os: 'Linux', timezone: 'UTC', cpuModel: '' };
      const uptimeData = data.uptime || {};
      let uptimeStr = t('0 小时');
      if (uptimeData.days > 0) {
        uptimeStr = `${uptimeData.days}${t('天')} ${uptimeData.hours}${t('小时')}`;
      } else if (uptimeData.hours > 0) {
        uptimeStr = `${uptimeData.hours}${t('小时')} ${uptimeData.mins}${t('分')}`;
      } else {
        uptimeStr = `${uptimeData.mins || 0}${t('分钟')}`;
      }
      const ni: ProbeInfo = {
        ...si,
        uptime: uptimeStr,
        load1: data.load?.load1 || 0,
        load5: data.load?.load5 || 0,
        load15: data.load?.load15 || 0,
        cpuUsage: data.cpu?.usage || 0,
        cpuCores: data.cpu?.cores || [],
        memUsed: data.memory?.used || 0,
        memTotal: data.memory?.total || 0,
        memCache: data.memory?.cache || 0,
        memFree: data.memory?.free || 0,
        swapTotal: data.memory?.swapTotal || 0,
        swapUsed: data.memory?.swapUsed || 0,
        diskDevice: data.disk?.device || 'disk',
        diskTotal: data.disk?.total || 0,
        diskUsed: data.disk?.used || 0,
        diskPercent: data.disk?.usage || 0,
        diskReadSpeed: data.disk?.readSpeed || 0,
        diskWriteSpeed: data.disk?.writeSpeed || 0,
        diskPartitions: data.disk?.partitions || [],
        netUp: data.network?.uploadSpeed || 0,
        netDown: data.network?.downloadSpeed || 0,
        netUpTotal: data.network?.uploadTotal || 0,
        netDownTotal: data.network?.downloadTotal || 0,
        networkInterfaces: data.network?.interfaces || [],
        processes: data.processes || [],
      };
      // 用 histRef 算 nextHist，避免在 setState updater 里调父组件 onSnapshot（渲染期 setState 警告）
      const prevHist = histRef.current || createEmptyHist();
      const nextHist: ProbeHist = {
        cpu: [...prevHist.cpu, ni.cpuUsage || 0].slice(-HISTORY_SIZE),
        up: [...prevHist.up, ni.netUp || 0].slice(-HISTORY_SIZE),
        down: [...prevHist.down, ni.netDown || 0].slice(-HISTORY_SIZE),
      };
      histRef.current = nextHist;
      setInfo(ni);
      setHist(nextHist);
      onSnapshotRef.current?.({ info: ni, hist: nextHist });
      probeErrorCountRef.current = 0;
      setProbeError(false);
      setProbeErrorDetail('');
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err || '');
      const errorMessage = translateProbeError(rawMessage);
      probeErrorCountRef.current += 1;
      if (probeErrorCountRef.current >= 3) {
        setProbeError(true);
        setProbeErrorDetail(errorMessage);
      }
    }
  }, [sessionId, enabled, t]);

  const probeTimerRef = useRef<number | null>(null);

  // ── 读取探针刷新间隔（localStorage，默认 3s）────────────
  const getProbeInterval = () => {
    const v = parseInt(localStorage.getItem('probeInterval') || '3', 10);
    return v >= 1 ? v : 5;
  };

  useEffect(() => {
    if (!enabled || !active) return;
    // ponytail: 递归 setTimeout 替代 setInterval，确保上一次 fetchInfo 完成后才排下一次，
    // 避免慢网络下多个 SystemInfo 并发在飞（请求堆叠 + 加剧竞态）。
    // stopped 用闭包标志而非 ref：定时器触发后 ref 仍存着已烧掉的 ID，
    // 改间隔恰好落在 await 窗口时，旧链会误判自己仍然有效而重复排下一次（两条链并行、频率翻倍）。
    let stopped = false;
    const scheduleNext = () => {
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      probeTimerRef.current = setTimeout(async () => {
        await fetchInfo();
        if (!stopped && activeRef.current) scheduleNext();
      }, getProbeInterval() * 1000);
    };
    fetchInfo();
    scheduleNext();
    const onIntervalChange = () => {
      if (!stopped && activeRef.current) scheduleNext();
    };
    window.addEventListener('probeIntervalChanged', onIntervalChange);
    return () => {
      stopped = true;
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      window.removeEventListener('probeIntervalChanged', onIntervalChange);
    };
  }, [fetchInfo, enabled, active]);

  // ponytail: onEnable 是父组件的同步 setState，不会 reject，
  // 探针注入失败由 fetchInfo 连续 3 次出错的路径报错，这里无需 try/catch。
  const handleConfirm = () => {
    setShowConfirm(false);
    setProbeError(false);
    setProbeErrorDetail('');
    probeErrorCountRef.current = 0;
    onEnable();
  };

  // ── Not enabled: show welcome panel ──────────────────────────────────
  if (!enabled) {
    return (
      <div className="probe-welcome">
        <div className="probe-welcome-main">
          <div className="probe-welcome-icon"><BarChart3 size={26} /></div>
          <div className="probe-welcome-copy">
            <div>{t('系统监控')}</div>
            <p>{t('实时查看服务器 CPU、内存、网络和磁盘使用情况')}</p>
          </div>
          <div className="probe-welcome-list">
            {[[<Cpu size={14} />, t('CPU 每核心实时占用')], [<MemoryStick size={14} />, t('内存甜甜圈图分析')], [<Globe size={14} />, t('网络速率折线图')], [<HardDrive size={14} />, t('磁盘分区挂载表')], [<ClipboardList size={14} />, t('进程热点排行')]].map(([icon, text]) => (
              <div key={String(text)}><span>{icon}</span><span>{text}</span></div>
            ))}
          </div>
          <button onClick={() => setShowConfirm(true)} className="btn btn-primary">{t('开启监控')}</button>
        </div>
        {showConfirm && (
          <div className="probe-confirm-overlay">
            <div className="probe-confirm-card">
              <div className="probe-confirm-title">
                <span><Search size={16} /></span>
                <div>
                  <div>{t('注入监控脚本')}</div>
                  <small>LuminSSH Probe v2</small>
                </div>
              </div>
              <div className="probe-confirm-desc">
                {t('将在服务器写入')} <code>~/.lumin/probe.sh</code>{t('，轻量监控脚本。')}
              </div>
              <div className="probe-confirm-list">
                {[
                  t('纯 Shell，读取 /proc 文件系统'),
                  t('无需安装任何软件或依赖'),
                  t('不修改系统配置，不常驻后台'),
                  t('断开连接后自动停止采集'),
                ].map((text) => <div key={text}><Check size={12} /> {text}</div>)}
              </div>
              <div className="probe-confirm-actions">
                <button onClick={() => setShowConfirm(false)} className="btn btn-secondary btn-sm">{t('取消')}</button>
                <button onClick={handleConfirm} className="btn btn-primary btn-sm">{t('确认开启')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Loading / Error state ─────────────────────────────────────────────
  if (!info) {
    if (probeError) {
      return (
        <div className="probe-state-panel">
          <div className="probe-error-icon">✕</div>
          <div className="probe-state-title">{t('写入失败，请重试')}</div>
          <div className="probe-state-desc">{t('监控脚本写入服务器失败，请检查连接或权限')}</div>
          {probeErrorDetail ? (
            <div style={{
              marginTop: 10,
              maxWidth: 360,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-overlay)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
            >
              {probeErrorDetail}
            </div>
          ) : null}
          <button onClick={() => { setProbeError(false); setProbeErrorDetail(''); probeErrorCountRef.current = 0; }} className="btn btn-primary btn-sm">{t('重试')}</button>
        </div>
      );
    }
    return (
      <div className="probe-loading-panel">
        <RefreshCw size={22} className="spin" />
        <div>{t('正在采集系统信息...')}</div>
      </div>
    );
  }

  const memPct = (info.memTotal || 0) > 0 ? Math.round(((info.memUsed || 0) / (info.memTotal || 1)) * 100) : 0;
  const cores = info.cpuCores && info.cpuCores.length > 0 ? info.cpuCores : [info.cpuUsage || 0];
  const cpuAvg = Math.round(cores.reduce((a, b) => a + b, 0) / cores.length);
  const displayIP = info.ip && !isInternalIP(info.ip) ? info.ip : host;
  const diskPartitions = info.diskPartitions && info.diskPartitions.length > 0
    ? info.diskPartitions
    : [{ mount: '/', size: `${(info.diskTotal || 0).toFixed(0)}G`, avail: `${((info.diskTotal || 0) - (info.diskUsed || 0)).toFixed(1)}G`, usedPct: Math.round(info.diskPercent || 0) }];
  const visibleDiskPartitions = diskPartitions.length > 4 && !diskExpanded ? diskPartitions.slice(0, 4) : diskPartitions;
  const orderedSections: Record<string, ReactNode> = {
    overview: <HealthOverview t={t} cpuAvg={cpuAvg} memPct={memPct} diskPct={info.diskPercent} info={info} coreCount={cores.length} dragHandleProps={getSectionDragHandleProps('overview')} />,
    cpu: <CpuSection t={t} info={info} hist={hist} cores={cores} cpuAvg={cpuAvg} cpuExpanded={cpuExpanded} setCpuExpanded={setCpuExpanded} dragHandleProps={getSectionDragHandleProps('cpu')} />,
    memory: <MemorySection t={t} info={info} memPct={memPct} dragHandleProps={getSectionDragHandleProps('memory')} />,
    network: <NetworkSection t={t} info={info} hist={hist} onShowNetworkDetails={handleShowNetworkDetails} dragHandleProps={getSectionDragHandleProps('network')} />,
    disk: <DiskSection t={t} info={info} diskPartitions={diskPartitions} visibleDiskPartitions={visibleDiskPartitions} diskExpanded={diskExpanded} setDiskExpanded={setDiskExpanded} dragHandleProps={getSectionDragHandleProps('disk')} />,
    process: <ProcessSection t={t} info={info} onShowAllProcesses={handleShowAllProcesses} dragHandleProps={getSectionDragHandleProps('process')} />,
    portforward: <PortForwardSection t={t} sessionId={sessionId} active={active} onOpenPortForward={onOpenPortForward} dragHandleProps={getSectionDragHandleProps('portforward')} />,
  };

  const handlePanelDragOver = (event: React.DragEvent) => {
    if (!draggingCardId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handlePanelDrop = (event: React.DragEvent) => {
    if (!draggingCardId || !dropIndicator) {
      resetCardDragState();
      return;
    }
    event.preventDefault();
    const nextOrder = reorderProbeCard(cardOrder, draggingCardId, dropIndicator.targetId, dropIndicator.position);
    if (nextOrder.join('|') !== cardOrder.join('|')) {
      setCardOrder(nextOrder);
      persistProbeCardOrder(nextOrder);
    }
    resetCardDragState();
  };

  return (
    <div
      className={`probe-panel${draggingCardId ? ' probe-panel-card-dragging' : ''}`}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      <ProbeHeader t={t} info={info} displayIP={displayIP} hideIP={hideIP} addToast={addToast} />
      {cardOrder.map((cardId) => {
        const cardNode = orderedSections[cardId];
        if (!cardNode) return null;
        const dropClass = dropIndicator?.targetId === cardId ? ` probe-card-drop-${dropIndicator.position}` : '';
        return (
          <div
            key={cardId}
            className={`probe-card-sortable${draggingCardId === cardId ? ' probe-card-dragging' : ''}${dropClass}`}
            onDragOver={(event) => handleCardDragOver(cardId, event)}
            onDrop={(event) => handleCardDrop(cardId, event)}
          >
            {cardNode}
          </div>
        );
      })}
    </div>
  );
}
