export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-raised border border-line rounded-md p-3 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
