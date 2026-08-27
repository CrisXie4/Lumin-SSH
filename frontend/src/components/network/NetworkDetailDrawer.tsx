import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n.ts';
import { cn } from '../../utils/cn.ts';
import Tiptop from '../Tiptop.tsx';
import { Button } from '../ui';
import useTabStripWheelScroll from '../../hooks/useTabStripWheelScroll.ts';
import { formatTransferTotal } from '../../utils/probeFormatting.ts';
import type { NetworkConnection } from './networkTypes.ts';

export interface NetworkDetailDrawerProps {
  detailConnections: Array<{ key: string; item: NetworkConnection }>;
  activeDetailKey: string | null;
  setActiveDetailKey: (key: string) => void;
  onCloseConnectionDetail: (key: string) => void;
  onCloseAllDetails: () => void;
  detailHeight: number;
  onStartDetailDrag: (event: React.MouseEvent) => void;
}

export function NetworkDetailDrawer({
  detailConnections,
  activeDetailKey,
  setActiveDetailKey,
  onCloseConnectionDetail,
  onCloseAllDetails,
  detailHeight,
  onStartDetailDrag,
}: NetworkDetailDrawerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nav, setNav] = useState({ left: false, right: false });
  // 端口明细标签条：普通滚轮直接滚动切换（与终端/进程标签条统一）
  useTabStripWheelScroll(scrollRef, detailConnections.length > 0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setNav({
      left: el.scrollLeft > 1,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 1,
    });
  }, [detailConnections.length]);
  const updateNav = () => {
    const el = scrollRef.current;
    if (!el) return;
    setNav({
      left: el.scrollLeft > 1,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 1,
    });
  };

  if (detailConnections.length === 0) {
    return null;
  }

  const activeDetailConnection = detailConnections.find((item) => item.key === activeDetailKey) || null;
  const formatLocation = (value: string | undefined) => (value === 'reserved' ? t('保留地址') : (value || '-'));
  const formatOptionalTransfer = (value: number | undefined) => (value == null ? '--' : formatTransferTotal(value));

  return (
    <>
      <div className="split-resizer-h hotzone-bottom" onMouseDown={onStartDetailDrag} />
      <div style={{ height: detailHeight }} className="shrink-0 border-t border-line flex flex-col overflow-hidden bg-sunken">
        <div className="flex justify-between items-end px-2 pt-1 border-b border-line bg-sunken gap-1">
          <div className="flex items-end min-w-0 flex-1">
            {nav.left && (
              <button type="button" className="terminal-sub-tab-nav mb-0.5" aria-label={t('向左滚动标签')} onClick={() => scrollRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}>
                <ChevronLeft size={14} />
              </button>
            )}
            <div ref={scrollRef} className="flex gap-0 items-end min-w-0 flex-1 overflow-x-auto tab-row-scroll-x px-2" onScroll={updateNav}>
              {detailConnections.map(({ key, item }) => {
              const isActive = activeDetailKey === key;
              return (
                <div
                  key={key}
                  onClick={() => setActiveDetailKey(key)}
                  className={cn('drawer-detail-tab font-mono no-drag', isActive && 'active')}
                >
                  <span>{item.listenIP || '*'}:{item.port || '-'}</span>
                  <span className="text-tertiary max-w-[100px] truncate">{item.name || '-'}</span>
                  <Tiptop text={t('关闭')} placement="bottom">
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        onCloseConnectionDetail(key);
                      }}
                      aria-label={t('关闭')}
                      className="drawer-detail-tab-close"
                    >
                      ×
                    </span>
                  </Tiptop>
                </div>
              );
            })}
            </div>
            {nav.right && (
              <button type="button" className="terminal-sub-tab-nav mb-0.5" aria-label={t('向右滚动标签')} onClick={() => scrollRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
          <Tiptop text={t('关闭全部')} placement="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCloseAllDetails}
              className="p-0.5 text-tertiary shrink-0 mb-0.5"
              aria-label={t('关闭全部')}
            >
              <X size={14} />
            </Button>
          </Tiptop>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <div className="text-tertiary text-sm mb-2">
            {activeDetailConnection?.item?.listenIP || '*'}:{activeDetailConnection?.item?.port || '-'} {t('连接明细')}
          </div>
          <div className="min-w-[640px]">
            <div style={{ gridTemplateColumns: 'minmax(180px,1.4fr) minmax(130px,1fr) 80px 90px 90px' }} className="grid gap-2.5 px-2.5 py-[7px] text-tertiary text-sm font-bold rounded-t-md border border-line-subtle border-b-0">
              <span>{t('位置')}</span>
              <span>IP</span>
              <span>{t('端口')}</span>
              <span>{t('上传')}</span>
              <span>{t('下载')}</span>
            </div>
            {Array.isArray(activeDetailConnection?.item?.peers) && activeDetailConnection.item.peers.length > 0 ? (
              activeDetailConnection.item.peers.map((peer, peerIndex) => (
                <div
                  key={`${activeDetailConnection.key}-peer-${peerIndex}`}
                  style={{ gridTemplateColumns: 'minmax(180px,1.4fr) minmax(130px,1fr) 80px 90px 90px' }}
                  className="grid gap-2.5 px-2.5 py-[7px] text-primary text-[12.5px] border border-line-subtle border-t-0"
                >
                  <span className="text-tertiary truncate" title={formatLocation(peer.location)}>{formatLocation(peer.location)}</span>
                  <span className="font-mono">{peer.ip || '-'}</span>
                  <span className="font-mono text-accent">{peer.port || '-'}</span>
                  <span className="font-mono text-success">{formatOptionalTransfer(peer.upload)}</span>
                  <span className="font-mono text-accent">{formatOptionalTransfer(peer.download)}</span>
                </div>
              ))
            ) : (
              <div className="p-3 text-tertiary text-sm border border-line-subtle border-t-0">{t('暂无连接明细')}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
