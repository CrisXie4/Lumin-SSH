import type { ReactNode } from 'react';
import Tiptop from '../Tiptop.tsx';

interface IconActionButtonProps {
  title: string;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export default function IconActionButton({ title, active = false, onClick, children }: IconActionButtonProps) {
  return (
    <Tiptop text={title} placement="bottom">
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border cursor-pointer transition-colors duration-100 ${
          active
            ? 'text-accent bg-accent-dim border-accent-border'
            : 'text-secondary bg-transparent border-transparent'
        }`}
      >
        {children}
      </button>
    </Tiptop>
  );
}
