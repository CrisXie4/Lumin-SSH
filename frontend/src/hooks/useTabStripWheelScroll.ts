import { useEffect } from 'react';

/**
 * 标签条滚轮统一行为：普通滚轮直接横向滚动标签，不依赖 Shift。
 * 必须挂原生非被动监听——React 合成 onWheel 在根容器上是 passive 的，
 * preventDefault 不生效，滚标签的同时默认纵向滚动还会链给祖先容器。
 * 已在边界时放行默认行为，让外层继续接住滚动。
 */
export default function useTabStripWheelScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  active = true,
) {
  useEffect(() => {
    if (!active) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    const handleWheel = createStripWheelHandler(el);
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [active, scrollRef]);
}

/**
 * 容器内全部标签条副本统一挂滚轮（AI 工作区标签条会被每个会话标签面板各渲染
 * 一份、共享同一 ref，单点挂载会落在隐藏副本上）。隐藏副本收不到 wheel 事件，
 * 监听全部副本即可只作用于可见条。depKey 变化（如标签数增减）时重扫重挂。
 */
export function useTabStripWheelScrollInContainer(
  containerRef: React.RefObject<HTMLElement | null>,
  depKey: unknown,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const strips = Array.from(container.querySelectorAll<HTMLElement>('.terminal-sub-tab-scroll'));
    const cleanups = strips.map((el) => {
      const handleWheel = createStripWheelHandler(el);
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [containerRef, depKey]);
}

function createStripWheelHandler(el: HTMLElement) {
  return (event: WheelEvent) => {
    const maxLeft = el.scrollWidth - el.clientWidth;
    if (maxLeft <= 1) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= maxLeft)) return;
    event.preventDefault();
    el.scrollLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + delta));
  };
}
