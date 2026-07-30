import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n.js';
import { formatShortcut } from '../utils/platform.js';
import { clampMenuPosition } from '../utils/menuPosition.js';
import { GLOBAL_CONTEXT_MENU_OPEN_EVENT } from '../utils/contextMenu.js';
import * as runtime from '../../wailsjs/runtime/runtime.js';

function normalizeMenuItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item, index) => {
    if (item?.type === 'divider') {
      return {
        key: typeof item?.key === 'string' && item.key.trim() ? item.key.trim() : `divider-${index}`,
        type: 'divider',
      };
    }
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    if (!label) {
      return null;
    }
    return {
      key: typeof item?.key === 'string' && item.key.trim() ? item.key.trim() : `item-${index}`,
      type: 'item',
      label,
      shortcut: typeof item?.shortcut === 'string' ? item.shortcut.trim() : '',
      danger: item?.danger === true,
      disabled: item?.disabled === true,
      onSelect: typeof item?.onSelect === 'function' ? item.onSelect : null,
    };
  }).filter(Boolean);
}

function resolveMenuPosition(detail, itemCount) {
  const x = Number(detail?.x);
  const y = Number(detail?.y);
  const estimatedWidth = Number(detail?.estimatedWidth);
  const estimatedHeight = Number(detail?.estimatedHeight);
  const width = Number.isFinite(estimatedWidth) && estimatedWidth > 0 ? estimatedWidth : 168;
  const height = Number.isFinite(estimatedHeight) && estimatedHeight > 0 ? estimatedHeight : Math.max(40, itemCount * 36 + 8);
  return clampMenuPosition(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0, width, height);
}

function resolveEditableTarget(target) {
  if (typeof window === 'undefined') {
    return null;
  }
  if (target instanceof window.HTMLInputElement || target instanceof window.HTMLTextAreaElement) {
    return target;
  }
  return null;
}

export default function GlobalContextMenu() {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const handleInputAction = useCallback(async (targetInput, action) => {
    if (!targetInput) {
      return;
    }
    targetInput.focus();
    try {
      if (action === 'copy') {
        const text = targetInput.value.substring(targetInput.selectionStart, targetInput.selectionEnd);
        if (text) {
          await runtime.ClipboardSetText(text);
        }
        return;
      }
      if (action === 'cut') {
        const text = targetInput.value.substring(targetInput.selectionStart, targetInput.selectionEnd);
        if (!text) {
          return;
        }
        await runtime.ClipboardSetText(text);
        const start = targetInput.selectionStart;
        const end = targetInput.selectionEnd;
        const proto = targetInput.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        const nextValue = targetInput.value.substring(0, start) + targetInput.value.substring(end);
        nativeSetter.call(targetInput, nextValue);
        targetInput.setSelectionRange(start, start);
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (action === 'paste') {
        let text = '';
        try {
          text = await runtime.ClipboardGetText();
        } catch {}
        if (!text) {
          try {
            text = await navigator.clipboard.readText();
          } catch {}
        }
        if (!text) {
          return;
        }
        const start = targetInput.selectionStart;
        const end = targetInput.selectionEnd;
        const proto = targetInput.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeSetter.call(
          targetInput,
          targetInput.value.substring(0, start) + text + targetInput.value.substring(end)
        );
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (action === 'selectAll') {
        targetInput.select();
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
    }
  }, []);

  const buildInputMenuItems = useCallback((targetInput) => {
    const start = Number(targetInput?.selectionStart);
    const end = Number(targetInput?.selectionEnd);
    const hasSelection = Number.isFinite(start) && Number.isFinite(end) && end > start;
    return [
      {
        key: 'cut',
        label: t('剪切'),
        shortcut: formatShortcut('Ctrl+X'),
        disabled: !hasSelection,
        onSelect: () => handleInputAction(targetInput, 'cut'),
      },
      {
        key: 'copy',
        label: t('复制'),
        shortcut: formatShortcut('Ctrl+C'),
        disabled: !hasSelection,
        onSelect: () => handleInputAction(targetInput, 'copy'),
      },
      {
        key: 'paste',
        label: t('粘贴'),
        shortcut: formatShortcut('Ctrl+V'),
        onSelect: () => handleInputAction(targetInput, 'paste'),
      },
      { type: 'divider', key: 'input-divider' },
      {
        key: 'select-all',
        label: t('全选'),
        shortcut: formatShortcut('Ctrl+A'),
        onSelect: () => handleInputAction(targetInput, 'selectAll'),
      },
    ];
  }, [handleInputAction, t]);

  const openMenu = useCallback((detail) => {
    const items = normalizeMenuItems(detail?.items);
    if (items.length === 0) {
      closeMenu();
      return;
    }
    const position = resolveMenuPosition(detail, items.length);
    setMenu({
      x: position.x,
      y: position.y,
      items,
    });
  }, [closeMenu]);

  const handleMenuItemClick = useCallback((item) => {
    if (!item || item.type !== 'item' || item.disabled || typeof item.onSelect !== 'function') {
      return;
    }
    const onSelect = item.onSelect;
    closeMenu();
    Promise.resolve()
      .then(() => onSelect(item))
      .catch((error) => {
        console.error('Context menu action failed:', error);
      });
  }, [closeMenu]);

  useEffect(() => {
    const handleContextMenu = (event) => {
      const targetInput = resolveEditableTarget(event.target);
      if (!targetInput) {
        return;
      }
      event.preventDefault();
      openMenu({
        x: event.clientX,
        y: event.clientY,
        estimatedWidth: 160,
        estimatedHeight: 150,
        items: buildInputMenuItems(targetInput),
      });
    };

    const handleCustomOpen = (event) => {
      openMenu(event?.detail);
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener(GLOBAL_CONTEXT_MENU_OPEN_EVENT, handleCustomOpen);
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener(GLOBAL_CONTEXT_MENU_OPEN_EVENT, handleCustomOpen);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('blur', closeMenu);
    };
  }, [buildInputMenuItems, closeMenu, openMenu]);

  if (!menu || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {menu.items.map((item) => {
        if (item.type === 'divider') {
          return <div key={item.key} className="context-menu-divider" />;
        }
        const className = [
          'context-menu-item',
          item.danger ? 'danger' : '',
          item.disabled ? 'disabled' : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={item.key}
            className={className}
            onClick={item.disabled ? undefined : () => handleMenuItemClick(item)}
          >
            <span className="item-label">{item.label}</span>
            {item.shortcut ? <span className="item-shortcut">{item.shortcut}</span> : null}
          </div>
        );
      })}
    </div>,
    document.body
  );
}