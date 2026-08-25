import { useCallback, useEffect } from 'react';
import {
  WindowGetSize,
  WindowIsMaximised,
  WindowMaximise,
  WindowSetSize,
  WindowToggleMaximise,
} from '../../wailsjs/runtime/runtime.js';

interface SavedWindowSize {
  w: number;
  h: number;
  maximized: boolean;
}

function shouldRememberWindowSize(): boolean {
  return typeof localStorage !== 'undefined'
    && localStorage.getItem('rememberWindowSize') !== 'false';
}

function readSavedWindowSize(): SavedWindowSize | null {
  try {
    const parsed = JSON.parse(localStorage.getItem('windowSize') || 'null') as unknown;
    const saved = parsed as SavedWindowSize | null;
    return saved && saved.w > 100 && saved.h > 100 ? saved : null;
  } catch {
    return null;
  }
}

export default function useWindowState(): () => Promise<void> {
  // 保持 Wails 窗口边缘缩放状态与最大化状态同步，防止最大化时显示边缘缩放光标
  useEffect(() => {
    let isMax = false;

    const syncMaximizeState = async () => {
      try {
        isMax = await WindowIsMaximised();
        const wailsFlags = (window as unknown as { wails?: { flags?: { enableResize?: boolean; resizeEdge?: string; defaultCursor?: string | null } } })?.wails?.flags;
        if (wailsFlags) {
          wailsFlags.enableResize = !isMax;
        }
        if (isMax) {
          if (wailsFlags && 'resizeEdge' in wailsFlags) {
            delete wailsFlags.resizeEdge;
          }
          if (document.documentElement.style.cursor && document.documentElement.style.cursor.includes('resize')) {
            document.documentElement.style.cursor = '';
          }
        }
      } catch {}
    };

    syncMaximizeState();
    const onResize = () => {
      syncMaximizeState();
    };
    window.addEventListener('resize', onResize);
    const timer = window.setInterval(syncMaximizeState, 400);

    const onMouseMove = () => {
      if (isMax) {
        const wailsFlags = (window as unknown as { wails?: { flags?: { enableResize?: boolean; resizeEdge?: string } } })?.wails?.flags;
        if (wailsFlags) {
          wailsFlags.enableResize = false;
          if ('resizeEdge' in wailsFlags) {
            delete wailsFlags.resizeEdge;
          }
        }
        if (document.documentElement.style.cursor && document.documentElement.style.cursor.includes('resize')) {
          document.documentElement.style.cursor = '';
        }
      }
    };
    window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove, { capture: true });
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!shouldRememberWindowSize()) return undefined;
    const saved = readSavedWindowSize();
    if (!saved) return undefined;
    const frame = window.requestAnimationFrame(async () => {
      try {
        await WindowSetSize(saved.w, saved.h);
        if (saved.maximized) await WindowMaximise();
      } catch { }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!shouldRememberWindowSize()) return undefined;
    const saved = readSavedWindowSize();
    let lastW = saved && saved.w > 100 ? saved.w : 0;
    let lastH = saved && saved.h > 100 ? saved.h : 0;
    let lastMaximized: boolean | null = null;
    let debounceTimer = 0;

    const persist = async () => {
      try {
        const [size, maximized] = await Promise.all([WindowGetSize(), WindowIsMaximised()]);
        if (maximized) {
          if (lastMaximized === true) return;
          lastMaximized = true;
          const w = lastW > 100 ? lastW : size?.w;
          const h = lastH > 100 ? lastH : size?.h;
          if (w > 100 && h > 100) {
            localStorage.setItem('windowSize', JSON.stringify({ w, h, maximized: true }));
          }
          return;
        }
        if (size?.w > 100 && size?.h > 100
          && (size.w !== lastW || size.h !== lastH || lastMaximized !== false)) {
          lastW = size.w;
          lastH = size.h;
          lastMaximized = false;
          localStorage.setItem('windowSize', JSON.stringify({ w: size.w, h: size.h, maximized: false }));
        }
      } catch { }
    };

    const onResize = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(persist, 150);
    };
    window.addEventListener('resize', onResize);
    const interval = window.setInterval(persist, 2000);
    return () => {
      window.clearTimeout(debounceTimer);
      window.removeEventListener('resize', onResize);
      window.clearInterval(interval);
    };
  }, []);

  return useCallback(async () => {
    try {
      if (shouldRememberWindowSize()) {
        const [size, maximized] = await Promise.all([WindowGetSize(), WindowIsMaximised()]);
        if (!maximized && size?.w > 100 && size?.h > 100) {
          localStorage.setItem('windowSize', JSON.stringify({ w: size.w, h: size.h, maximized: true }));
        }
      }
    } catch { }
    WindowToggleMaximise();
    setTimeout(async () => {
      try {
        const isMax = await WindowIsMaximised();
        const wailsFlags = (window as unknown as { wails?: { flags?: { enableResize?: boolean; resizeEdge?: string } } })?.wails?.flags;
        if (wailsFlags) {
          wailsFlags.enableResize = !isMax;
          if (isMax) {
            delete wailsFlags.resizeEdge;
            if (document.documentElement.style.cursor && document.documentElement.style.cursor.includes('resize')) {
              document.documentElement.style.cursor = '';
            }
          }
        }
      } catch {}
    }, 100);
  }, []);
}
