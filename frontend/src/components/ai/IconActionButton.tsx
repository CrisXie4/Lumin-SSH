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
        style={{
          width: 30,
          height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          color: active ? 'var(--accent)' : 'var(--text-secondary)',
          background: active ? 'var(--accent-dim)' : 'transparent',
          border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
          transition: 'var(--transition)',
        }}
      >
        {children}
      </button>
    </Tiptop>
  );
}
