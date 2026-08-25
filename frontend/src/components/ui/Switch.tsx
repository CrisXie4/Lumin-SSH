import { cn } from '../../utils/cn.ts';

export type SwitchSize = 'sm' | 'md';

const SIZE: Record<SwitchSize, { track: string; knob: string; travel: number }> = {
  md: { track: 'w-[42px] h-6 p-0.5', knob: 'w-[18px] h-[18px]', travel: 18 },
  sm: { track: 'w-[34px] h-5 p-0.5', knob: 'w-[14px] h-[14px]', travel: 14 },
};

export interface SwitchProps {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  size?: SwitchSize;
  'aria-label'?: string;
}

export function Switch({ checked, onChange, disabled = false, size = 'md', ...rest }: SwitchProps) {
  const s = SIZE[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled || typeof onChange !== 'function'}
      className={cn(
        'rounded-full border border-line flex items-center justify-start transition-colors duration-100 shrink-0',
        s.track,
        checked ? 'justify-end bg-success' : 'bg-hover',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      )}
      {...rest}
    >
      <span
        className={cn('rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-100', s.knob)}
        style={{ transform: checked ? `translateX(${s.travel}px)` : undefined }}
      />
    </button>
  );
}
