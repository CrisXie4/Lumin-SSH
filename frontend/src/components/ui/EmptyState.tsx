import type { ReactNode } from 'react';
import { cn } from '../../utils/cn.ts';

export interface EmptyStateProps {
  icon?: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, text, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-secondary',
        className,
      )}
    >
      {icon != null && (
        <div className="leading-none text-tertiary opacity-80">{icon}</div>
      )}
      {text != null && <div className="text-base">{text}</div>}
      {action}
    </div>
  );
}
