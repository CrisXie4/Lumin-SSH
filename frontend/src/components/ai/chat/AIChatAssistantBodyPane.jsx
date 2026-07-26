import { useCallback, useLayoutEffect, useRef } from 'react'
import AIChatMarkdown from './AIChatMarkdown.jsx'

const streamingAnimatedTailLength = 1

const streamingCursorKeyframes = `
@keyframes ai-chat-stream-cursor-frame {
  0%, 100% {
    opacity: 0.38;
    transform: scaleY(0.94);
  }
  50% {
    opacity: 0.8;
    transform: scaleY(1);
  }
}

@keyframes ai-chat-stream-cursor-beam {
  0%, 100% {
    opacity: 0.52;
    transform: scaleY(0.78) translateY(1px);
  }
  50% {
    opacity: 1;
    transform: scaleY(1) translateY(0);
  }
}

@keyframes ai-chat-stream-char-enter {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`

const assistantBodyMaxHeight = 420

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 12,
        height: '1.5em',
        marginLeft: 4,
        verticalAlign: 'text-bottom',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: '4% 18%',
          borderRadius: 999,
          border: '1px solid rgba(var(--accent-rgb), 0.32)',
          animation: 'ai-chat-stream-cursor-frame 1.1s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: '10% 42%',
          borderRadius: 999,
          background: 'rgba(var(--accent-rgb), 0.9)',
          animation: 'ai-chat-stream-cursor-beam 0.9s ease-in-out infinite',
        }}
      />
    </span>
  )
}

function renderStreamingCharacter(char, index, isLatest) {
  if (char === '\r') {
    return null
  }
  if (char === '\n') {
    return <br key={`br-${index}`} />
  }
  const displayChar = char === ' ' ? '\u00A0' : char === '\t' ? '\u00A0\u00A0\u00A0\u00A0' : char
  return (
    <span
      key={`${index}-${char}`}
      style={
        isLatest
          ? {
              display: 'inline-block',
              verticalAlign: 'baseline',
              animation: 'ai-chat-stream-char-enter 160ms cubic-bezier(0.22, 1, 0.36, 1)',
              transformOrigin: '50% 100%',
            }
          : undefined
      }
    >
      {displayChar}
    </span>
  )
}

export default function AIChatAssistantBodyPane({ text, isStreaming = false }) {
  const content = typeof text === 'string' ? text.trim() : ''
  const displayContent = isStreaming && content.endsWith('▍') ? content.slice(0, -1) : content
  const scrollRef = useRef(null)
  const contentRef = useRef(null)
  const followRef = useRef(true)
  const lastTouchClientYRef = useRef(null)

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

  const streamingCharacters = isStreaming ? Array.from(displayContent) : []
  const animatedTailStart = Math.max(streamingCharacters.length - streamingAnimatedTailLength, 0)
  const stablePrefix = streamingCharacters.slice(0, animatedTailStart).join('')
  const animatedTail = streamingCharacters.slice(animatedTailStart)

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

  const handleWheelCapture = (event) => {
    if ((Number(event?.deltaY) || 0) < -1) {
      suspendFollow()
    }
  }

  const handleTouchStartCapture = (event) => {
    const nextClientY = Number(event?.touches?.[0]?.clientY)
    lastTouchClientYRef.current = Number.isFinite(nextClientY) ? nextClientY : null
  }

  const handleTouchMoveCapture = (event) => {
    const nextClientY = Number(event?.touches?.[0]?.clientY)
    const previousClientY = lastTouchClientYRef.current
    lastTouchClientYRef.current = Number.isFinite(nextClientY) ? nextClientY : null
    if (Number.isFinite(nextClientY) && previousClientY !== null && previousClientY - nextClientY < -1) {
      suspendFollow()
    }
  }

  const handlePointerDownCapture = (event) => {
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

  const handleKeyDownCapture = (event) => {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event?.key)) {
      suspendFollow()
    }
  }

  return (
    <div style={{ minWidth: 0, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7 }}>
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
        style={{
          minWidth: 0,
          maxHeight: assistantBodyMaxHeight,
          overflowY: 'auto',
          overflowAnchor: 'none',
          overscrollBehavior: 'contain',
          paddingRight: 4,
          scrollbarGutter: 'stable both-edges',
        }}
      >
        {isStreaming ? <style>{streamingCursorKeyframes}</style> : null}
        <div
          ref={contentRef}
          style={isStreaming
            ? {
                minWidth: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '1.6em',
              }
            : { minWidth: 0 }}
        >
          {isStreaming ? (
            <>
              {stablePrefix}
              {animatedTail.map((char, index) => renderStreamingCharacter(char, animatedTailStart + index, animatedTailStart + index === streamingCharacters.length - 1))}
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