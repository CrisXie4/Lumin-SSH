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

// 按服务器/终端记住滚动位置（面板 visibility 保活，切回来要原样恢复）
const conversationScrollMemoryByPanel = new Map()

function getConversationScrollMemoryKey(sessionId, terminalId) {
  return `${sessionId || 'session'}::${terminalId || 'terminal'}`
}

function readConversationScrollMemory(sessionId, terminalId) {
  return conversationScrollMemoryByPanel.get(getConversationScrollMemoryKey(sessionId, terminalId)) || null
}

function writeConversationScrollMemory(sessionId, terminalId, snapshot) {
  if (!snapshot) {
    return
  }
  conversationScrollMemoryByPanel.set(getConversationScrollMemoryKey(sessionId, terminalId), snapshot)
}

export default function AIChatConversation({ messages = [], sessionId = '', terminalId = '', onSendUserMessage, onRetryUserMessage, onRetryAssistantMessage, onEditUserMessage, onDeleteMessage, onPreviewRestore, onApplyRestore, followupInteractionLocked = false, messageActionBarAtBottom = false, scrollToBottomSignal = 0, sendPerfMetricsRef = null }) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const virtuosoRef = useRef(null)
  const scrollerElementRef = useRef(null)
  const followIntentRef = useRef(true)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollResetRef = useRef(0)
  const scrollAnimationFrameRef = useRef(0)
  const pinBottomFrameRef = useRef(0)
  const rememberFrameRef = useRef(0)
  const restoringRef = useRef(false)
  const hasHydratedRef = useRef(false)
  const lastContainerHeightRef = useRef(0)
  const lastUserScrollIntentAtRef = useRef(0)
  const lastTouchClientYRef = useRef(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [highlightedEntryKey, setHighlightedEntryKey] = useState('')
  const [scrollerVersion, setScrollerVersion] = useState(0)
  const groupedMessages = useMemo(() => groupConversationMessages(messages), [messages])
  const lastAssistantTurnIndex = useMemo(() => getLastAssistantTurnIndex(groupedMessages), [groupedMessages])
  const lastEntryIndex = Math.max(groupedMessages.length - 1, 0)

  const cancelPinBottomLoop = useCallback(() => {
    if (pinBottomFrameRef.current) {
      cancelAnimationFrame(pinBottomFrameRef.current)
      pinBottomFrameRef.current = 0
    }
  }, [])

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = true
    if (programmaticScrollResetRef.current) {
      window.clearTimeout(programmaticScrollResetRef.current)
    }
    programmaticScrollResetRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false
      programmaticScrollResetRef.current = 0
    }, 480)
  }, [])

  const markUserScrollIntent = useCallback((direction = 0) => {
    lastUserScrollIntentAtRef.current = Date.now()
    // 用户主动滚：立刻停钉底/跟底，避免长对话被“假底部”弹回
    followIntentRef.current = false
    cancelPinBottomLoop()
    // 上滑时立刻露出回底按钮；下滑靠近底部时留给 atBottomStateChange 收敛
    if (direction < 0) {
      setShowScrollToBottom(true)
    }
  }, [cancelPinBottomLoop])

  const hasRecentUserScrollIntent = useCallback(() => Date.now() - lastUserScrollIntentAtRef.current < 1200, [])

  const captureScrollPosition = useCallback(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return null
    }
    const maxScrollTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    const scrollTop = Math.max(0, Math.min(scroller.scrollTop, maxScrollTop))
    const distanceToBottom = maxScrollTop - scrollTop
    // 只按真实离底距离判断贴底，避免 followIntent 把“停中间”记成贴底
    const stickToBottom = distanceToBottom <= 24
    return {
      scrollTop,
      maxScrollTop,
      stickToBottom,
    }
  }, [])

  // 可见时持续记忆；切走时高度已是 0，再采会失败
  const rememberCurrentScrollPosition = useCallback(() => {
    if (restoringRef.current || programmaticScrollRef.current) {
      return
    }
    const snapshot = captureScrollPosition()
    if (!snapshot) {
      return
    }
    writeConversationScrollMemory(sessionId, terminalId, snapshot)
  }, [captureScrollPosition, sessionId, terminalId])

  const scheduleRememberScrollPosition = useCallback(() => {
    if (rememberFrameRef.current) {
      cancelAnimationFrame(rememberFrameRef.current)
    }
    rememberFrameRef.current = requestAnimationFrame(() => {
      rememberFrameRef.current = 0
      rememberCurrentScrollPosition()
    })
  }, [rememberCurrentScrollPosition])

  // 对话多、气泡高度不一：只 scrollToIndex 经常停在“假底部”。
  // 先滚到最后一项触发测量，再多帧钉 scroller 真底部；高度一变就再 scrollToIndex 逼 Virtuoso 重测。
  const pinScrollerToTrueBottom = useCallback(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return false
    }
    markProgrammaticScroll()
    const nextTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    scroller.scrollTop = nextTop
    return true
  }, [markProgrammaticScroll])

  const startPinBottomUntilStable = useCallback((maxFrames = 48) => {
    if (groupedMessages.length === 0) {
      return
    }
    cancelPinBottomLoop()
    followIntentRef.current = true
    lastUserScrollIntentAtRef.current = 0
    setShowScrollToBottom(false)

    const scrollLastIntoView = () => {
      if (typeof virtuosoRef.current?.scrollToIndex !== 'function') {
        return
      }
      markProgrammaticScroll()
      virtuosoRef.current.scrollToIndex({
        index: lastEntryIndex,
        align: 'end',
        behavior: 'auto',
      })
    }

    // 先让虚拟列表渲染最后几项，再钉真底部
    scrollLastIntoView()

    let frames = 0
    let stableFrames = 0
    let lastHeight = -1
    const tick = () => {
      pinBottomFrameRef.current = 0
      // 用户上滑会清 followIntent；此处必须立刻停，否则长列表会弹回
      if (!followIntentRef.current) {
        return
      }
      const scroller = scrollerElementRef.current
      pinScrollerToTrueBottom()
      frames += 1
      if (scroller instanceof HTMLElement) {
        const height = scroller.scrollHeight
        if (height > 0 && height === lastHeight) {
          stableFrames += 1
        } else {
          // 总高度还在变：继续逼最后一项进视口，让未测量气泡补测
          if (height !== lastHeight && frames % 4 === 0) {
            scrollLastIntoView()
          }
          stableFrames = 0
          lastHeight = height
        }
        const distance = height - scroller.clientHeight - scroller.scrollTop
        if (stableFrames >= 4 && distance <= 2) {
          writeConversationScrollMemory(sessionId, terminalId, {
            scrollTop: Math.max(height - scroller.clientHeight, 0),
            maxScrollTop: Math.max(height - scroller.clientHeight, 0),
            stickToBottom: true,
          })
          setShowScrollToBottom(false)
          return
        }
      }
      if (frames >= maxFrames) {
        pinScrollerToTrueBottom()
        const live = scrollerElementRef.current
        writeConversationScrollMemory(sessionId, terminalId, {
          scrollTop: Math.max((live?.scrollHeight || 0) - (live?.clientHeight || 0), 0),
          maxScrollTop: Math.max((live?.scrollHeight || 0) - (live?.clientHeight || 0), 0),
          stickToBottom: true,
        })
        setShowScrollToBottom(false)
        return
      }
      pinBottomFrameRef.current = requestAnimationFrame(tick)
    }
    pinBottomFrameRef.current = requestAnimationFrame(tick)
  }, [cancelPinBottomLoop, groupedMessages.length, lastEntryIndex, markProgrammaticScroll, pinScrollerToTrueBottom, sessionId, terminalId])

  // 保活面板不 remount：只回写离开时的 scrollTop，避免高度重测导致往下漂
  const restoreRememberedScroll = useCallback(() => {
    const snapshot = readConversationScrollMemory(sessionId, terminalId)
    const scroller = scrollerElementRef.current
    if (!snapshot || !(scroller instanceof HTMLElement) || scroller.clientHeight <= 1) {
      return false
    }
    // 记忆是贴底：用真底部钉住，避免旧 scrollTop 在高度重测后够不着底
    if (snapshot.stickToBottom) {
      startPinBottomUntilStable(20)
      return true
    }
    restoringRef.current = true
    markProgrammaticScroll()
    followIntentRef.current = false
    const maxScrollTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
    const nextTop = Math.max(0, Math.min(Number(snapshot.scrollTop) || 0, maxScrollTop))
    scroller.scrollTop = nextTop
    setShowScrollToBottom(true)
    window.requestAnimationFrame(() => {
      const live = scrollerElementRef.current
      if (live instanceof HTMLElement) {
        const liveMax = Math.max(live.scrollHeight - live.clientHeight, 0)
        live.scrollTop = Math.max(0, Math.min(Number(snapshot.scrollTop) || 0, liveMax))
      }
      restoringRef.current = false
    })
    return true
  }, [markProgrammaticScroll, sessionId, startPinBottomUntilStable, terminalId])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (groupedMessages.length === 0) {
      return
    }
    // 长对话一律多帧钉真底部；smooth 只多等一帧开滚，避免停在假底部
    if (behavior === 'smooth') {
      startPinBottomUntilStable(56)
      return
    }
    startPinBottomUntilStable(40)
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

  // 首屏：无记忆才落底；有记忆恢复停留点（不 remount）
  useEffect(() => {
    if (groupedMessages.length === 0) {
      followIntentRef.current = true
      programmaticScrollRef.current = false
      hasHydratedRef.current = false
      lastContainerHeightRef.current = 0
      lastUserScrollIntentAtRef.current = 0
      setShowScrollToBottom(false)
      return undefined
    }
    if (hasHydratedRef.current) {
      return undefined
    }
    hasHydratedRef.current = true
    const remembered = readConversationScrollMemory(sessionId, terminalId)
    const timer = window.setTimeout(() => {
      if (remembered) {
        restoreRememberedScroll()
        return
      }
      followIntentRef.current = true
      scheduleScrollToBottom('auto', true)
      window.requestAnimationFrame(() => {
        scheduleScrollToBottom('auto', true)
        scheduleRememberScrollPosition()
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [groupedMessages.length, restoreRememberedScroll, scheduleRememberScrollPosition, scheduleScrollToBottom, sessionId, terminalId])

  // 发送/强制回底信号：用户主动要到底
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
      // 面板用 visibility 保活后，切服务器不再出现 0→有高度 的假“重新可见”。
      // 这里只处理真实尺寸变化，且仅贴底意图才跟底。
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

  // 挂上 scroller 后监听 scroll：记位置；仅“往下滚贴近底”时补测最后一项
  useEffect(() => {
    const scroller = scrollerElementRef.current
    if (!(scroller instanceof HTMLElement)) {
      return undefined
    }
    let nearBottomRemeasureFrame = 0
    let lastScrollTop = scroller.scrollTop
    const handleScroll = () => {
      if (programmaticScrollRef.current || restoringRef.current) {
        lastScrollTop = scroller.scrollTop
        return
      }
      const prevTop = lastScrollTop
      const nextTop = scroller.scrollTop
      lastScrollTop = nextTop
      scheduleRememberScrollPosition()
      // 上滑绝不补测，避免被 scrollToIndex(end) 弹回
      if (nextTop <= prevTop) {
        return
      }
      const distance = scroller.scrollHeight - scroller.clientHeight - nextTop
      if (distance > 120 || nearBottomRemeasureFrame || typeof virtuosoRef.current?.scrollToIndex !== 'function') {
        return
      }
      nearBottomRemeasureFrame = requestAnimationFrame(() => {
        nearBottomRemeasureFrame = 0
        if (programmaticScrollRef.current || restoringRef.current || !followIntentRef.current) {
          // 无贴底意图时只补测一次高度，不强制钉底，让用户继续往下拖
          if (!programmaticScrollRef.current && !restoringRef.current) {
            virtuosoRef.current?.scrollToIndex?.({
              index: lastEntryIndex,
              align: 'end',
              behavior: 'auto',
            })
          }
          return
        }
        markProgrammaticScroll()
        virtuosoRef.current.scrollToIndex({
          index: lastEntryIndex,
          align: 'end',
          behavior: 'auto',
        })
        pinScrollerToTrueBottom()
      })
    }
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    scheduleRememberScrollPosition()
    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      if (nearBottomRemeasureFrame) {
        cancelAnimationFrame(nearBottomRemeasureFrame)
      }
    }
  }, [groupedMessages.length, lastEntryIndex, markProgrammaticScroll, pinScrollerToTrueBottom, scheduleRememberScrollPosition, scrollerVersion])

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
    }
  }, [cancelPinBottomLoop])

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
    // 长对话优先多帧真底部；smooth 只作观感，随后仍会 pin
    startPinBottomUntilStable(56)
  }, [startPinBottomUntilStable])

  const handleUserWheelCapture = useCallback((event) => {
    const deltaY = Number(event?.deltaY) || 0
    if (Math.abs(deltaY) < 1) {
      return
    }
    if (shouldIgnoreConversationScrollIntentFromNestedScroller(event?.target, containerRef.current, deltaY)) {
      return
    }
    // deltaY>0 内容上移（看更下面）；deltaY<0 上滑看历史
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
    // 手指上滑（内容下移看历史）→ deltaY < 0
    markUserScrollIntent(deltaY < 0 ? -1 : 1)
  }, [markUserScrollIntent])

  const handleUserTouchEndCapture = useCallback(() => {
    lastTouchClientYRef.current = null
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
        key={`${sessionId || 'session'}:${terminalId || 'terminal'}`}
        ref={virtuosoRef}
        scrollerRef={(element) => {
          const next = element instanceof HTMLElement ? element : null
          if (scrollerElementRef.current === next) {
            return
          }
          scrollerElementRef.current = next
          // scrollerRef 不会触发重渲染，用 version 挂 scroll 监听
          setScrollerVersion((current) => current + 1)
        }}
        style={{ height: '100%' }}
        data={groupedMessages}
        // 长对话最后几条气泡很高：底部多预渲染，减少“假底部”
        increaseViewportBy={{ top: 900, bottom: 1600 }}
        // 首屏落最新气泡底部；切服务器保活后靠记忆 scrollTop 恢复，不 remount
        initialTopMostItemIndex={{
          index: Math.max(groupedMessages.length - 1, 0),
          align: 'end',
        }}
        alignToBottom
        atBottomThreshold={48}
        followOutput={(isAtBottom) => {
          // 用户刚滚过：绝不跟底，避免上滑被弹回
          if (hasRecentUserScrollIntent() && !followIntentRef.current) {
            return false
          }
          return isAtBottom || followIntentRef.current ? 'auto' : false
        }}
        // 同一条气泡往下长高时 followOutput 不一定跟；贴底则钉真底部，让操作栏跟着沉下来
        totalListHeightChanged={() => {
          if (restoringRef.current || !followIntentRef.current || hasRecentUserScrollIntent()) {
            return
          }
          pinScrollerToTrueBottom()
        }}
        atBottomStateChange={(isAtBottom) => {
          if (restoringRef.current) {
            return
          }
          if (isAtBottom) {
            // 仅在“仍要贴底”或没有用户上滑意图时才重新打开跟底
            if (followIntentRef.current || !hasRecentUserScrollIntent()) {
              followIntentRef.current = true
              programmaticScrollRef.current = false
              lastUserScrollIntentAtRef.current = 0
              setShowScrollToBottom(false)
            }
          } else if (!programmaticScrollRef.current) {
            if (hasRecentUserScrollIntent() || !followIntentRef.current) {
              followIntentRef.current = false
              setShowScrollToBottom(true)
            }
          }
          if (!programmaticScrollRef.current && !restoringRef.current) {
            scheduleRememberScrollPosition()
          }
        }}
        computeItemKey={(index, entry) => getEntryKey(entry, index)}
        // 末条只留一点呼吸，别叠 Footer+大 padding 空出一大截
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