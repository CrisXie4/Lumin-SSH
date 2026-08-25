import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import Tiptop from './Tiptop.tsx';
import { Button } from './ui';
import { t } from '../i18n.ts';
import { cn } from '../utils/cn.ts';
import { Z } from '../constants/zIndex.ts';
import type { ToastAction, ToastItem } from '../hooks/useToasts.ts';

const ICON_MAP: Record<string, ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
};

const TOAST_ACCENT: Record<string, string> = {
  success: 'border-success',
  error: 'border-danger',
  warning: 'border-warning',
  info: 'border-accent',
};

const ICON_ACCENT: Record<string, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-accent',
};

interface ToastProps {
  toasts: ToastItem[];
  onClose?: (id: number) => void;
  onAction?: (id: number, action: ToastAction) => void;
  closeLabel?: string;
}

export default function Toast({ toasts, onClose, onAction, closeLabel }: ToastProps) {
  const resolvedCloseLabel = closeLabel ?? t('关闭');
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed top-[calc(var(--topbar-h)+var(--space-3))] right-5 flex flex-col pointer-events-none"
      style={{ zIndex: Z.TOAST }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'overflow-visible max-h-[220px] mb-2 last:mb-0 origin-top-right',
            '[transition:max-height_1.08s_cubic-bezier(0.18,1,0.22,1),margin-bottom_0.88s_cubic-bezier(0.18,1,0.22,1),opacity_0.6s_ease,transform_1s_cubic-bezier(0.18,1,0.22,1)]',
            t.closing && 'max-h-0 mb-0 opacity-0 [transform:translate3d(42px,-18px,0)_scale(0.78)]',
          )}
        >
          <div
            className={cn(
              'relative flex items-start gap-2 py-3 px-4 rounded-lg text-base shadow-md border border-l-4 bg-overlay text-primary min-w-60 max-w-[360px] pointer-events-auto origin-top-right will-change-[transform,opacity,filter,clip-path]',
              'animate-[slideUp_0.2s_ease]',
              TOAST_ACCENT[t.type] ?? TOAST_ACCENT.info,
              t.closing && 'overflow-hidden animate-[toastOutro_1.08s_cubic-bezier(0.12,0.86,0.16,1)_forwards]',
              t.closing && [
                'before:content-[\'\'] before:absolute before:inset-[-1px] before:rounded-[inherit] before:pointer-events-none before:opacity-90',
                'before:bg-[linear-gradient(115deg,rgba(255,255,255,0.12),transparent_24%,transparent_72%,rgba(255,255,255,0.08)),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_52%)]',
                'before:animate-[toastFlashOutro_1.08s_ease-out_forwards]',
                'after:content-[\'\'] after:absolute after:inset-[auto_-18%_-42%_22%] after:h-[70%] after:rounded-full after:pointer-events-none after:opacity-[0.32] after:blur-[18px]',
                'after:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22),transparent_68%)]',
                'after:animate-[toastTrailOutro_1.08s_cubic-bezier(0.16,0.84,0.2,1)_forwards]',
              ].join(' '),
            )}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span
                className={cn(
                  'inline-flex items-center shrink-0 mt-px',
                  ICON_ACCENT[t.type] ?? ICON_ACCENT.info,
                  t.closing && '[transform-origin:center] animate-[toastIconOutro_1.08s_cubic-bezier(0.18,0.88,0.2,1)_forwards]',
                )}
              >
                {ICON_MAP[t.type] || <Info size={16} />}
              </span>
              <span
                className={cn(
                  'flex-1 min-w-0 [word-break:break-word]',
                  t.closing && 'animate-[toastMessageOutro_1.08s_cubic-bezier(0.18,0.88,0.2,1)_forwards]',
                )}
              >
                {t.message}
              </span>
            </div>
            {Array.isArray(t.actions) && t.actions.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {t.actions.map((action, index) => (
                  <Button
                    key={`${t.id}-${action.label}-${index}`}
                    variant={index === t.actions.length - 1 ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => onAction?.(t.id, action)}
                  >
                    {action.label as ReactNode}
                  </Button>
                ))}
              </div>
            )}
            <Tiptop text={resolvedCloseLabel} placement="bottom">
              <button
                type="button"
                onClick={() => onClose?.(t.id)}
                aria-label={resolvedCloseLabel}
                className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] p-0 rounded-full border border-transparent bg-transparent text-tertiary shrink-0 [transition:var(--transition-fast)] hover:bg-hover hover:border-line hover:text-primary"
              >
                <X size={14} />
              </button>
            </Tiptop>
          </div>
        </div>
      ))}
    </div>
  );
}
