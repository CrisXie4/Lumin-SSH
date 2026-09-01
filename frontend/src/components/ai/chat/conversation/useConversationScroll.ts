import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import {
  getEntryKey,
  getTouchClientY,
  shouldIgnoreConversationScrollIntentFromNestedScroller,
  type GroupedConversationEntry,
} from './conversationTypes.ts';

export interface UseConversationScrollOptions {
  groupedMessages: GroupedConversationEntry[];
  conversationId: string;
  scrollToBottomSignal: number;
  containerRef: RefObject<HTMLDivElement | null>;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  scrollerElementRef: RefObject<HTMLElement | null>;
}

export function useConversationScroll({
  groupedMessages,
  conversationId,
  scrollToBottomSignal,
  containerRef,
  virtuosoRef,
  scrollerElementRef,
}: UseConversationScrollOptions) {
  const followIntentRef = useRef(true);
  const scrollAnimationFrameRef = useRef(0);
  const lastContainerHeightRef = useRef(0);
  const lastTouchClientYRef = useRef<number | null>(null);
  const isScrollbarDraggingRef = useRef(false);
  const lastConversationIdRef = useRef(conversationId);
  const contentHeightChangedAtRef = useRef(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [highlightedEntryKey, setHighlightedEntryKey] = useState('');

  const suspendFollow = useCallback(() => {
    const scroller = scrollerElementRef.current;
    if (!(scroller instanceof HTMLElement) || scroller.scrollHeight <= scroller.clientHeight + 1) {
      return;
    }
    followIntentRef.current = false;
    setShowScrollToBottom(true);
  }, [scrollerElementRef]);

  const handleJumpToUserMessage = useCallback((targetIndex: number, entry: GroupedConversationEntry) => {
    followIntentRef.current = false;
    setShowScrollToBottom(true);
    if (typeof virtuosoRef.current?.scrollToIndex === 'function') {
      virtuosoRef.current.scrollToIndex({
        index: targetIndex,
        align: 'center',
        behavior: 'auto',
      });
    }
    setHighlightedEntryKey(getEntryKey(entry, targetIndex));
  }, [virtuosoRef]);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    if (groupedMessages.length === 0) {
      return;
    }
    if (typeof virtuosoRef.current?.scrollToIndex === 'function') {
      virtuosoRef.current.scrollToIndex({
        index: groupedMessages.length - 1,
        align: 'end',
        behavior,
      });
      return;
    }
    const scroller = scrollerElementRef.current;
    if (scroller instanceof HTMLElement) {
      if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
      return;
    }
    virtuosoRef.current?.scrollTo?.({
      top: Number.MAX_SAFE_INTEGER,
      behavior,
    });
  }, [groupedMessages.length, scrollerElementRef, virtuosoRef]);

  const scheduleScrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto', force = false) => {
    if (groupedMessages.length === 0) {
      return;
    }
    if (!force && !followIntentRef.current) {
      return;
    }
    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }
    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      scrollAnimationFrameRef.current = 0;
      scrollToBottom(behavior);
    });
  }, [groupedMessages.length, scrollToBottom]);

  // 列表总高变化是流式期间的主要跟随通道：动画、自动展开折叠、异步内容注入
  // 都只改条目高度而不改条目数量，仅靠 atBottomThreshold 无法守住跟随。
  // 这里只在跟随态下回底（非 force），因此不会打断正在看历史的用户。
  const handleTotalListHeightChanged = useCallback(() => {
    contentHeightChangedAtRef.current = Date.now();
    scheduleScrollToBottom('auto');
  }, [scheduleScrollToBottom]);

  useEffect(() => {
    if (groupedMessages.length === 0) {
      followIntentRef.current = true;
      lastContainerHeightRef.current = 0;
      setShowScrollToBottom(false);
    }
  }, [groupedMessages.length]);

  // 切会话属于全新上下文，强制回底；消息增长必须尊重用户当前意图，
  // 否则自主多轮里每开一轮都会把正在看历史的用户拽回底部。
  useEffect(() => {
    if (groupedMessages.length === 0) {
      return;
    }
    const isConversationSwitch = lastConversationIdRef.current !== conversationId;
    lastConversationIdRef.current = conversationId;
    if (isConversationSwitch) {
      followIntentRef.current = true;
      setShowScrollToBottom(false);
      scheduleScrollToBottom('auto', true);
      return;
    }
    scheduleScrollToBottom('auto');
  }, [conversationId, groupedMessages.length, scheduleScrollToBottom]);

  useEffect(() => {
    if (!scrollToBottomSignal || groupedMessages.length === 0) {
      return;
    }
    followIntentRef.current = true;
    setShowScrollToBottom(false);
    scheduleScrollToBottom('smooth', true);
  }, [groupedMessages.length, scheduleScrollToBottom, scrollToBottomSignal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver !== 'function') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect?.height || 0;
      if (!nextHeight) {
        return;
      }
      if (!lastContainerHeightRef.current) {
        lastContainerHeightRef.current = nextHeight;
        return;
      }
      if (Math.abs(nextHeight - lastContainerHeightRef.current) < 1) {
        return;
      }
      lastContainerHeightRef.current = nextHeight;
      scheduleScrollToBottom('auto');
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [containerRef, scheduleScrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightedEntryKey) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setHighlightedEntryKey('');
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [highlightedEntryKey]);

  const handleScrollToBottom = useCallback(() => {
    followIntentRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom('auto');
  }, [scrollToBottom]);

  const handleUserWheelCapture = useCallback((event: React.WheelEvent) => {
    const deltaY = Number(event?.deltaY) || 0;
    if (deltaY >= -1) {
      return;
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return;
    }
    suspendFollow();
  }, [containerRef, suspendFollow]);

  const handleUserTouchStartCapture = useCallback((event: React.TouchEvent) => {
    lastTouchClientYRef.current = getTouchClientY(event);
  }, []);

  const handleUserTouchMoveCapture = useCallback((event: React.TouchEvent) => {
    const nextTouchClientY = getTouchClientY(event);
    const previousTouchClientY = lastTouchClientYRef.current;
    lastTouchClientYRef.current = nextTouchClientY;
    if (nextTouchClientY === null || previousTouchClientY === null) {
      return;
    }
    const deltaY = previousTouchClientY - nextTouchClientY;
    if (deltaY >= -1) {
      return;
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return;
    }
    suspendFollow();
  }, [containerRef, suspendFollow]);

  const handleUserTouchEndCapture = useCallback(() => {
    lastTouchClientYRef.current = null;
  }, []);

  const handlePointerDownCapture = useCallback((event: React.PointerEvent) => {
    const scroller = scrollerElementRef.current;
    if (!(scroller instanceof HTMLElement) || event?.target !== scroller) {
      return;
    }
    const rect = scroller.getBoundingClientRect();
    const scrollbarWidth = Math.max(scroller.offsetWidth - scroller.clientWidth, 12);
    const isLeftScrollbar = getComputedStyle(scroller).direction === 'rtl';
    const clientX = Number(event?.clientX);
    const isScrollbar = isLeftScrollbar
      ? clientX <= rect.left + scrollbarWidth
      : clientX >= rect.right - scrollbarWidth;
    if (isScrollbar) {
      isScrollbarDraggingRef.current = true;
      suspendFollow();
    }
  }, [scrollerElementRef, suspendFollow]);

  const handlePointerEndCapture = useCallback(() => {
    if (!isScrollbarDraggingRef.current) {
      return;
    }
    isScrollbarDraggingRef.current = false;
    const scroller = scrollerElementRef.current;
    if (!(scroller instanceof HTMLElement)) {
      return;
    }
    const isAtBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 2;
    followIntentRef.current = isAtBottom;
    setShowScrollToBottom(!isAtBottom);
  }, [scrollerElementRef]);

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerEndCapture);
    window.addEventListener('pointercancel', handlePointerEndCapture);
    window.addEventListener('blur', handlePointerEndCapture);
    return () => {
      window.removeEventListener('pointerup', handlePointerEndCapture);
      window.removeEventListener('pointercancel', handlePointerEndCapture);
      window.removeEventListener('blur', handlePointerEndCapture);
    };
  }, [handlePointerEndCapture]);

  const handleKeyDownCapture = useCallback((event: React.KeyboardEvent) => {
    if (!['ArrowUp', 'PageUp', 'Home'].includes(event?.key)) {
      return;
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, -1)) {
      return;
    }
    suspendFollow();
  }, [containerRef, suspendFollow]);

  // 内容收缩（如思考链折叠）会让当前 scrollTop 意外变成底部，
  // 此时的 atBottom 不代表用户意图，不应据此恢复跟随。
  const isContentHeightSettling = useCallback(() => (
    Date.now() - contentHeightChangedAtRef.current <= 80
  ), []);

  return {
    followIntentRef,
    isScrollbarDraggingRef,
    showScrollToBottom,
    setShowScrollToBottom,
    highlightedEntryKey,
    setHighlightedEntryKey,
    suspendFollow,
    handleJumpToUserMessage,
    scrollToBottom,
    scheduleScrollToBottom,
    handleScrollToBottom,
    handleTotalListHeightChanged,
    isContentHeightSettling,
    handleUserWheelCapture,
    handleUserTouchStartCapture,
    handleUserTouchMoveCapture,
    handleUserTouchEndCapture,
    handlePointerDownCapture,
    handleKeyDownCapture,
  };
}
