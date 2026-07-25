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
      return <AIChatToolSessionPane items={entry.tools} onSendUserMessage={handlers.onSendUserMessage} onPreviewRestore={handlers.onPreviewRestore} onApplyRestore={handlers.onApplyRestore} followupInteractionLocked={Boolean(handlers.followupInteractionLocked)} />
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

// 按服务器/终端/对话记住滚动位置（面板 visibility 保活，切回来要原样恢复）
const conversationScrollMemoryByPanel = new Map()

function getAIScrollScrollerMetrics(scroller) {
  if (!(scroller instanceof HTMLElement)) {
    return { hasScroller: false }
  }
  const scrollHeight = scroller.scrollHeight
  const clientHeight = scroller.clientHeight
  const scrollTop = scroller.scrollTop
  const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
  const distanceToBottom = maxScrollTop - scrollTop
  return {
    hasScroller: true,
    scrollHeight,
    clientHeight,
    scrollTop,
    maxScrollTop,
    distanceToBottom,
    nearBottom: distanceToBottom <= 24,
  }
}

function getConversationScrollMemoryKey(sessionId, terminalId, conversationId) {
  return `${sessionId || 'session'}::${terminalId || 'terminal'}::${conversationId || 'conversation'}`
}

function readConversationScrollMemory(sessionId, terminalId, conversationId) {
  return conversationScrollMemoryByPanel.get(getConversationScrollMemoryKey(sessionId, terminalId, conversationId)) || null
}

function writeConversationScrollMemory(sessionId, terminalId, conversationId, snapshot) {
  if (!snapshot) {
    return
  }
  conversationScrollMemoryByPanel.set(getConversationScrollMemoryKey(sessionId, terminalId, conversationId), snapshot)
}

