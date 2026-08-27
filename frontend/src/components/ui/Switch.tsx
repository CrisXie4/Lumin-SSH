import { cn } from '../../utils/cn.ts';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  size?: SwitchSize;
  /** 嵌套在外层 button 内时用：渲染为非交互 span，避免 button 嵌套 button */
  indicator?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  indicator = false,
  className,
  ...rest
}: SwitchProps) {
  const isSm = size === 'sm';

  const shell = cn(
    'rounded-full border border-line flex items-center justify-start shrink-0 select-none overflow-hidden transition-colors duration-[120ms]',
    isSm
      ? 'w-[30px] min-w-[30px] h-[18px] min-h-[18px] p-[2px]'
      : 'w-[38px] min-w-[38px] h-[22px] min-h-[22px] p-[2px]',
    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
    checked ? 'bg-accent' : (indicator ? 'bg-line' : 'bg-hover'),
    className,
  );

  const knobClasses = cn(
    'rounded-full bg-white shadow-sm shrink-0 transition-transform duration-[120ms]',
    isSm
      ? 'w-[12px] min-w-[12px] h-[12px] min-h-[12px]'
      : 'w-[16px] min-w-[16px] h-[16px] min-h-[16px]',
  );

  const knobTransform = checked
    ? (isSm ? 'translateX(12px)' : 'translateX(16px)')
    : undefined;

  const knob = (
    <span
      className={knobClasses}
      style={{ transform: knobTransform }}
    />
  );

  if (indicator) {
    return (
      <span role="switch" aria-checked={checked} className={shell} {...rest}>
        {knob}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled || typeof onChange !== 'function'}
      className={shell}
      {...rest}
    >
      {knob}
    </button>
  );
}
