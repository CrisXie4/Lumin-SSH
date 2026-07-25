import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import AIChatMarkdown from './AIChatMarkdown.jsx'

const streamingCursorKeyframes = `
@keyframes ai-chat-stream-cursor-blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.95; }
}
`

const assistantBodyMaxHeight = 420
const assistantBodyAutoFollowThreshold = 24

function StreamingCursor() {
  // 仅透明度闪烁，不用 transform，避免行盒高度亚像素抖动
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 2,
        height: '1.05em',
        marginLeft: 3,
        borderRadius: 1,
        verticalAlign: '-0.12em',
        background: 'rgba(var(--accent-rgb), 0.9)',
        animation: 'ai-chat-stream-cursor-blink 0.9s ease-in-out infinite',
      }}
    />
  )
}

export default function AIChatAssistantBodyPane({ text }) {
  const content = typeof text === 'string' ? text.trim() : ''
  const isStreaming = content.endsWith('▍')
  const displayContent = isStreaming ? content.slice(0, -1) : content
  const scrollContainerRef = useRef(null)
  const contentRef = useRef(null)
  const shouldAutoFollowRef = useRef(true)
  const scrollFrameRef = useRef(0)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollResetRef = useRef(0)
  const [contentHeight, setContentHeight] = useState(0)

  const cancelScheduledScrollBodyToBottom = () => {
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = 0
    }
    if (programmaticScrollResetRef.current) {
      window.clearTimeout(programmaticScrollResetRef.current)
      programmaticScrollResetRef.current = 0
    }
  }

  const markProgrammaticScroll = () => {
    programmaticScrollRef.current = true
    if (programmaticScrollResetRef.current) {
      window.clearTimeout(programmaticScrollResetRef.current)
    }
    programmaticScrollResetRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false
      programmaticScrollResetRef.current = 0
    }, 180)
  }

  const needsInnerScroll = contentHeight > assistantBodyMaxHeight

  const scrollBodyToBottom = () => {
    const container = scrollContainerRef.current
    if (!container || !shouldAutoFollowRef.current || !needsInnerScroll) {
      return
    }
    markProgrammaticScroll()
    container.scrollTop = Math.max(container.scrollHeight - container.clientHeight, 0)
  }

  const scheduleScrollBodyToBottom = () => {
    if (!isStreaming || !shouldAutoFollowRef.current || !needsInnerScroll || scrollFrameRef.current) {
      return
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0
      scrollBodyToBottom()
    })
  }

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) {
      return undefined
    }
    const updateHeight = () => setContentHeight(element.scrollHeight)
    updateHeight()
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [isStreaming])

  useLayoutEffect(() => {
    if (!isStreaming || !needsInnerScroll) {
      return undefined
    }
    scheduleScrollBodyToBottom()
    return undefined
  }, [displayContent, isStreaming, needsInnerScroll])

  useEffect(() => {
    return () => {
      cancelScheduledScrollBodyToBottom()
    }
  }, [])

  if (!displayContent && !isStreaming) {
    return null
  }

  const handleBodyScroll = () => {
    const container = scrollContainerRef.current
    if (!container || !needsInnerScroll) {
      return
    }
    const followThreshold = isStreaming ? assistantBodyAutoFollowThreshold : 0
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (programmaticScrollRef.current) {
      if (distanceToBottom <= followThreshold) {
        shouldAutoFollowRef.current = true
      }
      return
    }
    shouldAutoFollowRef.current = distanceToBottom <= followThreshold
  }

  return (
    <div style={{ minWidth: 0, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7 }}>
      <div
        ref={scrollContainerRef}
        onScroll={handleBodyScroll}
        style={{
          minWidth: 0,
          // 始终用固定上限封顶（不绑 contentHeight），短内容不会被撑高；
          // 仅超高后开内滚，避免首帧 contentHeight=0 时长文先炸开再收回
          maxHeight: assistantBodyMaxHeight,
          overflowY: needsInnerScroll ? 'auto' : 'visible',
          overflowAnchor: 'none',
          paddingRight: needsInnerScroll ? 4 : 0,
          scrollbarGutter: needsInnerScroll ? 'stable both-edges' : 'auto',
        }}
      >
        {isStreaming ? (
          <>
            <style>{streamingCursorKeyframes}</style>
            <div
              ref={contentRef}
              style={{
                minWidth: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '1.6em',
              }}
            >
              {displayContent}
              <StreamingCursor />
            </div>
          </>
        ) : (
          <div ref={contentRef}>
            <AIChatMarkdown text={displayContent} enableQuoteContextMenu={true} />
          </div>
        )}
      </div>
    </div>
  )
}