export default function AIChatConversation({ messages = [], sessionId = '', terminalId = '', conversationId = '', onSendUserMessage, onRetryUserMessage, onRetryAssistantMessage, onEditUserMessage, onDeleteMessage, onPreviewRestore, onApplyRestore, followupInteractionLocked = false, messageActionBarAtBottom = false, scrollToBottomSignal = 0, sendPerfMetricsRef = null }) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const scrollerElementRef = useRef(null)
  const followIntentRef = useRef(true)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollResetRef = useRef(0)
  const scrollAnimationFrameRef = useRef(0)
  const pinBottomFrameRef = useRef(0)
  const settleFollowTimerRef = useRef(0)
  const holdBottomFrameRef = useRef(0)
  const holdBottomStartedAtRef = useRef(0)
  const holdBottomMaxDurationRef = useRef(0)
  const rememberFrameRef = useRef(0)
  const restoringRef = useRef(false)
  const hasHydratedRef = useRef(false)
  const lastContainerHeightRef = useRef(0)
  const lastUserScrollIntentAtRef = useRef(0)
  const lastUserScrollDirectionRef = useRef(0)
  const lastTouchClientYRef = useRef(null)
  const forceMeasureLastEntryRef = useRef(0)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [highlightedEntryKey, setHighlightedEntryKey] = useState('')
  const [scrollerVersion, setScrollerVersion] = useState(0)
  const groupedMessages = useMemo(() => groupConversationMessages(messages), [messages])
  const lastAssistantTurnIndex = useMemo(() => getLastAssistantTurnIndex(groupedMessages), [groupedMessages])
  const lastEntryIndex = Math.max(groupedMessages.length - 1, 0)
  const conversationScrollKey = getConversationScrollMemoryKey(sessionId, terminalId, conversationId)

  const cancelPinBottomLoop = useCallback(() => {
    if (pinBottomFrameRef.current) {
      cancelAnimationFrame(pinBottomFrameRef.current)
      pinBottomFrameRef.current = 0
    }
  }, [])

  const cancelSettleFollow = useCallback(() => {
    if (settleFollowTimerRef.current) {
      window.clearInterval(settleFollowTimerRef.current)
      settleFollowTimerRef.current = 0
    }
  }, [])

  const cancelHoldBottom = useCallback(() => {
    if (holdBottomFrameRef.current) {
      cancelAnimationFrame(holdBottomFrameRef.current)
      holdBottomFrameRef.current = 0
    }
    holdBottomStartedAtRef.current = 0
    holdBottomMaxDurationRef.current = 0
  }, [])

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = true
    if (programmaticScrollResetRef.current) {
      window.clearTimeout(programmaticScrollResetRef.current)
    }
    programmaticScrollResetRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false
      programmaticScrollResetRef.current = 0
    }, 80)
  }, [])

  const hasRecentUserScrollIntent = useCallback(() => Date.now() - lastUserScrollIntentAtRef.current < 1200, [])

  const captureScrollPosition = useCallback(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return null
    }
    const maxScrollTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    const scrollTop = Math.max(0, Math.min(scroller.scrollTop, maxScrollTop))
    const distanceToBottom = maxScrollTop - scrollTop
    return {
      scrollTop,
      maxScrollTop,
      stickToBottom: distanceToBottom <= 24,
    }
  }, [])

  const rememberCurrentScrollPosition = useCallback(() => {
    if (restoringRef.current || programmaticScrollRef.current) {
      return
    }
    const snapshot = captureScrollPosition()
    if (!snapshot) {
      return
    }
    writeConversationScrollMemory(sessionId, terminalId, conversationId, snapshot)
  }, [captureScrollPosition, conversationId, sessionId, terminalId])

  const scheduleRememberScrollPosition = useCallback(() => {
    if (rememberFrameRef.current) {
      cancelAnimationFrame(rememberFrameRef.current)
    }
    rememberFrameRef.current = requestAnimationFrame(() => {
      rememberFrameRef.current = 0
      rememberCurrentScrollPosition()
    })
  }, [rememberCurrentScrollPosition])

  const pinScrollerToTrueBottom = useCallback((options = {}) => {
    const silent = Boolean(options.silent)
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return false
    }
    const nextTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    if (Math.abs(scroller.scrollTop - nextTop) <= 1) {
      return true
    }
    if (!silent) {
      markProgrammaticScroll()
    }
    scroller.scrollTop = nextTop
    return true
  }, [markProgrammaticScroll])

  const startHoldBottom = useCallback((reason = 'hold', durationMs = 900) => {
    const nextDuration = Math.max(Number(durationMs) || 0, 200)
    if (holdBottomFrameRef.current) {
      holdBottomStartedAtRef.current = Date.now()
      holdBottomMaxDurationRef.current = Math.max(holdBottomMaxDurationRef.current, nextDuration)
      return
    }
    holdBottomStartedAtRef.current = Date.now()
    holdBottomMaxDurationRef.current = nextDuration
    const tick = () => {
      holdBottomFrameRef.current = 0
      if (!followIntentRef.current || restoringRef.current) {
        return
      }
      if (Date.now() - holdBottomStartedAtRef.current >= holdBottomMaxDurationRef.current) {
        pinScrollerToTrueBottom({ silent: true })
        return
      }
      pinScrollerToTrueBottom({ silent: true })
      holdBottomFrameRef.current = requestAnimationFrame(tick)
    }
    holdBottomFrameRef.current = requestAnimationFrame(tick)
  }, [pinScrollerToTrueBottom])

  const markUserScrollIntent = useCallback((direction = 0) => {
    lastUserScrollIntentAtRef.current = Date.now()
    lastUserScrollDirectionRef.current = direction
    const metrics = getAIScrollScrollerMetrics(scrollerElementRef.current)
    if (direction < 0) {
      followIntentRef.current = false
      cancelPinBottomLoop()
      cancelSettleFollow()
      cancelHoldBottom()
      setShowScrollToBottom(true)
      return
    }
    if (direction > 0 && metrics.hasScroller && metrics.distanceToBottom <= 200) {
      followIntentRef.current = true
      setShowScrollToBottom(false)
      pinScrollerToTrueBottom()
      startHoldBottom('user_resume', 700)
    }
  }, [cancelHoldBottom, cancelPinBottomLoop, cancelSettleFollow, pinScrollerToTrueBottom, startHoldBottom])

  const startSettleFollow = useCallback((durationMs = 1800, reason = 'settle') => {
    cancelSettleFollow()
    const startedAt = Date.now()
    startHoldBottom(reason, durationMs + 200)
    settleFollowTimerRef.current = window.setInterval(() => {
      if (!followIntentRef.current || restoringRef.current) {
        cancelSettleFollow()
        return
      }
      if (Date.now() - startedAt >= durationMs) {
        cancelSettleFollow()
        pinScrollerToTrueBottom({ silent: true })
        return
      }
      const metrics = getAIScrollScrollerMetrics(scrollerElementRef.current)
      if (!metrics.hasScroller) {
        return
      }
      if (metrics.distanceToBottom > 2) {
        pinScrollerToTrueBottom({ silent: true })
        if (metrics.distanceToBottom > 48) {
          startHoldBottom('settle_repin', Math.max(durationMs - (Date.now() - startedAt), 400))
        }
      }
    }, 32)
  }, [cancelSettleFollow, pinScrollerToTrueBottom, startHoldBottom])

  const forceLastEntryIntoView = useCallback(() => {
    if (typeof virtuosoRef.current?.scrollToIndex !== 'function') {
      return false
    }
    const now = Date.now()
    if (now - forceMeasureLastEntryRef.current < 400) {
      return false
    }
    forceMeasureLastEntryRef.current = now
    markProgrammaticScroll()
    virtuosoRef.current.scrollToIndex({
      index: lastEntryIndex,
      align: 'end',
      behavior: 'auto',
    })
    return true
  }, [lastEntryIndex, markProgrammaticScroll])

  const startPinBottomUntilStable = useCallback((maxFrames = 48, reason = 'pin') => {
    if (groupedMessages.length === 0) {
      return
    }
    if (pinBottomFrameRef.current) {
      followIntentRef.current = true
      pinScrollerToTrueBottom()
      return
    }
    cancelPinBottomLoop()
    followIntentRef.current = true
    lastUserScrollIntentAtRef.current = 0
    setShowScrollToBottom(false)

    const startMetrics = getAIScrollScrollerMetrics(scrollerElementRef.current)
    if (!startMetrics.hasScroller || startMetrics.maxScrollTop <= 1 || startMetrics.distanceToBottom > 48) {
      forceLastEntryIntoView()
    }
    startHoldBottom(reason, Math.max(maxFrames * 20, 900))

    let frames = 0
    let nearBottomFrames = 0
    let maxSeenHeight = 0
    let stableHeightFrames = 0
    let previousHeight = -1
    const expectScrollable = groupedMessages.length >= 4

    const finishPin = (scroller) => {
      pinScrollerToTrueBottom()
      const live = scroller instanceof HTMLElement ? scroller : scrollerElementRef.current
      const maxScrollTop = Math.max((live?.scrollHeight || 0) - (live?.clientHeight || 0), 0)
      writeConversationScrollMemory(sessionId, terminalId, conversationId, {
        scrollTop: maxScrollTop,
        maxScrollTop,
        stickToBottom: true,
      })
      setShowScrollToBottom(false)
      if (followIntentRef.current) {
        startSettleFollow(reason === 'hydrate_open' || reason === 'scroller_ready' ? 2200 : 1600, 'pin_stable')
      }
    }

    const tick = () => {
      pinBottomFrameRef.current = 0
      if (!followIntentRef.current) {
        return
      }
      const scroller = scrollerElementRef.current
      pinScrollerToTrueBottom()
      frames += 1
      if (scroller instanceof HTMLElement) {
        const height = scroller.scrollHeight
        const clientHeight = scroller.clientHeight
        const maxScrollTop = Math.max(height - clientHeight, 0)
        const distance = maxScrollTop - scroller.scrollTop
        if (height > maxSeenHeight) {
          maxSeenHeight = height
        }
        if (previousHeight > 0 && Math.abs(height - previousHeight) > 24) {
          stableHeightFrames = 0
        } else if (maxScrollTop > 1) {
          stableHeightFrames += 1
        } else {
          stableHeightFrames = 0
        }
        previousHeight = height

        if (maxScrollTop <= 1) {
          nearBottomFrames = 0
          if ((expectScrollable || frames <= 12) && (frames === 1 || frames % 6 === 0)) {
            forceLastEntryIntoView()
          }
        } else if (distance <= 2) {
          nearBottomFrames += 1
        } else {
          nearBottomFrames = 0
        }

        const nearPeak = maxSeenHeight <= 0 || height >= maxSeenHeight * 0.92
        const contentReady = (
          (maxScrollTop > 1 && nearPeak && stableHeightFrames >= 4)
          || (!expectScrollable && height > 0 && height <= clientHeight + 1 && frames >= 6)
        )
        if (frames >= 12 && nearBottomFrames >= 6 && contentReady) {
          finishPin(scroller)
          return
        }
      }
      if (frames >= maxFrames) {
        finishPin(scroller)
        return
      }
      pinBottomFrameRef.current = requestAnimationFrame(tick)
    }
    pinBottomFrameRef.current = requestAnimationFrame(tick)
  }, [cancelPinBottomLoop, conversationId, forceLastEntryIntoView, groupedMessages.length, pinScrollerToTrueBottom, sessionId, startHoldBottom, startSettleFollow, terminalId])

  const restoreRememberedScroll = useCallback(() => {
    const snapshot = readConversationScrollMemory(sessionId, terminalId, conversationId)
    const scroller = scrollerElementRef.current
    if (!snapshot || !(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return false
    }
    if (snapshot.stickToBottom) {
      startPinBottomUntilStable(28, 'restore_stick')
      return true
    }
    restoringRef.current = true
    markProgrammaticScroll()
    followIntentRef.current = false
    cancelHoldBottom()
    cancelSettleFollow()
    cancelPinBottomLoop()
    const maxScrollTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    const nextTop = Math.max(0, Math.min(Number(snapshot.scrollTop) || 0, maxScrollTop))
    scroller.scrollTop = nextTop
    setShowScrollToBottom(maxScrollTop - nextTop > 24)
    window.requestAnimationFrame(() => {
      const live = scrollerElementRef.current
      if (live instanceof HTMLElement) {
        const liveMax = Math.max(live.scrollHeight - live.clientHeight, 0)
        live.scrollTop = Math.max(0, Math.min(Number(snapshot.scrollTop) || 0, liveMax))
      }
      restoringRef.current = false
    })
    return true
  }, [cancelHoldBottom, cancelPinBottomLoop, cancelSettleFollow, conversationId, markProgrammaticScroll, sessionId, startPinBottomUntilStable, terminalId])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (groupedMessages.length === 0) {
      return
    }
    startPinBottomUntilStable(behavior === 'smooth' ? 56 : 40, behavior === 'smooth' ? 'scroll_smooth' : 'scroll_auto')
  }, [groupedMessages.length, startPinBottomUntilStable])

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
    hasHydratedRef.current = false
    followIntentRef.current = true
    programmaticScrollRef.current = false
    restoringRef.current = false
    lastContainerHeightRef.current = 0
    lastUserScrollIntentAtRef.current = 0
    lastUserScrollDirectionRef.current = 0
    forceMeasureLastEntryRef.current = 0
    cancelPinBottomLoop()
    cancelSettleFollow()
    cancelHoldBottom()
    setShowScrollToBottom(false)
  }, [cancelHoldBottom, cancelPinBottomLoop, cancelSettleFollow, conversationScrollKey])

  useEffect(() => {
    if (groupedMessages.length === 0) {
      hasHydratedRef.current = false
      return undefined
    }
    if (hasHydratedRef.current) {
      return undefined
    }
    if (!(scrollerElementRef.current instanceof HTMLElement) || scrollerElementRef.current.clientHeight <= 1) {
      return undefined
    }

    hasHydratedRef.current = true
    const remembered = readConversationScrollMemory(sessionId, terminalId, conversationId)
    const timer = window.setTimeout(() => {
      if (remembered) {
        restoreRememberedScroll()
        return
      }
      followIntentRef.current = true
      startPinBottomUntilStable(56, 'hydrate_open')
      window.requestAnimationFrame(() => {
        if (followIntentRef.current) {
          pinScrollerToTrueBottom()
          scheduleRememberScrollPosition()
        }
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [conversationId, conversationScrollKey, groupedMessages.length, pinScrollerToTrueBottom, restoreRememberedScroll, scheduleRememberScrollPosition, scrollerVersion, sessionId, startPinBottomUntilStable, terminalId])

  useEffect(() => {
    if (!scrollToBottomSignal || groupedMessages.length === 0) {
      return
    }
    followIntentRef.current = true
    lastUserScrollIntentAtRef.current = 0
    setShowScrollToBottom(false)
    scheduleScrollToBottom('smooth', true)
    window.requestAnimationFrame(() => {
      scheduleRememberScrollPosition()
    })
  }, [groupedMessages.length, scheduleRememberScrollPosition, scheduleScrollToBottom, scrollToBottomSignal])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver !== 'function') {
      return undefined
    }
    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect?.height || 0
      const previousHeight = lastContainerHeightRef.current
      if (nextHeight <= 1) {
        lastContainerHeightRef.current = nextHeight
        return
      }
      if (!lastContainerHeightRef.current) {
        lastContainerHeightRef.current = nextHeight
        return
      }
      if (Math.abs(nextHeight - previousHeight) < 8) {
        return
      }
      lastContainerHeightRef.current = nextHeight
      if (followIntentRef.current) {
        scheduleScrollToBottom('auto')
      }
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [scheduleScrollToBottom])

  useEffect(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement)) {
      return undefined
    }
    let nearBottomRemeasureFrame = 0
    let heightFollowFrame = 0
    let lastScrollTop = scroller.scrollTop
    let lastScrollHeight = scroller.scrollHeight

    const handleScroll = () => {
      if (programmaticScrollRef.current || restoringRef.current) {
        lastScrollTop = scroller.scrollTop
        return
      }
      const prevTop = lastScrollTop
      const nextTop = scroller.scrollTop
      lastScrollTop = nextTop
      scheduleRememberScrollPosition()
      if (nextTop <= prevTop || lastUserScrollDirectionRef.current < 0) {
        return
      }
      const distance = scroller.scrollHeight - scroller.clientHeight - nextTop
      if (distance <= 160 && lastUserScrollDirectionRef.current > 0) {
        followIntentRef.current = true
        setShowScrollToBottom(false)
        startHoldBottom('scroll_near_bottom', 700)
        if (distance > 2 && !nearBottomRemeasureFrame) {
          nearBottomRemeasureFrame = requestAnimationFrame(() => {
            nearBottomRemeasureFrame = 0
            if (restoringRef.current || !followIntentRef.current || lastUserScrollDirectionRef.current < 0) {
              return
            }
            pinScrollerToTrueBottom()
          })
        }
      }
    }

    const handleScrollerHeightMaybeChanged = () => {
      if (!followIntentRef.current || restoringRef.current) {
        lastScrollHeight = scroller.scrollHeight
        return
      }
      if (programmaticScrollRef.current) {
        return
      }
      const nextHeight = scroller.scrollHeight
      if (nextHeight === lastScrollHeight) {
        const stuck = getAIScrollScrollerMetrics(scroller)
        if (stuck.distanceToBottom > 24 && !heightFollowFrame) {
          heightFollowFrame = requestAnimationFrame(() => {
            heightFollowFrame = 0
            if (!followIntentRef.current || restoringRef.current || programmaticScrollRef.current) {
              return
            }
            pinScrollerToTrueBottom()
          })
        }
        return
      }
      const grew = nextHeight > lastScrollHeight
      lastScrollHeight = nextHeight
      if (heightFollowFrame) {
        return
      }
      heightFollowFrame = requestAnimationFrame(() => {
        heightFollowFrame = 0
        if (!followIntentRef.current || restoringRef.current) {
          return
        }
        const metrics = getAIScrollScrollerMetrics(scroller)
        if (!grew && metrics.distanceToBottom <= 24) {
          return
        }
        pinScrollerToTrueBottom()
        if (grew) {
          startHoldBottom('height_grow', 500)
        }
      })
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    let resizeObserver = null
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        handleScrollerHeightMaybeChanged()
      })
      resizeObserver.observe(scroller)
      if (scroller.firstElementChild instanceof HTMLElement) {
        resizeObserver.observe(scroller.firstElementChild)
      }
    }
    const heightPoll = window.setInterval(() => {
      handleScrollerHeightMaybeChanged()
    }, 200)
    scheduleRememberScrollPosition()
    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      if (nearBottomRemeasureFrame) {
        cancelAnimationFrame(nearBottomRemeasureFrame)
      }
      if (heightFollowFrame) {
        cancelAnimationFrame(heightFollowFrame)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      window.clearInterval(heightPoll)
    }
  }, [conversationId, groupedMessages.length, pinScrollerToTrueBottom, scheduleRememberScrollPosition, scrollerVersion, startHoldBottom])

  useEffect(() => {
    return () => {
      if (programmaticScrollResetRef.current) {
        window.clearTimeout(programmaticScrollResetRef.current)
      }
      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current)
      }
      if (rememberFrameRef.current) {
        cancelAnimationFrame(rememberFrameRef.current)
      }
      cancelPinBottomLoop()
      cancelSettleFollow()
      cancelHoldBottom()
    }
  }, [cancelHoldBottom, cancelPinBottomLoop, cancelSettleFollow])

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
      markProgrammaticScroll()
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
  }, [groupedMessages, markProgrammaticScroll, sessionId, terminalId])

  const handleScrollToBottom = useCallback(() => {
    followIntentRef.current = true
    lastUserScrollIntentAtRef.current = 0
    setShowScrollToBottom(false)
    startPinBottomUntilStable(56, 'button')
  }, [startPinBottomUntilStable])

  const handleUserWheelCapture = useCallback((event) => {
    const deltaY = Number(event?.deltaY) || 0
    if (Math.abs(deltaY) < 1) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return
    }
    markUserScrollIntent(deltaY < 0 ? -1 : 1)
  }, [markUserScrollIntent])

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
    if (Math.abs(deltaY) < 1) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return
    }
    markUserScrollIntent(deltaY < 0 ? -1 : 1)
  }, [markUserScrollIntent])

  const handleUserTouchEndCapture = useCallback(() => {
    lastTouchClientYRef.current = null
  }, [])

  // 必须稳定引用：内联 scrollerRef 每渲染都变 → cleanup(null) setState 死循环
  // 卸载传 null 时只清 ref，不 setState
  const handleScrollerRef = useCallback((element) => {
    const next = element instanceof HTMLElement ? element : null
    if (scrollerElementRef.current === next) {
      return
    }
    scrollerElementRef.current = next
    if (!next) {
      return
    }
    setScrollerVersion((current) => current + 1)
  }, [])

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
      style={{ flex: 1, minHeight: 0, height: '100%', background: 'transparent', position: 'relative' }}>
      <style>{`
        @keyframes ai-chat-message-flash {
          0%, 100% { background: rgba(var(--accent-rgb), 0.06); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.12); }
          50% { background: rgba(var(--accent-rgb), 0.22); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.42), 0 0 24px rgba(var(--accent-rgb), 0.24); }
        }
      `}</style>
      <Virtuoso
        key={conversationScrollKey}
        ref={virtuosoRef}
        scrollerRef={handleScrollerRef}
        style={{ height: '100%' }}
        data={groupedMessages}
        increaseViewportBy={{ top: 600, bottom: 900 }}
        initialTopMostItemIndex={{
          index: Math.max(groupedMessages.length - 1, 0),
          align: 'end',
        }}
        alignToBottom
        defaultItemHeight={96}
        atBottomThreshold={48}
        followOutput={(isAtBottom) => {
          if (hasRecentUserScrollIntent() && !followIntentRef.current) {
            return false
          }
          return isAtBottom || followIntentRef.current ? 'auto' : false
        }}
        totalListHeightChanged={() => {
          const metrics = getAIScrollScrollerMetrics(scrollerElementRef.current)
          if (restoringRef.current || !followIntentRef.current) {
            return
          }
          if (!metrics.hasScroller || metrics.maxScrollTop <= 1) {
            forceLastEntryIntoView()
          }
          pinScrollerToTrueBottom()
          startHoldBottom('height_changed', 600)
        }}
        atBottomStateChange={(isAtBottom) => {
          if (restoringRef.current) {
            return
          }
          if (isAtBottom) {
            if (followIntentRef.current || !hasRecentUserScrollIntent()) {
              followIntentRef.current = true
              programmaticScrollRef.current = false
              setShowScrollToBottom(false)
            }
          } else if (!programmaticScrollRef.current && !followIntentRef.current) {
            setShowScrollToBottom(true)
          }
          if (!programmaticScrollRef.current && !restoringRef.current) {
            scheduleRememberScrollPosition()
          }
        }}
        computeItemKey={(index, entry) => getEntryKey(entry, index)}
        components={{
          Footer: () => <div style={{ height: 8, flexShrink: 0 }} aria-hidden="true" />,
        }}
        itemContent={(index, entry) => {
          const entryKey = getEntryKey(entry, index)
          const isHighlighted = highlightedEntryKey === entryKey
          return (
            <div
              style={{
                padding: '0 14px 14px',
                borderRadius: 14,
                animation: isHighlighted ? 'ai-chat-message-flash 0.72s ease-in-out 4' : 'none',
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
                onApplyRestore,
                followupInteractionLocked,
                messageActionBarAtBottom,
                sendPerfMetricsRef,
              }, {
                isLastAssistantTurn: index === lastAssistantTurnIndex,
                hasSubsequentAssistantMessage: hasSubsequentAssistantTurn(groupedMessages, index),
              })}
            </div>
          )
        }}
      />
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
