import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import Tiptop from './Tiptop.tsx';
import { t } from '../i18n.ts';
import type { ToastAction, ToastItem } from '../hooks/useToasts.ts';

const ICON_MAP: Record<string, ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
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
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-shell${t.closing ? ' toast-shell-closing' : ''}`}>
          <div className={`toast toast-${t.type}${t.closing ? ' toast-closing' : ''}`}>
            <div className="toast-content">
              <span className="toast-icon">{ICON_MAP[t.type] || <Info size={16} />}</span>
              <span className="toast-message">{t.message}</span>
            </div>
            {Array.isArray(t.actions) && t.actions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {t.actions.map((action, index) => (
                  <button
                    key={`${t.id}-${action.label}-${index}`}
                    type="button"
                    className={`btn btn-sm ${index === t.actions.length - 1 ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onAction?.(t.id, action)}
                  >
                    {action.label as ReactNode}
                  </button>
                ))}
              </div>
            )}
            <Tiptop text={resolvedCloseLabel} placement="bottom">
              <button type="button" className="toast-close" onClick={() => onClose?.(t.id)} aria-label={resolvedCloseLabel}>
                <X size={14} />
              </button>
            </Tiptop>
          </div>
        </div>
      ))}
    </div>
  );
}
