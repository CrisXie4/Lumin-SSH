import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useTranslation } from '../../../i18n.js'
import AIChatAssistantTurn from './AIChatAssistantTurn.jsx'
import AIChatContextCondenseCard from './AIChatContextCondenseCard.jsx'
import AIChatReasoningBlock from './AIChatReasoningBlock.jsx'
import AIChatToolSessionPane from './AIChatToolSessionPane.jsx'
import AIChatUserMessage from './AIChatUserMessage.jsx'
import { groupConversationMessages } from './aiChatMessageTopology.js'

function formatSendPerfMetrics(record) {
  if (!record || !Array.isArray(record.stages) || record.stages.length === 0) {
    return ''
  }
  const total = Number(record.total) || 0
  const lines = record.stages.map((stage, index) => {
    const ms = Number(stage.ms) || 0
    const percent = total > 0 ? ((ms / total) * 100).toFixed(1) : '0.0'
    return `${index + 1}.${stage.label} -> ${ms.toFixed(1)}ms (${percent}%)`
  })
  lines.push(`总计 -> ${total.toFixed(1)}ms`)
  return lines.join('\n')
}

function resolveSendPerfMetrics(sendPerfMetricsRef, messageId) {
  const normalizedId = typeof messageId === 'string' ? messageId.trim() : ''
  if (!normalizedId || !sendPerfMetricsRef?.current) {
    return ''
  }
  return formatSendPerfMetrics(sendPerfMetricsRef.current.get(normalizedId))
}

function renderGroupedEntry(entry, handlers, entryMeta = {}) {
  switch (entry.type) {
    case 'user':
      return (
        <AIChatUserMessage
          message={entry.message}
          onRetry={handlers.onRetryUserMessage}
          onEdit={handlers.onEditUserMessage}
          onDelete={handlers.onDeleteMessage}
          messageActionBarAtBottom={Boolean(handlers.messageActionBarAtBottom)}
          perfMetricsText={resolveSendPerfMetrics(handlers.sendPerfMetricsRef, entry.message?.id)}
          isEditingTarget={Boolean(handlers.isEditingTarget)}
          isFirstUserMessage={Boolean(entryMeta.isFirstUserMessage)}
        />
      )
    case 'assistant-turn':
      return (
        <AIChatAssistantTurn
          assistant={entry.assistant}
          reasoning={entry.reasoning}
          tools={entry.tools}
          isLastAssistantTurn={Boolean(entryMeta.isLastAssistantTurn)}
          hasSubsequentAssistantMessage={Boolean(entryMeta.hasSubsequentAssistantMessage)}
          onDelete={handlers.onDeleteMessage}
          onRetry={handlers.onRetryAssistantMessage}
          onSendUserMessage={handlers.onSendUserMessage}
          onPreviewRestore={handlers.onPreviewRestore}
          onPreviewDiffFetch={handlers.onPreviewDiffFetch}
          onApplyRestore={handlers.onApplyRestore}
          followupInteractionLocked={Boolean(handlers.followupInteractionLocked)}
          messageActionBarAtBottom={Boolean(handlers.messageActionBarAtBottom)}
          perfMetricsText={resolveSendPerfMetrics(handlers.sendPerfMetricsRef, entry.assistant?.id)}
        />
      )
    case 'reasoning':
      return <AIChatReasoningBlock text={entry.message.text} duration={entry.message.duration} />
    case 'context-condense':
      return <AIChatContextCondenseCard message={entry.message} />
    case 'tool-session':
      return <AIChatToolSessionPane items={entry.tools} onSendUserMessage={handlers.onSendUserMessage} onPreviewRestore={handlers.onPreviewRestore} onPreviewDiffFetch={handlers.onPreviewDiffFetch} onApplyRestore={handlers.onApplyRestore} followupInteractionLocked={Boolean(handlers.followupInteractionLocked)} />
    default:
      return null
  }
}

function getEntryKey(entry, index) {
  if (entry?.id) {
    return entry.id
  }
  if (entry?.type === 'assistant-turn') {
    return entry.turnId || entry.assistant?.id || `assistant-${index}`
  }
  if (entry?.type === 'user') {
    return entry.message?.id || `user-${index}`
  }
  if (entry?.type === 'reasoning') {
    return entry.message?.id || `reasoning-${index}`
  }
  return `entry-${index}`
}

function getLastAssistantTurnIndex(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.type === 'assistant-turn') {
      return index
    }
  }
  return -1
}

function hasSubsequentAssistantTurn(entries, currentIndex) {
  for (let index = currentIndex + 1; index < entries.length; index += 1) {
    if (entries[index]?.type === 'assistant-turn') {
      return true
    }
  }
  return false
}

