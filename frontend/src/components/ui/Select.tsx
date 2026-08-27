import { Check, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Z } from '../../constants/zIndex.ts';
import { cn } from '../../utils/cn.ts';
import { clampMenuPosition } from '../../utils/menuPosition.ts';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  size?: 'sm' | 'md';
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  style,
  width,
  size = 'md',
  id,
  name,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: SelectProps) {
  const autoId = useId();
  const selectId = id || autoId;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; width: number }>({ x: 0, y: 0, width: 160 });

  const currentOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const displayLabel = currentOption ? currentOption.label : (placeholder || value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 120);
    const estimatedHeight = Math.min(options.length * 34 + 12, 260);

    // Prefer opening downwards; if not enough room, open upwards
    let targetY = rect.bottom + 4;
    if (targetY + estimatedHeight > window.innerHeight - 8 && rect.top - estimatedHeight - 4 > 8) {
      targetY = rect.top - estimatedHeight - 4;
    }

    const clamped = clampMenuPosition(rect.left, targetY, menuWidth, estimatedHeight);
    setMenuPos({ x: clamped.x, y: clamped.y, width: menuWidth });
  }, [options.length]);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    if (!open) {
      updateMenuPosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [disabled, open, updateMenuPosition]);

  const handleSelect = useCallback(
    (optionValue: string, optionDisabled?: boolean) => {
      if (optionDisabled) return;
      onChange(optionValue);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const availableOptions = options.filter((o) => !o.disabled);
        const currentIndex = availableOptions.findIndex((o) => o.value === value);
        let nextIndex = 0;
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < availableOptions.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : availableOptions.length - 1;
        }
        if (availableOptions[nextIndex]) {
          onChange(availableOptions[nextIndex].value);
        }
      }
    };

    const handleWindowEvents = () => {
      updateMenuPosition();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowEvents);
    window.addEventListener('scroll', handleWindowEvents, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowEvents);
      window.removeEventListener('scroll', handleWindowEvents, true);
    };
  }, [onChange, open, options, updateMenuPosition, value]);

  const sizeClasses = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-xs';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        name={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        disabled={disabled}
        onClick={toggleOpen}
        style={{
          width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
          ...style,
        }}
        className={cn(
          'rounded-[var(--radius-sm)] border border-line bg-sunken text-primary font-medium',
          'inline-flex items-center justify-between gap-2 transition-colors cursor-pointer outline-none select-none',
          sizeClasses,
          open
            ? 'border-accent bg-accent-dim/30 ring-2 ring-accent/20'
            : 'hover:border-focus hover:bg-hover/60 focus:border-accent focus:ring-2 focus:ring-accent/20',
          disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
          className,
        )}
      >
        <span className="min-w-0 truncate text-left">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            'transition-transform shrink-0 duration-150',
            open ? 'rotate-180 text-accent' : 'text-tertiary',
          )}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-labelledby={selectId}
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: menuPos.x,
            top: menuPos.y,
            width: menuPos.width,
            zIndex: Z.SEARCH_PANEL,
          }}
          className="rounded-[var(--radius-md)] border border-line bg-overlay shadow-xl backdrop-blur-md p-1 max-h-64 overflow-y-auto grid gap-0.5 box-border"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => handleSelect(option.value, option.disabled)}
                className={cn(
                  'min-h-[30px] px-2.5 rounded-[6px] text-xs font-medium flex items-center justify-between transition-colors cursor-pointer text-left select-none',
                  isSelected
                    ? 'bg-accent-dim text-accent font-semibold'
                    : 'text-secondary hover:bg-hover hover:text-primary',
                  option.disabled && 'opacity-45 cursor-not-allowed',
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected && <Check size={13} className="text-accent shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
