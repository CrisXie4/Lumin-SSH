import { Check, Search, ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

function normalizeSearchText(value) {
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
}) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchInputId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getOptionLabel = (item) => {
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

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
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
    <div ref={containerRef} style={{ position: 'relative' }}>
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
        style={{
          width: '100%',
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${open ? 'var(--accent-border, var(--accent))' : 'var(--border)'}`,
          background: open ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--surface-base)',
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
          textAlign: 'left',
          opacity: disabled ? 0.7 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transition)',
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'var(--transition)',
          }}
        />
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-overlay)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            zIndex: 120,
          }}
        >
          <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
            <Search size={14} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              id={searchInputId}
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                height: 34,
                padding: '0 10px 0 32px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 4 }}>
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <div key={group.label} style={{ display: 'grid', gap: 6, paddingTop: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle, var(--border))',
                      background: 'var(--surface-sunken)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 3,
                        height: 14,
                        borderRadius: 999,
                        background: 'var(--accent)',
                        flexShrink: 0,
                        opacity: 0.9,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        lineHeight: 1.2,
                      }}
                    >
                      {group.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 2, paddingLeft: 4 }}>
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
                          style={{
                            minHeight: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '0 10px',
                            border: 'none',
                            borderRadius: 8,
                            background: active ? 'rgba(var(--accent-rgb), 0.14)' : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: 13,
                            textAlign: 'left',
                            transition: 'var(--transition)',
                          }}
                        >
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {emptyText}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}