function getAIChatMessageEntryAnimationName(entry) {
  if (entry?.type === 'user') {
    return 'ai-chat-msg-enter-right'
  }
  return 'ai-chat-msg-enter-left'
}

function isVerticallyScrollableElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false
  }
  if (element.scrollHeight <= element.clientHeight + 1) {
    return false
  }
  const overflowY = window.getComputedStyle(element).overflowY
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

function collectScrollableAncestorsWithinContainer(target, container) {
  const ancestors = []
  let current = target instanceof HTMLElement ? target : null
  while (current && current !== container) {
    if (isVerticallyScrollableElement(current)) {
      ancestors.push(current)
    }
    current = current.parentElement
  }
  return ancestors
}

function canScrollableElementConsumeDelta(element, deltaY) {
  if (!(element instanceof HTMLElement) || Math.abs(Number(deltaY) || 0) < 1) {
    return false
  }
  const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0)
  if (deltaY < 0) {
    return element.scrollTop > 0
  }
  return element.scrollTop < maxScrollTop - 1
}

function shouldIgnoreConversationScrollIntentFromNestedScroller(target, container, deltaY = null) {
  if (!(container instanceof HTMLElement)) {
    return false
  }
  const scrollableAncestors = collectScrollableAncestorsWithinContainer(target, container)
  if (scrollableAncestors.length <= 1) {
    return false
  }
  const nearestScrollable = scrollableAncestors[0]
  const outermostScrollable = scrollableAncestors[scrollableAncestors.length - 1]
  if (nearestScrollable === outermostScrollable) {
    return false
  }
  if (typeof deltaY === 'number') {
    return canScrollableElementConsumeDelta(nearestScrollable, deltaY)
  }
  return true
}

function getTouchClientY(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0]
  const value = Number(touch?.clientY)
  return Number.isFinite(value) ? value : null
}

