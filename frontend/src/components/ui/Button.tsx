import { forwardRef } from 'react';
import { cn } from '../../utils/cn.ts';

export type ButtonVariant = 'secondary' | 'primary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'md' | 'sm' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-1 rounded-sm text-sm font-medium leading-none whitespace-nowrap border select-none cursor-pointer outline-none transition-colors duration-[80ms] focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-45 disabled:pointer-events-none';

const VARIANTS: Record<ButtonVariant, string> = {
  secondary:
    'bg-raised text-secondary border-line hover:bg-hover hover:text-primary hover:border-focus active:bg-active',
  primary:
    'bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover active:bg-accent',
  ghost: 'bg-transparent text-secondary border-transparent hover:bg-hover hover:text-primary',
  danger:
    'bg-transparent text-danger border-[rgba(var(--danger-rgb),0.35)] hover:bg-danger-dim hover:text-danger hover:border-danger',
  success:
    'bg-success text-white border-success hover:bg-[color-mix(in_srgb,var(--success)_88%,#fff)] hover:border-[color-mix(in_srgb,var(--success)_88%,#fff)] active:bg-success',
};

const ACTIVE_VARIANTS: Partial<Record<ButtonVariant, string>> = {
  secondary: 'aria-pressed:bg-active aria-pressed:text-primary aria-pressed:border-accent',
  ghost: 'aria-pressed:bg-accent-dim aria-pressed:text-accent aria-pressed:border-accent-border',
};

function sizeClasses(size: ButtonSize, variant: ButtonVariant): string {
  if (size === 'icon') return 'w-[26px] min-w-[26px] h-[26px] p-0';
  if (size === 'sm') return 'min-h-6 py-[3px] px-[7px] text-xs';
  return `min-h-7 py-[5px] ${variant === 'ghost' ? 'px-2' : 'px-2.5'}`;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block = false, className, type = 'button', ...rest },
  ref,
) {
  const cls = cn(
    BASE,
    VARIANTS[variant],
    sizeClasses(size, variant),
    block && 'w-full font-semibold',
    ACTIVE_VARIANTS[variant],
    className,
  );
  return <button ref={ref} type={type} className={cls} {...rest} />;
});
