import { cn } from '../../utils/cn.ts';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  interactive?: boolean;
}

export function Card({ className, interactive, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] bg-raised border border-line p-3 shadow-[var(--shadow-card,var(--shadow-sm))]',
        interactive &&
          'transition-[var(--transition-spring,var(--transition))] hover:-translate-y-[0.5px] hover:shadow-[var(--shadow-card-hover,var(--shadow-md))] hover:border-line',
        className,
      )}
      {...rest}
    />
  );
}
