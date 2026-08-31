import { memo } from 'react';
import { CircleAlert, Clock, Cpu, Gauge, HardDrive, Loader2, MemoryStick, Server, Upload, Download } from 'lucide-react';
import { useTranslation } from '../../i18n.ts';
import { Sparkline } from '../probe/ProbeVisuals.tsx';
import { clampPct } from '../probe/probeTypes.ts';
import { formatCapacity, formatRate, formatTransferTotal } from '../../utils/probeFormatting.ts';
import type { BigScreenPoint, BigScreenStatic, BigScreenTarget } from './bigScreenTypes.ts';

const bsPctColor = (pct: number, warn = 60, danger = 85) => (
  pct >= danger ? 'var(--bs-red)' : (pct >= warn ? 'var(--bs-amber)' : 'var(--bs-green)')
);

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="bs-bar">
    <div className="bs-bar-fill" style={{ width: `${clampPct(pct)}%`, background: color }} />
  </div>
);

const CoreHeatGrid = ({ cores }: { cores: number[] }) => (
  <div className="bs-core-grid">
    {cores.map((val, i) => {
      const pct = clampPct(val);
      return (
        <div
          key={i}
          className="bs-core-cell"
          title={`CPU ${i}: ${pct.toFixed(1)}%`}
          style={{ background: bsPctColor(pct, 50, 80), opacity: 0.3 + (pct / 100) * 0.7 }}
        />
      );
    })}
  </div>
);

const MemDonut = ({ used, free, total }: { used: number; free: number; total: number }) => {
  const circ = 2 * Math.PI * 24;
  const fUsed = total > 0 ? clampPct((used / total) * 100) / 100 : 0;
  const reclaimable = Math.max(total - used - free, 0);
  const fCache = total > 0 ? clampPct((reclaimable / total) * 100) / 100 : 0;
  const fCacheCapped = Math.min(fCache, Math.max(1 - fUsed, 0));
  const fFree = total > 0 ? clampPct((free / total) * 100) / 100 : 0;
  const fFreeCapped = Math.min(fFree, Math.max(1 - fUsed - fCacheCapped, 0));
  return (
    <svg viewBox="0 0 60 60" className="bs-donut" aria-hidden="true">
      <circle cx="30" cy="30" r="24" fill="none" stroke="var(--bs-line)" strokeWidth="7" />
      {fUsed > 0.004 && (
        <circle
          cx="30" cy="30" r="24" fill="none" stroke="var(--bs-red)" strokeWidth="7" strokeLinecap="butt"
          strokeDasharray={`${fUsed * circ} ${circ}`} transform="rotate(-90 30 30)"
        />
      )}
      {fCacheCapped > 0.004 && (
        <circle
          cx="30" cy="30" r="24" fill="none" stroke="var(--bs-amber)" strokeWidth="7" strokeLinecap="butt"
          strokeDasharray={`${fCacheCapped * circ} ${circ}`}
          transform={`rotate(${-90 + fUsed * 360} 30 30)`}
        />
      )}
      {fFreeCapped > 0.004 && (
        <circle
          cx="30" cy="30" r="24" fill="none" stroke="var(--bs-green)" strokeWidth="7" strokeLinecap="butt"
          strokeDasharray={`${fFreeCapped * circ} ${circ}`}
          transform={`rotate(${-90 + (fUsed + fCacheCapped) * 360} 30 30)`}
        />
      )}
    </svg>
  );
};

interface BigScreenServerCardProps {
  target: BigScreenTarget;
  point: BigScreenPoint | undefined;
  staticInfo: BigScreenStatic | undefined;
}

