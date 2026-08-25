import { cn } from '../../utils/cn.ts';

export type SwitchSize = 'sm' | 'md';

interface SwitchDims {
  track: string;
  knob: number;
  /** 轨道宽 - 左右 border/padding - knob 直径，保证开启时滑块贴右端 */
  travel: number;
}

const BORDER = 1;

function dims(trackW: number, trackH: number, knob: number): SwitchDims {
  return {
    track: `w-[${trackW}px] h-[${trackH}px]`,
    knob,
    travel: trackW - BORDER * 2 - knob,
  };
}

const SIZE: Record<SwitchSize, SwitchDims> = {
  md: dims(42, 24, 16),
  sm: dims(34, 20, 12),
};

export interface SwitchProps {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  size?: SwitchSize;
  /** 嵌套在外层 button 内时用：渲染为非交互 span，避免 button 嵌套 button */
  indicator?: boolean;
  'aria-label'?: string;
}

export function Switch({ checked, onChange, disabled = false, size = 'md', indicator = false, ...rest }: SwitchProps) {
  const s = SIZE[size];
  const shell = cn(
    'rounded-full border border-line flex items-center justify-start overflow-hidden transition-colors duration-[80ms] shrink-0',
    s.track,
    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
  );
  const knob = (
    <span
      className="rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-[80ms]"
      style={{ width: s.knob, height: s.knob, transform: checked ? `translateX(${s.travel}px)` : undefined }}
    />
  );
  if (indicator) {
    return (
      <span role="switch" aria-checked={checked} className={cn(shell, checked ? 'bg-accent' : 'bg-line')} {...rest}>
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
      className={cn(shell, checked ? 'bg-success' : 'bg-hover')}
      {...rest}
    >
      {knob}
    </button>
  );
}
