import { useCallback, useLayoutEffect, useRef } from 'react'
import AIChatMarkdown from './AIChatMarkdown.tsx'

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="relative ml-1 inline-flex h-[1.5em] w-2 items-center justify-center align-text-bottom"
    >
      <span
        className="absolute inset-[10%_34%] animate-[ai-chat-stream-cursor-beam_0.9s_ease-in-out_infinite] rounded-full bg-[rgba(var(--accent-rgb),0.92)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.28)]"
      />
    </span>
  )
}

interface AIChatAssistantBodyPaneProps {
  text?: string
  isStreaming?: boolean
}

export default function AIChatAssistantBodyPane({ text, isStreaming = false }: AIChatAssistantBodyPaneProps) {
  const content = typeof text === 'string' ? text.trim() : ''
  const displayContent = isStreaming && content.endsWith('▍') ? content.slice(0, -1) : content
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const followRef = useRef(true)
  const lastTouchClientYRef = useRef<number | null>(null)

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current
    if (!container || !followRef.current) {
      return
    }
    container.scrollTop = container.scrollHeight
  }, [])

  const suspendFollow = useCallback(() => {
    followRef.current = false
  }, [])

  useLayoutEffect(() => {
    scrollToBottom()
  }, [displayContent, isStreaming, scrollToBottom])

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element || typeof ResizeObserver !== 'function') {
      return undefined
    }
    const observer = new ResizeObserver(scrollToBottom)
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollToBottom])

  if (!displayContent && !isStreaming) {
    return null
  }

  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) {
      return
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceToBottom <= 2) {
      followRef.current = true
    }
  }

  const handleWheelCapture = (event: React.WheelEvent<HTMLDivElement>) => {
    if ((Number(event?.deltaY) || 0) < -1) {
      suspendFollow()
    }
  }

  const handleTouchStartCapture = (event: React.TouchEvent<HTMLDivElement>) => {
    const nextClientY = Number(event?.touches?.[0]?.clientY)
    lastTouchClientYRef.current = Number.isFinite(nextClientY) ? nextClientY : null
  }

  const handleTouchMoveCapture = (event: React.TouchEvent<HTMLDivElement>) => {
    const nextClientY = Number(event?.touches?.[0]?.clientY)
    const previousClientY = lastTouchClientYRef.current
    lastTouchClientYRef.current = Number.isFinite(nextClientY) ? nextClientY : null
    if (Number.isFinite(nextClientY) && previousClientY !== null && previousClientY - nextClientY < -1) {
      suspendFollow()
    }
  }

  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current
    if (!container || event?.target !== container) {
      return
    }
    const rect = container.getBoundingClientRect()
    const scrollbarWidth = Math.max(container.offsetWidth - container.clientWidth, 12)
    if (Number(event?.clientX) >= rect.right - scrollbarWidth) {
      suspendFollow()
    }
  }

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event?.key)) {
      suspendFollow()
    }
  }

  return (
    <div className="min-w-0 text-base leading-[1.7] text-primary">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheelCapture={handleWheelCapture}
        onTouchStartCapture={handleTouchStartCapture}
        onTouchMoveCapture={handleTouchMoveCapture}
        onTouchEndCapture={() => {
          lastTouchClientYRef.current = null
        }}
        onTouchCancelCapture={() => {
          lastTouchClientYRef.current = null
        }}
        onPointerDownCapture={handlePointerDownCapture}
        onKeyDownCapture={handleKeyDownCapture}
        className="min-w-0 max-h-[420px] overflow-y-auto overscroll-contain pr-1 [overflow-anchor:none] [scrollbar-gutter:stable_both-edges]"
      >
        <div
          ref={contentRef}
          className={isStreaming
            ? 'min-h-[1.6em] min-w-0 whitespace-pre-wrap [word-break:break-word]'
            : 'min-w-0'}
        >
          {isStreaming ? (
            <>
              {displayContent}
              <StreamingCursor />
            </>
          ) : (
            <AIChatMarkdown text={displayContent} enableQuoteContextMenu={true} />
          )}
        </div>
      </div>
    </div>
  )
}