export const BigScreenServerCard = memo(function BigScreenServerCard({ target, point, staticInfo }: BigScreenServerCardProps) {
  const { t } = useTranslation();
  const info = point?.info || null;
  const hist = point?.hist;
  const failed = (point?.errorCount || 0) >= 2;
  const waitingForData = !point;

  const osLabel = info?.os || staticInfo?.os || '';
  const hostLabel = target.host || (target.isLocal ? t('本机') : '');
  const userLabel = target.username ? `${target.username}@` : '';
  const cores = info?.cpuCores || [];
  const memTotal = info?.memTotal || 0;
  const memUsed = info?.memUsed || 0;
  const memPct = memTotal > 0 ? clampPct((memUsed / memTotal) * 100) : 0;
  const diskTotal = info?.diskTotal || 0;
  const diskUsed = info?.diskUsed || 0;
  const diskPct = diskTotal > 0 ? clampPct((diskUsed / diskTotal) * 100) : clampPct(info?.diskPercent || 0);
  const swapTotal = info?.swapTotal || 0;
  const swapUsed = info?.swapUsed || 0;
  const swapPct = swapTotal > 0 ? clampPct((swapUsed / swapTotal) * 100) : 0;
  const updatedLabel = point?.updatedAt
    ? new Date(point.updatedAt).toLocaleTimeString(undefined, { hour12: false })
    : '';

  return (
    <article className={`bs-card${failed ? ' is-error' : ''}`}>
      <header className="bs-card-head">
        <span className={`bs-dot${failed ? ' is-bad' : point?.errorCount ? ' is-warn' : ' is-ok'}`} />
        <div className="bs-card-id">
          <div className="bs-card-name" title={target.name}>{target.name}</div>
          <div className="bs-card-host" title={`${userLabel}${hostLabel}`}>
            <Server size={11} />
            <span>{userLabel}{hostLabel}</span>
          </div>
        </div>
        <div className="bs-card-meta">
          {osLabel && <span className="bs-badge" title={staticInfo?.cpuModel || osLabel}>{osLabel}</span>}
          {info?.uptime && (
            <span className="bs-badge" title={t('运行时长')}>
              <Clock size={11} />
              <span>{info.uptime}</span>
            </span>
          )}
        </div>
      </header>

      {failed ? (
        <div className="bs-card-state">
          <CircleAlert size={22} />
          <div className="bs-state-text">{point?.error || t('获取失败，正在重试')}</div>
        </div>
      ) : !info ? (
        <div className="bs-card-state">
          {point?.loading ? <Loader2 size={22} className="bs-spin" /> : <CircleAlert size={22} />}
          <div className="bs-state-text">{point?.loading ? t('等待数据…') : (point?.error || (waitingForData ? t('等待数据…') : t('获取失败，正在重试')))}</div>
        </div>
      ) : (
        <>
          <div className="bs-metrics">
            <div className="bs-metric">
              <div className="bs-metric-label">
                <Cpu size={13} />
                <span>CPU</span>
                {cores.length > 0 && <span className="bs-metric-sub">{cores.length} {t('核')}</span>}
              </div>
              <div className="bs-metric-value" style={{ color: bsPctColor(clampPct(info.cpuUsage || 0), 50, 80) }}>
                {clampPct(info.cpuUsage || 0).toFixed(1)}<i>%</i>
              </div>
              <Sparkline data={hist?.cpu} height={34} series={hist ? [{ data: hist.cpu, color: 'var(--bs-cyan)', fill: true }] : undefined} />
            </div>

            <div className="bs-metric">
              <div className="bs-metric-label">
                <MemoryStick size={13} />
                <span>{t('内存')}</span>
              </div>
              <div className="bs-metric-with-donut">
                <MemDonut used={memUsed} free={info.memFree || 0} total={memTotal} />
                <div className="bs-metric-donut-num">
                  <div className="bs-metric-value" style={{ color: bsPctColor(memPct, 60, 85) }}>
                    {memPct.toFixed(0)}<i>%</i>
                  </div>
                  <div className="bs-metric-sub" title={`${formatCapacity(memUsed, 1)} / ${formatCapacity(memTotal, 1)}`}>
                    {formatCapacity(memUsed, 0)} / {formatCapacity(memTotal, 0)}
                  </div>
                </div>
              </div>
              {swapTotal > 0 && (
                <div className="bs-mini-row" title={`SWAP ${formatCapacity(swapUsed, 1)} / ${formatCapacity(swapTotal, 1)}`}>
                  <span className="bs-mini-label">SWAP</span>
                  <Bar pct={swapPct} color={bsPctColor(swapPct, 50, 80)} />
                  <span className="bs-mini-value">{swapPct.toFixed(0)}%</span>
                </div>
              )}
            </div>

            <div className="bs-metric">
              <div className="bs-metric-label">
                <HardDrive size={13} />
                <span>{t('磁盘')}</span>
                {info.diskDevice && <span className="bs-metric-sub" title={info.diskDevice}>{info.diskDevice}</span>}
              </div>
              <div className="bs-metric-value" style={{ color: bsPctColor(diskPct, 70, 90) }}>
                {diskPct.toFixed(0)}<i>%</i>
              </div>
              <Bar pct={diskPct} color={bsPctColor(diskPct, 70, 90)} />
              <div className="bs-rw-grid">
                <span className="bs-mini-label">{t('读/s')}</span>
                <span className="bs-mini-value">{formatRate(info.diskReadSpeed || 0)}</span>
                <span className="bs-mini-label">{t('写/s')}</span>
                <span className="bs-mini-value">{formatRate(info.diskWriteSpeed || 0)}</span>
              </div>
            </div>
          </div>

          <div className="bs-net">
            <div className="bs-net-head">
              <div className="bs-net-speed down">
                <Download size={13} />
                <b>{formatRate(info.netDown || 0)}</b>
              </div>
              <div className="bs-net-speed up">
                <Upload size={13} />
                <b>{formatRate(info.netUp || 0)}</b>
              </div>
              <div className="bs-net-total">
                {t('总计')} ↓ {formatTransferTotal(info.netDownTotal || 0)} · ↑ {formatTransferTotal(info.netUpTotal || 0)}
              </div>
            </div>
            <Sparkline
              height={40}
              series={hist ? [
                { data: hist.down, color: 'var(--bs-cyan)', fill: true },
                { data: hist.up, color: 'var(--bs-violet)', fill: true },
              ] : undefined}
            />
          </div>

          <footer className="bs-card-foot">
            <div className="bs-foot-item" title={t('系统负载')}>
              <Gauge size={12} />
              <span className="bs-load">{(info.load1 || 0).toFixed(2)}</span>
              <span className="bs-load-dim">{(info.load5 || 0).toFixed(2)}</span>
              <span className="bs-load-dim">{(info.load15 || 0).toFixed(2)}</span>
            </div>
            {cores.length > 0 && <CoreHeatGrid cores={cores} />}
            {updatedLabel && (
              <div className="bs-foot-item bs-foot-time" title={t('更新于 {time}', { time: updatedLabel })}>
                {updatedLabel}
              </div>
            )}
          </footer>
        </>
      )}
    </article>
  );
});
