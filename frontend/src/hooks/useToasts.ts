import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_EXIT_DURATION = 1080;

/** Toast 操作按钮 */
export interface ToastAction {
  onClick?: () => void;
  [key: string]: unknown;
}

/** Toast 条目 */
export interface ToastItem {
  id: number;
  message: string;
  type: string;
  actions: ToastAction[];
  closing: boolean;
}

export interface UseToastsResult {
  toasts: ToastItem[];
  addToast: (message: string | Error, type?: string, duration?: number, actions?: ToastAction[]) => number;
  removeToast: (id: number) => void;
  handleToastAction: (id: number, action: ToastAction | undefined) => void;
}

export default function useToasts(): UseToastsResult {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mountedRef = useRef(true);
  const toastIdRef = useRef(0);
  const autoDismissTimersRef = useRef(new Map<number, number>());
  const exitTimersRef = useRef(new Map<number, number>());

  const clearTimer = useCallback((timersRef: React.RefObject<Map<number, number>>, id: number) => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const removeToastImmediately = useCallback((id: number) => {
    clearTimer(autoDismissTimersRef, id);
    clearTimer(exitTimersRef, id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [clearTimer]);

  const removeToast = useCallback((id: number) => {
    clearTimer(autoDismissTimersRef, id);
    clearTimer(exitTimersRef, id);
    let shouldAnimate = false;
    setToasts((prev) => prev.map((toast) => {
      if (toast.id !== id || toast.closing) return toast;
      shouldAnimate = true;
      return { ...toast, closing: true };
    }));
    if (!shouldAnimate) return;
    const timer = window.setTimeout(() => {
      if (mountedRef.current) removeToastImmediately(id);
    }, TOAST_EXIT_DURATION);
    exitTimersRef.current.set(id, timer);
  }, [clearTimer, removeToastImmediately]);

  const addToast = useCallback((message: string | Error, type = 'info', duration = 3000, actions: ToastAction[] = []) => {
    const id = ++toastIdRef.current;
    const text = message instanceof Error ? message.message : String(message ?? '');
    setToasts((prev) => [...prev, { id, message: text, type, actions, closing: false }]);
    if (duration > 0) {
      const timer = window.setTimeout(() => {
        if (mountedRef.current) removeToast(id);
      }, duration);
      autoDismissTimersRef.current.set(id, timer);
    }
    return id;
  }, [removeToast]);

  const handleToastAction = useCallback((id: number, action: ToastAction | undefined) => {
    removeToastImmediately(id);
    action?.onClick?.();
  }, [removeToastImmediately]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoDismissTimersRef.current.forEach(window.clearTimeout);
      autoDismissTimersRef.current.clear();
      exitTimersRef.current.forEach(window.clearTimeout);
      exitTimersRef.current.clear();
    };
  }, []);

  return { toasts, addToast, removeToast, handleToastAction };
}
