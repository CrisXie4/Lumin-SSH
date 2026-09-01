import { useEffect, useState } from 'react';

const EDITOR_WORD_WRAP_STORAGE_KEY = 'editorWordWrap';
const EDITOR_WORD_WRAP_EVENT = 'editor-word-wrap-changed';

export function readEditorWordWrap() {
  try {
    return localStorage.getItem(EDITOR_WORD_WRAP_STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function writeEditorWordWrap(enabled: boolean) {
  try {
    localStorage.setItem(EDITOR_WORD_WRAP_STORAGE_KEY, String(enabled));
  } catch (_) { /* 忽略持久化失败, 仅本轮生效 */ }
  window.dispatchEvent(new CustomEvent(EDITOR_WORD_WRAP_EVENT, { detail: enabled }));
}

export function useEditorWordWrap() {
  const [enabled, setEnabled] = useState(readEditorWordWrap);
  useEffect(() => {
    const refresh = () => setEnabled(readEditorWordWrap());
    refresh();
    window.addEventListener(EDITOR_WORD_WRAP_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EDITOR_WORD_WRAP_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return enabled;
}