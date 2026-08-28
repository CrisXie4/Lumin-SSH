import { useSyncExternalStore } from 'react';
import { WindowIsMaximised } from '../../wailsjs/runtime/runtime.js';

let maximized = false;
let started = false;
let refCount = 0;
let pollTimer = 0;
let resizeDebounce = 0;
const listeners = new Set<() => void>();

async function poll(): Promise<void> {
  try {
    const next = await WindowIsMaximised();
    if (next !== maximized) {
      maximized = next;
      listeners.forEach((listener) => listener());
    }
  } catch { /* wails runtime 未就绪时静默，等待下轮轮询 */ }
}

function onWindowResize(): void {
  // 拖拽缩放过程中 resize 高频触发，防抖后再查询
  window.clearTimeout(resizeDebounce);
  resizeDebounce = window.setTimeout(() => void poll(), 120);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  refCount += 1;
  if (!started) {
    started = true;
    void poll();
    pollTimer = window.setInterval(() => void poll(), 400);
    window.addEventListener('resize', onWindowResize);
  }
  return () => {
    listeners.delete(listener);
    refCount -= 1;
    if (refCount <= 0 && started) {
      started = false;
      window.clearInterval(pollTimer);
      window.clearTimeout(resizeDebounce);
      window.removeEventListener('resize', onWindowResize);
    }
  };
}

/** 窗口最大化状态（全局单例轮询，多处订阅共享同一份 Wails IPC 结果） */
export default function useIsWindowMaximized(): boolean {
  return useSyncExternalStore(subscribe, () => maximized);
}

/** 立即刷新一次最大化状态（如最大化/还原切换后） */
export function refreshWindowMaximized(): void {
  void poll();
}
