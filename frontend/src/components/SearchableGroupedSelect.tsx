import { Check, Search, ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../utils/cn.ts';
import { Z } from '../constants/zIndex.ts';

interface SelectOption {
  value: string;
  label?: string;
}

interface SelectGroup {
  label?: string;
  options: SelectOption[];
}

interface SearchableGroupedSelectProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  groups?: SelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  renderOptionLabel?: (item: SelectOption) => string;
}

function normalizeSearchText(value: unknown) {
  return String(value || '').toLowerCase().replace(/[_\s]+/g, '-').trim();
}

export default function SearchableGroupedSelect({
  id,
  value = '',
  onChange,
  groups = [],
  placeholder = '',
  searchPlaceholder = '',
  emptyText = '',
  disabled = false,
  renderOptionLabel,
}: SearchableGroupedSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getOptionLabel = (item: SelectOption) => {
    if (typeof renderOptionLabel === 'function') {
      return renderOptionLabel(item);
    }
    return item?.label || item?.value || '';
  };

  const selectedOption = useMemo(() => {
    for (const group of groups) {
      const found = Array.isArray(group?.options) ? group.options.find((item) => item.value === value) : null;
      if (found) {
        return found;
      }
    }
    return null;
  }, [groups, value]);

  const filteredGroups = useMemo(() => {
    const keyword = normalizeSearchText(search);
    if (!keyword) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        options: (Array.isArray(group?.options) ? group.options : []).filter((item) => {
          const haystack = [
            group?.label,
            item?.label,
            item?.value,
          ].map(normalizeSearchText);
          return haystack.some((entry) => entry.includes(keyword));
        }),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : (value || placeholder);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((prev) => !prev);
        }}
        className={cn(
          'w-full min-h-9 flex items-center justify-between gap-2.5 py-2 px-3 rounded-[var(--radius-sm)] border text-left box-border [transition:var(--transition)] text-primary',
          open ? 'border-accent-border bg-[rgba(var(--accent-rgb),0.08)]' : 'border-line bg-canvas',
          disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span className="min-w-0 truncate">
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-tertiary [transition:var(--transition)]', open ? 'rotate-180' : 'rotate-0')}
        />
      </button>

      {open ? (
        <div
          className="absolute top-[calc(100%+6px)] left-0 right-0 rounded-[var(--radius-md)] border border-line bg-overlay shadow-xl overflow-hidden"
          style={{ zIndex: Z.POPUP }}
        >
          <div className="relative p-2 border-b border-line-subtle">
            <Search size={14} className="absolute left-[18px] top-1/2 -translate-y-1/2 text-tertiary" />
            <input
              id={searchInputId}
              name="searchable-select-search"
              autoComplete="off"
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-[34px] pt-0 pb-0 pl-8 pr-2.5 rounded-[var(--radius-sm)] border border-line bg-sunken text-primary box-border outline-none"
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto p-1">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <div key={group.label} className="grid gap-1.5 pt-1.5">
                  <div
                    className="flex items-center gap-2 py-2 px-2.5 rounded-[var(--radius-sm)] border border-line-subtle bg-sunken shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] pointer-events-none select-none"
                  >
                    <span className="w-[3px] h-3.5 rounded-full bg-accent shrink-0 opacity-90" />
                    <span className="text-xs font-extrabold tracking-[0.04em] text-tertiary uppercase leading-[1.2]">
                      {group.label}
                    </span>
                  </div>
                  <div className="grid gap-0.5 pl-1">
                    {group.options.map((item) => {
                      const active = item.value === value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            onChange?.(item.value);
                            setOpen(false);
                          }}
                          className={cn(
                            'min-h-8 flex items-center justify-between gap-3 px-2.5 border-none rounded-[var(--radius-sm)] text-left text-base cursor-pointer [transition:var(--transition)]',
                            active ? 'bg-[rgba(var(--accent-rgb),0.14)] text-primary' : 'bg-transparent text-secondary',
                          )}
                        >
                          <span className="min-w-0 truncate">
                            {getOptionLabel(item)}
                          </span>
                          {active ? <Check size={13} color="var(--accent)" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3.5 px-2.5 text-center text-sm text-tertiary">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
