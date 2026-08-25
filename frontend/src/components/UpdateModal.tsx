import { Z } from '../constants/zIndex';
import { RefreshCw, Rocket } from 'lucide-react';
import { Button } from './ui';

interface UpdateInfo {
  version: string;
}

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  t: (key: string, vars?: Record<string, unknown>) => string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function UpdateModal({ visible, updateInfo, downloadProgress, t, onClose, onUpdate }: UpdateModalProps) {
  if (!visible || !updateInfo) return null;

  return (
    <div
      className="fixed bottom-6 right-6 w-[340px] bg-raised border border-line rounded-lg shadow-md py-4 px-5 animate-[slideUp_0.18s_ease]"
      style={{ zIndex: Z.MODAL }}
    >
      <div className="flex items-start gap-[14px]">
        <div className="text-[28px] leading-none text-secondary"><Rocket size={28} /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold text-primary mb-1">
            {t('发现新版本')} <span className="text-success text-base bg-success-dim py-[2px] px-[6px] rounded-md">{updateInfo.version}</span>
          </div>
          <div className="text-base text-secondary leading-normal mb-4">
            {t('为了给您提供更极致的体验，建议您立即升级。')}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={downloadProgress >= 0}>
              {t('稍等')}
            </Button>
            <Button variant="success" className="relative overflow-hidden font-semibold" onClick={onUpdate} disabled={downloadProgress >= 0}>
              {downloadProgress >= 0 && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-black/20 transition-[width] duration-[200ms] ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              )}
              <span className="relative flex items-center gap-1.5" style={{ zIndex: Z.CONTENT }}>
                {downloadProgress >= 0 ? (
                  <>
                    <RefreshCw size={14} strokeWidth={2.5} className="animate-[spin_1s_linear_infinite]" />
                    {Math.round(downloadProgress)}%
                  </>
                ) : (
                  t('立即更新')
                )}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