export default function AIChatConversation({ messages = [], sessionId = '', terminalId = '', conversationId = '', onSendUserMessage, onRetryUserMessage, onRetryAssistantMessage, onEditUserMessage, onDeleteMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked = false, messageActionBarAtBottom = false, messageNavEnabled = true, side = 'right', scrollToBottomSignal = 0, sendPerfMetricsRef = null, editingTargetMessageId = '' }) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const scrollerElementRef = useRef(null)
  const followIntentRef = useRef(true)
  const scrollAnimationFrameRef = useRef(0)
  const lastContainerHeightRef = useRef(0)
  const lastTouchClientYRef = useRef(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [highlightedEntryKey, setHighlightedEntryKey] = useState('')
  const [hoveredNavIndex, setHoveredNavIndex] = useState(-1)
  const isLeftSide = side !== 'left'
  const groupedMessages = useMemo(() => groupConversationMessages(messages), [messages])
  const lastAssistantTurnIndex = useMemo(() => getLastAssistantTurnIndex(groupedMessages), [groupedMessages])
  const firstUserMessageIndex = useMemo(() => groupedMessages.findIndex((entry) => entry?.type === 'user'), [groupedMessages])
  const userMessageEntries = useMemo(() => {
    const result = []
    groupedMessages.forEach((entry, idx) => {
      if (entry?.type === 'user' && entry.message) {
        result.push({ entry, index: idx })
      }
    })
    return result
  }, [groupedMessages])

  const suspendFollow = useCallback(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || scroller.scrollHeight <= scroller.clientHeight + 1) {
      return
    }
    followIntentRef.current = false
    setShowScrollToBottom(true)
  }, [])

  const handleJumpToUserMessage = useCallback((targetIndex, entry) => {
    followIntentRef.current = false
    setShowScrollToBottom(true)
    if (typeof virtuosoRef.current?.scrollToIndex === 'function') {
      // ponytail: auto(瞬跳)而非smooth, Virtuoso对未渲染的远端item只能按均高估算,
      // smooth会停在估算位置需要多点几次; auto能快速多次修正到准确位置
      virtuosoRef.current.scrollToIndex({
        index: targetIndex,
        align: 'center',
        behavior: 'auto',
      })
    }
    setHighlightedEntryKey(getEntryKey(entry, targetIndex))
  }, [])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (groupedMessages.length === 0) {
      return
    }
    if (typeof virtuosoRef.current?.scrollToIndex === 'function') {
      virtuosoRef.current.scrollToIndex({
        index: groupedMessages.length - 1,
        align: 'end',
        behavior,
      })
      return
    }
    const scroller = scrollerElementRef.current
    if (scroller instanceof HTMLElement) {
      if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior })
      } else {
        scroller.scrollTop = scroller.scrollHeight
      }
      return
    }
    virtuosoRef.current?.scrollTo?.({
      top: Number.MAX_SAFE_INTEGER,
      behavior,
    })
  }, [groupedMessages.length])

  const scheduleScrollToBottom = useCallback((behavior = 'auto', force = false) => {
    if (groupedMessages.length === 0) {
      return
    }
    if (!force && !followIntentRef.current) {
      return
    }
    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current)
    }
    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      scrollAnimationFrameRef.current = 0
      scrollToBottom(behavior)
    })
  }, [groupedMessages.length, scrollToBottom])

  useEffect(() => {
    if (groupedMessages.length === 0) {
      followIntentRef.current = true
      lastContainerHeightRef.current = 0
      setShowScrollToBottom(false)
      return
    }
    scheduleScrollToBottom('auto')
  }, [groupedMessages, scheduleScrollToBottom])

  useEffect(() => {
    if (groupedMessages.length === 0) {
      return
    }
    followIntentRef.current = true
    setShowScrollToBottom(false)
    scheduleScrollToBottom('auto', true)
  }, [conversationId, scheduleScrollToBottom])

  useEffect(() => {
    if (!scrollToBottomSignal || groupedMessages.length === 0) {
      return
    }
    followIntentRef.current = true
    setShowScrollToBottom(false)
    scheduleScrollToBottom('smooth', true)
  }, [groupedMessages.length, scheduleScrollToBottom, scrollToBottomSignal])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver !== 'function') {
      return undefined
    }
    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect?.height || 0
      if (!nextHeight) {
        return
      }
      if (!lastContainerHeightRef.current) {
        lastContainerHeightRef.current = nextHeight
        return
      }
      if (Math.abs(nextHeight - lastContainerHeightRef.current) < 1) {
        return
      }
      lastContainerHeightRef.current = nextHeight
      scheduleScrollToBottom('auto')
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [scheduleScrollToBottom])

  useEffect(() => {
    return () => {
      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!highlightedEntryKey) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setHighlightedEntryKey('')
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [highlightedEntryKey])

  useEffect(() => {
    const handleLocateConversationDiffItem = (event) => {
      const targetSessionId = typeof event?.detail?.sessionId === 'string' ? event.detail.sessionId.trim() : ''
      const targetTerminalId = typeof event?.detail?.terminalId === 'string' ? event.detail.terminalId.trim() : ''
      const targetMessageId = typeof event?.detail?.messageId === 'string' ? event.detail.messageId.trim() : ''
      if (!targetMessageId) {
        return
      }
      if (targetSessionId && targetSessionId !== sessionId) {
        return
      }
      if (targetTerminalId && targetTerminalId !== terminalId) {
        return
      }

      const targetIndex = groupedMessages.findIndex((entry) => {
        if (!entry || typeof entry !== 'object') {
          return false
        }
        if (entry.type === 'assistant-turn') {
          if (entry.assistant?.id === targetMessageId || entry.turnId === targetMessageId) {
            return true
          }
          return Array.isArray(entry.tools) && entry.tools.some((tool) => tool?.id === targetMessageId)
        }
        if (entry.type === 'user' || entry.type === 'reasoning' || entry.type === 'context-condense') {
          return entry.message?.id === targetMessageId
        }
        if (entry.type === 'tool-session') {
          return Array.isArray(entry.tools) && entry.tools.some((tool) => tool?.id === targetMessageId)
        }
        return false
      })

      if (targetIndex < 0) {
        return
      }

      const targetEntry = groupedMessages[targetIndex]
      const targetEntryKey = getEntryKey(targetEntry, targetIndex)
      suspendFollow()
      if (typeof virtuosoRef.current?.scrollToIndex === 'function') {
        virtuosoRef.current.scrollToIndex({
          index: targetIndex,
          align: 'center',
          behavior: 'smooth',
        })
      } else {
        virtuosoRef.current?.scrollTo?.({
          top: Number.MAX_SAFE_INTEGER,
          behavior: 'smooth',
        })
      }
      setHighlightedEntryKey(targetEntryKey)
    }

    window.addEventListener('ai-conversation-diff-locate', handleLocateConversationDiffItem)
    return () => {
      window.removeEventListener('ai-conversation-diff-locate', handleLocateConversationDiffItem)
    }
  }, [groupedMessages, sessionId, suspendFollow, terminalId])

  const handleScrollToBottom = useCallback(() => {
    followIntentRef.current = true
    setShowScrollToBottom(false)
    scrollToBottom('smooth')
  }, [scrollToBottom])

  const handleUserWheelCapture = useCallback((event) => {
    const deltaY = Number(event?.deltaY) || 0
    if (deltaY >= -1) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return
    }
    suspendFollow()
  }, [suspendFollow])

  const handleUserTouchStartCapture = useCallback((event) => {
    lastTouchClientYRef.current = getTouchClientY(event)
  }, [])

  const handleUserTouchMoveCapture = useCallback((event) => {
    const nextTouchClientY = getTouchClientY(event)
    const previousTouchClientY = lastTouchClientYRef.current
    lastTouchClientYRef.current = nextTouchClientY
    if (nextTouchClientY === null || previousTouchClientY === null) {
      return
    }
    const deltaY = previousTouchClientY - nextTouchClientY
    if (deltaY >= -1) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return
    }
    suspendFollow()
  }, [suspendFollow])

  const handleUserTouchEndCapture = useCallback(() => {
    lastTouchClientYRef.current = null
  }, [])

  const handlePointerDownCapture = useCallback((event) => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || event?.target !== scroller) {
      return
    }
    const rect = scroller.getBoundingClientRect()
    const scrollbarWidth = Math.max(scroller.offsetWidth - scroller.clientWidth, 12)
    if (Number(event?.clientX) >= rect.right - scrollbarWidth) {
      suspendFollow()
    }
  }, [suspendFollow])

  const handleKeyDownCapture = useCallback((event) => {
    if (!['ArrowUp', 'PageUp', 'Home'].includes(event?.key)) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, -1)) {
      return
    }
    suspendFollow()
  }, [suspendFollow])

  if (groupedMessages.length === 0) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 20 }}>
        <div style={{ maxWidth: 260, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.8 }}>
          {t('选择供应商并发送消息后，AI会在这里按真实流式顺序输出内容。')}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onWheelCapture={handleUserWheelCapture}
      onTouchStartCapture={handleUserTouchStartCapture}
      onTouchMoveCapture={handleUserTouchMoveCapture}
      onTouchEndCapture={handleUserTouchEndCapture}
      onTouchCancelCapture={handleUserTouchEndCapture}
      onPointerDownCapture={handlePointerDownCapture}
      onKeyDownCapture={handleKeyDownCapture}
      style={{ flex: 1, minHeight: 0, height: '100%', background: 'transparent', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes ai-chat-message-flash {
          0%, 100% { background: rgba(var(--accent-rgb), 0.06); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.12); }
          50% { background: rgba(var(--accent-rgb), 0.22); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.42), 0 0 24px rgba(var(--accent-rgb), 0.24); }
        }
        @keyframes ai-chat-msg-enter-left {
          from {
            opacity: 0;
            transform: translateX(-88px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes ai-chat-msg-enter-right {
          from {
            opacity: 0;
            transform: translateX(88px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes ai-chat-message-breathe-border {
          0%, 100% {
            background: rgba(var(--accent-rgb), 0.04);
            border-color: rgba(var(--accent-rgb), 0.14);
            box-shadow: inset 0 1px 0 var(--border-light), inset 0 0 0 1px rgba(var(--accent-rgb), 0.08), inset 0 0 10px rgba(var(--accent-rgb), 0.04);
            filter: brightness(1) saturate(1);
          }
          50% {
            background: rgba(var(--accent-rgb), 0.18);
            border-color: rgba(var(--accent-rgb), 0.82);
            box-shadow: inset 0 1px 0 rgba(var(--accent-rgb), 0.28), inset 0 0 0 1px rgba(var(--accent-rgb), 0.44), inset 0 0 24px rgba(var(--accent-rgb), 0.16);
            filter: brightness(1.14) saturate(1.3);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes ai-chat-msg-enter-left {
            from { opacity: 0; transform: translateX(-6px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes ai-chat-msg-enter-right {
            from { opacity: 0; transform: translateX(6px); }
            to { opacity: 1; transform: translateX(0); }
          }
        }
      `}</style>
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={(element) => {
          scrollerElementRef.current = element instanceof HTMLElement ? element : null
          if (element instanceof HTMLElement) {
            element.style.overflowX = 'hidden'
            // ponytail: 面板在左侧时, direction: rtl 把滚动条翻到左侧(远离终端), 内容保持 LTR
            element.style.direction = isLeftSide ? 'rtl' : 'ltr'
          }
        }}
        style={{ height: '100%', overflowX: 'hidden' }}
        data={groupedMessages}
        alignToBottom={false}
        increaseViewportBy={{ top: 1200, bottom: 800 }}
        initialTopMostItemIndex={{ index: Math.max(groupedMessages.length - 1, 0), align: 'end' }}
        atBottomThreshold={70}
        followOutput={(isAtBottom) => (isAtBottom || followIntentRef.current ? 'auto' : false)}
        atBottomStateChange={(isAtBottom) => {
          if (isAtBottom) {
            followIntentRef.current = true
            setShowScrollToBottom(false)
            return
          }
          setShowScrollToBottom(!followIntentRef.current)
        }}
        computeItemKey={(index, entry) => getEntryKey(entry, index)}
        itemContent={(index, entry) => {
          const entryKey = getEntryKey(entry, index)
          const isHighlighted = highlightedEntryKey === entryKey
          const entryAnimName = getAIChatMessageEntryAnimationName(entry)
          const isEditingTargetEntry = entry?.type === 'user' && typeof entry?.message?.id === 'string' && entry.message.id.trim() && entry.message.id.trim() === editingTargetMessageId
          return (
            <div
              style={{
                padding: `0 14px ${index === groupedMessages.length - 1 ? 18 : 14}px`,
                borderRadius: 14,
                direction: 'ltr',
                animation: isHighlighted
                  ? 'ai-chat-message-flash 0.72s ease-in-out 4'
                  : `${entryAnimName} 1500ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                background: isHighlighted ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
                transition: 'background 180ms ease, box-shadow 180ms ease',
              }}>
              {renderGroupedEntry(entry, {
                onSendUserMessage,
                onRetryUserMessage,
                onRetryAssistantMessage,
                onEditUserMessage,
                onDeleteMessage,
                onPreviewRestore,
                onPreviewDiffFetch,
                onApplyRestore,
                followupInteractionLocked,
                messageActionBarAtBottom,
                sendPerfMetricsRef,
                isEditingTarget: isEditingTargetEntry,
              }, {
                isLastAssistantTurn: index === lastAssistantTurnIndex,
                hasSubsequentAssistantMessage: hasSubsequentAssistantTurn(groupedMessages, index),
                isFirstUserMessage: index === firstUserMessageIndex,
              })}
            </div>
          )
        }}
      />
      {userMessageEntries.length >= 1 && messageNavEnabled ? (
        <div style={{
          position: 'absolute',
          [isLeftSide ? 'right' : 'left']: 3,
          top: 14,
          bottom: 44,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 5,
          zIndex: 8,
        }}>
          {userMessageEntries.map(({ entry, index }, navIndex) => {
            const navText = typeof entry.message?.text === 'string' ? entry.message.text.trim() : ''
            const navTime = typeof entry.message?.time === 'string' ? entry.message.time : ''
            const navPreview = navText.length > 60 ? navText.slice(0, 60) + '…' : navText
            const isNavHovered = hoveredNavIndex === navIndex
            return (
              <div
                key={entry.message?.id || `nav-${navIndex}`}
                style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
                onMouseEnter={() => setHoveredNavIndex(navIndex)}
                onMouseLeave={() => setHoveredNavIndex(-1)}
              >
                <button
                  type="button"
                  onClick={() => handleJumpToUserMessage(index, entry)}
                  aria-label={navPreview || '图片消息'}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: isNavHovered ? 'var(--accent)' : 'var(--surface-overlay)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 150ms ease, background 150ms ease, border-color 150ms ease',
                    transform: isNavHovered ? 'scale(1.4)' : 'scale(1)',
                  }}
                />
                {isNavHovered ? (
                  <div style={{
                    position: 'absolute',
                    [isLeftSide ? 'right' : 'left']: '100%',
                    [isLeftSide ? 'marginRight' : 'marginLeft']: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 'max-content',
                    maxWidth: 240,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(30, 35, 42, 0.96)',
                    color: '#fff',
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    boxShadow: 'var(--shadow-lg)',
                    pointerEvents: 'none',
                    zIndex: 100,
                  }}>
                    {navTime ? <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 3 }}>{navTime}</div> : null}
                    {navPreview || '📷 图片消息'}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {showScrollToBottom ? (
        <div
          style={{
            position: 'absolute',
            right: 14,
            bottom: 10,
            zIndex: 10,
            pointerEvents: 'none',
          }}>
          <button
            type="button"
            onClick={handleScrollToBottom}
            style={{
              height: 32,
              minWidth: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface-overlay)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-lg)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'var(--transition)',
            }}>
            <ChevronDown size={14} />
          </button>
        </div>
      ) : null}
    </div>
  )
}