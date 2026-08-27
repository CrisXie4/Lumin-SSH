import * as AppGo from '../../wailsjs/go/wailsapp/App.js';
import type { Dispatch, SetStateAction } from 'react';
import { Z } from '../constants/zIndex.ts';
import { Button } from './ui';

/** 同步失败状态（源头在 useSessionConnections 中为 unknown，此处先本地定义，待后续收窄） */
export interface SyncFailureState {
  category?: string;
  error?: unknown;
}

interface SyncFailureToastProps {
  syncFailed: SyncFailureState | null;
  setSyncFailed: Dispatch<SetStateAction<SyncFailureState | null>>;
  setSettingsInitialTab: (tab: string) => void;
  setShowSettings: (show: boolean) => void;
  addToast: (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

export default function SyncFailureToast({ syncFailed, setSyncFailed, setSettingsInitialTab, setShowSettings, addToast, t }: SyncFailureToastProps) {
  if (!syncFailed) return null;
  const errText = String(syncFailed.error || '');
  const networkOrDnsError = /no such host|lookup |dial tcp|i\/o timeout|timeout|connection refused|network is unreachable|temporary failure|Name or service not known|getaddrinfo|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|certificate|x509|tls|unauthorized|401|403|forbidden|authentication|invalid credentials/i.test(errText);
  const looksLikeMissingRemoteDir = /\b404\b/.test(errText)
    || /No such file|no such file|not found|目录不存在|does not exist|is not a directory/i.test(errText)
    || (/读取远程目录失败|PROPFIND/i.test(errText) && /\b404\b|No such file|not found|目录不存在|does not exist/i.test(errText));
  const canRecreateRemoteDir = syncFailed.category !== 'trust' && !networkOrDnsError && looksLikeMissingRemoteDir;
  const runRetry = async (recreateDir: boolean) => {
    if (syncFailed.category === 'trust') {
      setSyncFailed(null);
      setSettingsInitialTab('sync');
      setShowSettings(true);
      return;
    }
    const failedSync = syncFailed;
    setSyncFailed(null);
    try {
      const error = recreateDir ? await AppGo.EnsureRemoteDirAndRetrySync() : await AppGo.RetrySync();
      if (error) setSyncFailed({ ...failedSync, error });
      else addToast(recreateDir ? t('远程目录已重建并同步成功') : t('同步成功'), 'success', 3000);
    } catch (error) {
      setSyncFailed({ ...failedSync, error: String((error as { message?: unknown })?.message || error) });
    }
  };
  return (
    <div
      className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw_-_32px)] bg-raised border border-line rounded-[var(--radius-md)] shadow-lg py-4 px-5 animate-[slideUp_0.18s_ease]"
      style={{ zIndex: Z.TOAST }}
    >
      <div className="flex items-start gap-[14px]">
        <div className="text-[28px] leading-none text-warning shrink-0" aria-hidden>⚠</div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-primary mb-1">{t('云端同步失败')}</div>
          <div className="text-base text-secondary leading-normal mb-[6px]">{syncFailed.category === 'trust' ? t('服务器身份信息已变化，请前往“设置 → 同步与云”核对后恢复同步。') : t('数据未能上传到云端，本地数据不受影响。')}</div>
          <div className="text-sm text-danger leading-normal break-all bg-[rgba(var(--danger-rgb),0.10)] border border-[rgba(var(--danger-rgb),0.22)] rounded-[var(--radius-sm)] py-[6px] px-2.5 mb-[14px]">{String(syncFailed.error ?? '')}</div>
          <div className="flex justify-end flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSyncFailed(null)}>{t('忽略')}</Button>
            {canRecreateRemoteDir && <Button variant="secondary" title={t('在云端重建同步目录后再次同步')} onClick={() => runRetry(true)}>{t('重新创建并重试')}</Button>}
            <Button variant="primary" onClick={() => runRetry(false)}>{syncFailed.category === 'trust' ? t('前往同步与云') : t('重试')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
