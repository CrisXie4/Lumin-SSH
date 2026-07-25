import { ChevronUp, Lightbulb } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../i18n.js'
import AIChatMarkdown from './AIChatMarkdown.jsx'

function parseDurationSeconds(duration) {
  if (typeof duration !== 'string') {
    return 0
  }
  const match = duration.trim().match(/(\d+(?:\.\d+)?)s$/)
  return match ? Number(match[1]) : 0
}

const reasoningBodyMaxHeight = 360
const collapseTransitionMs = 200

export default function AIChatReasoningBlock({ text, duration = '', isStreaming = false, isLast = false }) {
  const { t } = useTranslation()
  const content = typeof text === 'string' ? text.trim() : ''
  const durationLabel = typeof duration === 'string' && duration.trim() ? duration.trim() : ''
  const startTimeRef = useRef(Date.now())
  const contentRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const shouldAutoFollowRef = useRef(true)
  const scrollFrameRef = useRef(0)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollResetRef = useRef(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(!isLast)
  const [contentHeight, setContentHeight] = useState(0)
  // 只在用户点折叠/展开时开过渡；内容增高绝不能带 max-height 动画
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isLast) {
      shouldAutoFollowRef.current = true
      setIsCollapsed(false)
      return
    }
    // 已是折叠态时别空跑动画（首屏非最后一条初始就是折叠）
    setIsCollapsed((previous) => {
      if (!previous) {
        setIsAnimating(true)
      }
      return true
    })
  }, [isLast])

  useEffect(() => {
    if (!isStreaming) {
      setElapsedMs(0)
      return undefined
    }
    startTimeRef.current = Date.now()
    setElapsedMs(0)
    const updateElapsed = () => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [isStreaming])

  const cancelScheduledScrollToBottom = () => {
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

  const scrollToBottom = () => {
    const container = scrollContainerRef.current
    if (!container || !shouldAutoFollowRef.current || isCollapsed) {
      return
    }
    markProgrammaticScroll()
    container.scrollTop = Math.max(container.scrollHeight - container.clientHeight, 0)
  }

  const scheduleScrollToBottom = () => {
    if (!isStreaming || !shouldAutoFollowRef.current || isCollapsed || scrollFrameRef.current) {
      return
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0
      scrollToBottom()
    })
  }

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) {
      return undefined
    }
    const updateHeight = () => setContentHeight(element.scrollHeight)
    updateHeight()
    if (isStreaming) {
      scheduleScrollToBottom()
    }
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(() => {
      updateHeight()
      if (isStreaming) {
        scheduleScrollToBottom()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [content, isCollapsed, isStreaming])

  useEffect(() => {
    if (!isAnimating) {
      return undefined
    }
    const timer = window.setTimeout(() => setIsAnimating(false), collapseTransitionMs)
    return () => window.clearTimeout(timer)
  }, [isAnimating, isCollapsed])

  useEffect(() => {
    return () => {
      cancelScheduledScrollToBottom()
    }
  }, [])

  if (!content) {
    return null
  }

  const liveDurationLabel = isStreaming ? `${Math.max(0, Math.floor(elapsedMs / 1000))}s` : ''
  const finalDurationLabel = !isStreaming && durationLabel ? `${parseDurationSeconds(durationLabel).toFixed(1)}s` : ''
  const displayDurationLabel = liveDurationLabel || finalDurationLabel
  const contentCanScroll = contentHeight > reasoningBodyMaxHeight
  // 折叠动画用固定上限；展开稳态不绑 contentHeight，避免流式每字改 maxHeight
  const collapseAnimHeight = reasoningBodyMaxHeight + 8

  const handleToggle = () => {
    setIsAnimating(true)
    setIsCollapsed((previous) => {
      const nextValue = !previous
      if (!nextValue) {
        shouldAutoFollowRef.current = true
      }
      return nextValue
    })
  }

  const handleContentScroll = () => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (programmaticScrollRef.current) {
      if (distanceToBottom <= 12) {
        shouldAutoFollowRef.current = true
      }
      return
    }
    shouldAutoFollowRef.current = distanceToBottom <= 12
  }

  return (
    <div style={{ display: 'grid', gap: 0, width: '100%' }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb size={14} color="var(--text-secondary)" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 12 }}>{t('思考链')}</span>
          {displayDurationLabel ? (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {displayDurationLabel}
            </span>
          ) : null}
        </span>
        <ChevronUp
          size={14}
          color="var(--text-tertiary)"
          style={{
            opacity: 0.88,
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: isAnimating ? `transform ${collapseTransitionMs}ms ease` : 'none',
          }}
        />
      </button>
      {(content?.trim()?.length ?? 0) > 0 ? (
        <div
          style={{
            overflow: 'hidden',
            opacity: isCollapsed ? 0 : 1,
            // 展开用固定上限，不绑 contentHeight：流式增高不再改 maxHeight
            // 折叠/展开才能从固定值过渡，避免 maxHeight:auto→0 动画失效
            maxHeight: isCollapsed ? 0 : collapseAnimHeight,
            transition: isAnimating
              ? `max-height ${collapseTransitionMs}ms ease, opacity ${collapseTransitionMs}ms ease`
              : 'none',
          }}>
          <div
            ref={scrollContainerRef}
            onScroll={handleContentScroll}
            style={{
              maxHeight: reasoningBodyMaxHeight,
              overflowY: contentCanScroll ? 'auto' : 'visible',
              overflowAnchor: 'none',
              paddingRight: contentCanScroll ? 4 : 0,
              scrollbarGutter: contentCanScroll ? 'stable both-edges' : 'auto',
            }}>
            <div
              ref={contentRef}
              style={{
                padding: '2px 0 2px 14px',
                borderLeft: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                lineHeight: 1.7,
                wordBreak: 'break-word',
                whiteSpace: isStreaming ? 'pre-wrap' : undefined,
              }}>
              {/* 流式用纯文本，避免半成品 Markdown 反复重排把气泡撑抖 */}
              {isStreaming ? content : <AIChatMarkdown text={content} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
