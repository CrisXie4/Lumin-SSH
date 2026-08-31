import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Z } from '../../constants/zIndex.ts';
import { useOverlayScrollLock } from '../../hooks/useOverlayScrollLock.ts';

export interface MenuEntry {
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuHeader {
  type: 'header';
  label: ReactNode;
}

export type MenuItem = MenuEntry | MenuHeader | 'separator';

const isHeader = (item: MenuItem): item is MenuHeader =>
  item !== 'separator' && (item as MenuHeader).type === 'header';

const isEntry = (item: MenuItem): item is MenuEntry => item !== 'separator' && !isHeader(item);

function itemClasses(entry: MenuEntry): string {
  const base =
    'flex items-center gap-2 w-full h-7 px-3 rounded-sm text-sm text-left whitespace-nowrap cursor-pointer outline-none border-none bg-transparent transition-colors duration-[80ms]';
  if (entry.disabled) return `${base} opacity-40 pointer-events-none text-secondary`;
  if (entry.danger) return `${base} text-danger hover:bg-danger-dim`;
  return `${base} text-secondary hover:bg-hover hover:text-primary`;
}

export function MenuList({
  items,
  onClose,
  className = '',
}: {
  items: MenuItem[];
  onClose: () => void;
  className?: string;
}) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const focusEnabled = (start: number, step: 1 | -1) => {
    const total = items.length;
    for (let n = 1; n <= total; n += 1) {
      const idx = (start + step * n + total * n) % total;
      if (isEntry(items[idx]) && !items[idx].disabled) {
        buttonsRef.current[idx]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const current = buttonsRef.current.findIndex((el) => el === document.activeElement);
      const start = current === -1 ? (e.key === 'ArrowUp' ? 0 : -1) : current;
      focusEnabled(start, e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  useEffect(() => {
    const firstEnabled = items.findIndex((item) => isEntry(item) && !item.disabled);
    if (firstEnabled >= 0) buttonsRef.current[firstEnabled]?.focus({ preventScroll: true });
  }, [items]);

  return (
    <div role="menu" onKeyDown={onKeyDown} className={className}>
      {items.map((item, i) => {
        if (item === 'separator') {
          return <div key={`sep-${i}`} className="h-px my-1 mx-2 bg-line-subtle" />;
        }
        if (isHeader(item)) {
          return (
            <div
              key={`header-${i}`}
              className="px-3 pt-1 pb-1.5 mb-1 text-xs text-muted border-b border-line"
            >
              {item.label}
            </div>
          );
        }
        return (
          <button
            key={i}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect?.();
              onClose();
            }}
            className={itemClasses(item)}
          >
            {item.icon != null && (
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 [&>svg]:w-full [&>svg]:h-full">
                {item.icon}
              </span>
            )}
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span className="ml-auto pl-4 text-xs text-muted">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MenuPanel({
  children,
  minWidth = 160,
  className = '',
  style,
  onContextMenu,
  ...rest
}: {
  children: ReactNode;
  minWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  [key: string]: unknown;
}) {
  return (
    <div
      className={`bg-overlay border border-line rounded-md shadow-md py-1 overflow-y-auto ${className}`}
      style={{ minWidth, ...style }}
      onContextMenu={onContextMenu}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </div>
  );
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  zIndex?: number;
  minWidth?: number;
}

export function ContextMenu({ x, y, items, onClose, zIndex = Z.MENU, minWidth }: ContextMenuProps) {
  useOverlayScrollLock(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (x + rect.width > window.innerWidth - margin) left = window.innerWidth - rect.width - margin;
    if (y + rect.height > window.innerHeight - margin)
      top = window.innerHeight - rect.height - margin;
    setPos({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const content = (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndex - 1 }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <MenuPanel
        minWidth={minWidth}
        data-context-menu="true"
        className="fixed animate-[fadeIn_0.08s_ease]"
        style={{ zIndex, left: pos.left, top: pos.top }}
        onContextMenu={(e) => {
          // 菜单面板内部右键：吞掉事件，避免冒泡到外层容器再弹出别的菜单
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div ref={panelRef}>
          <MenuList items={items} onClose={onClose} />
        </div>
      </MenuPanel>
    </>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
