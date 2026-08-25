import { Check, Copy, Pin, SquarePen } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n.ts';
import Tiptop from '../Tiptop.tsx';

interface IconButtonProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

function IconButton({ title, active = false, disabled = false, onClick, children }: IconButtonProps) {
  return (
    <Tiptop text={title}>
      <button
        type="button"
        aria-label={title}
        aria-disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          onClick?.();
        }}
        className={`w-7 h-7 inline-flex items-center justify-center rounded-none border border-transparent shrink-0 transition-colors duration-100 ${
          active ? 'bg-[rgba(var(--accent-rgb),0.10)] text-accent' : 'bg-transparent text-muted'
        } ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {children}
      </button>
    </Tiptop>
  );
}

interface AIProviderListRowProps {
  item: {
    name: string;
    model?: string;
    description?: string;
    pinned?: boolean;
  };
  active?: boolean;
  builtin?: boolean;
  onSelect?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onTogglePin?: () => void;
}

export default function AIProviderListRow({ item, active = false, builtin = false, onSelect, onCopy, onEdit, onTogglePin }: AIProviderListRowProps) {
  const { t } = useTranslation()
  const secondaryLabel = item.model || item.description || 'Compatible'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.()
        }
      }}
      className={`w-full min-h-[46px] flex items-center justify-between gap-3 py-2 px-2.5 border-b border-line-subtle text-left box-border overflow-hidden cursor-pointer transition-colors duration-100 ${
        active ? 'bg-[rgba(var(--accent-rgb),0.10)]' : 'bg-transparent'
      }`}
    >
      <div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
        <span className={`shrink-0 text-base text-primary whitespace-nowrap ${active ? 'font-extrabold' : 'font-bold'}`}>
          {item.name}
        </span>
        {secondaryLabel ? (
          <span className="min-w-0 flex-1 text-xs text-tertiary whitespace-nowrap overflow-hidden text-ellipsis">
            {secondaryLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {active ? <Check size={13} color="var(--accent)" /> : <div className="w-[13px]" />}
        {!builtin ? (
          <IconButton title={item.pinned ? t('取消置顶') : t('置顶')} active={item.pinned} onClick={onTogglePin}>
            <Pin size={13} />
          </IconButton>
        ) : null}
        <IconButton title={t('复制供应商')} disabled={builtin} onClick={onCopy}>
          <Copy size={13} />
        </IconButton>
        <IconButton title={t('编辑供应商')} onClick={onEdit}>
          <SquarePen size={13} />
        </IconButton>
      </div>
    </div>
  );
}
