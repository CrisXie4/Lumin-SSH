import { CheckCheck, X, type LucideIcon } from 'lucide-react';

export interface OptionButtonProps {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export function OptionButton({ active, icon: Icon, label, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[34px] flex items-center justify-between gap-2.5 px-2.5 rounded-[var(--radius-sm)] border text-xs transition-colors duration-[80ms] cursor-pointer ${
        active
          ? 'border-accent-border bg-accent-dim text-primary font-bold'
          : 'border-line bg-canvas text-secondary font-medium hover:bg-hover hover:text-primary'
      }`}>
      <span className="inline-flex items-center gap-2 min-w-0">
        <Icon size={13} />
        <span>{label}</span>
      </span>
      {active ? <CheckCheck size={13} color="var(--accent)" /> : null}
    </button>
  );
}

export interface CommandChipProps {
  text: string;
  onRemove: () => void;
}

export function CommandChip({ text, onRemove }: CommandChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="h-[26px] inline-flex items-center gap-1.5 px-2 rounded-[var(--radius-sm)] border border-line bg-canvas text-primary text-xs font-medium hover:bg-hover hover:border-line-subtle transition-colors duration-[80ms] cursor-pointer">
      <span>{text}</span>
      <X size={12} />
    </button>
  );
}
