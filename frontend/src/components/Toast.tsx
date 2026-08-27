import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import Tiptop from './Tiptop.tsx';
import { Button } from './ui';
import { t } from '../i18n.ts';
import { cn } from '../utils/cn.ts';
import { Z } from '../constants/zIndex.ts';
import type { ToastAction, ToastItem } from '../hooks/useToasts.ts';

const ICON_MAP: Record<string, ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error: <AlertCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info: <Info size={15} />,
};

const BADGE_STYLES: Record<string, string> = {
  success: 'bg-success/12 text-success',
  error: 'bg-danger/12 text-danger',
  warning: 'bg-warning/12 text-warning',
  info: 'bg-accent/12 text-accent',
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
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'overflow-visible max-h-[220px] mb-2 last:mb-0 origin-top-right',
            '[transition:max-height_1.08s_cubic-bezier(0.18,1,0.22,1),margin-bottom_0.88s_cubic-bezier(0.18,1,0.22,1),opacity_0.6s_ease,transform_1s_cubic-bezier(0.18,1,0.22,1)]',
            item.closing && 'max-h-0 mb-0 opacity-0 [transform:translate3d(42px,-18px,0)_scale(0.78)]',
          )}
        >
          <div
            className={cn(
              'relative flex items-center gap-2.5 py-2.5 px-3.5 rounded-[var(--radius-md)] text-xs font-medium bg-overlay/95 backdrop-blur-md text-primary border border-line-subtle shadow-lg pointer-events-auto min-w-[240px] max-w-[380px] origin-top-right will-change-[transform,opacity,filter,clip-path]',
              'animate-[slideUp_0.2s_ease]',
              item.closing && 'overflow-hidden animate-[toastOutro_1.08s_cubic-bezier(0.12,0.86,0.16,1)_forwards]',
              item.closing && [
                'before:content-[\'\'] before:absolute before:inset-[-1px] before:rounded-[inherit] before:pointer-events-none before:opacity-90',
                'before:bg-[linear-gradient(115deg,rgba(255,255,255,0.12),transparent_24%,transparent_72%,rgba(255,255,255,0.08)),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_52%)]',
                'before:animate-[toastFlashOutro_1.08s_ease-out_forwards]',
                'after:content-[\'\'] after:absolute after:inset-[auto_-18%_-42%_22%] after:h-[70%] after:rounded-full after:pointer-events-none after:opacity-[0.32] after:blur-[18px]',
                'after:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22),transparent_68%)]',
                'after:animate-[toastTrailOutro_1.08s_cubic-bezier(0.16,0.84,0.2,1)_forwards]',
              ].join(' '),
            )}
          >
            <span
              className={cn(
                'w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0',
                BADGE_STYLES[item.type] ?? BADGE_STYLES.info,
                item.closing && '[transform-origin:center] animate-[toastIconOutro_1.08s_cubic-bezier(0.18,0.88,0.2,1)_forwards]',
              )}
            >
              {ICON_MAP[item.type] ?? ICON_MAP.info}
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <span
                className={cn(
                  'min-w-0 leading-relaxed [word-break:break-word] text-xs',
                  item.closing && 'animate-[toastMessageOutro_1.08s_cubic-bezier(0.18,0.88,0.2,1)_forwards]',
                )}
              >
                {item.message}
              </span>
              {Array.isArray(item.actions) && item.actions.length > 0 && (
                <div className="flex gap-1.5 mt-0.5">
                  {item.actions.map((action, index) => (
                    <Button
                      key={`${item.id}-${action.label}-${index}`}
                      variant={index === item.actions.length - 1 ? 'primary' : 'secondary'}
                      size="sm"
                      className="h-6 px-2 text-[11px] rounded-[var(--radius-sm)]"
                      onClick={() => onAction?.(item.id, action)}
                    >
                      {action.label as ReactNode}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <Tiptop text={resolvedCloseLabel} placement="bottom">
              <button
                type="button"
                onClick={() => onClose?.(item.id)}
                aria-label={resolvedCloseLabel}
                className="inline-flex items-center justify-center w-5 min-w-5 h-5 p-0 rounded-full text-muted shrink-0 transition-colors hover:bg-hover hover:text-primary"
              >
                <X size={13} />
              </button>
            </Tiptop>
          </div>
        </div>
      ))}
    </div>
  );
}
