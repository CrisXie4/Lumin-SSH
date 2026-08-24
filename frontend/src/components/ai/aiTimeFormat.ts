// AI 历史记录时间展示的纯格式化函数，从 AIPanel.tsx 抽出。
import { t as translate, getLanguage } from '../../i18n.ts'

export function formatMessageTime() {
  return new Date().toLocaleTimeString(getLanguage() || 'zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function padAIHistoryDateTimePart(value: unknown) {
  return String(value).padStart(2, '0')
}

export function formatAIHistoryDateTime(value: unknown) {
  const numericValue = Number(value)
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue)
    : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) {
    return String(value || '')
  }
  return `${date.getFullYear()}-${padAIHistoryDateTimePart(date.getMonth() + 1)}-${padAIHistoryDateTimePart(date.getDate())} ${padAIHistoryDateTimePart(date.getHours())}:${padAIHistoryDateTimePart(date.getMinutes())}:${padAIHistoryDateTimePart(date.getSeconds())}`
}

function formatAIHistoryRelativeTime(value: unknown, language: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return ''
  }
  const diffMs = numericValue - Date.now()
  const absDiffMs = Math.abs(diffMs)
  if (absDiffMs < 60 * 1000) {
    return translate('刚刚')
  }
  const divisions = [
    { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'minute', ms: 1000 * 60 },
  ]
  for (const division of divisions) {
    if (absDiffMs >= division.ms) {
      const unitValue = Math.round(diffMs / division.ms)
      return new Intl.RelativeTimeFormat(String(language || 'zh-CN'), { numeric: 'always' }).format(unitValue, division.unit as Intl.RelativeTimeFormatUnit)
    }
  }
  return translate('刚刚')
}

export function buildAIHistoryDisplayTimeParts(value: unknown, language: unknown) {
  const absoluteText = formatAIHistoryDateTime(value)
  const relativeText = formatAIHistoryRelativeTime(value, language)
  return {
    absoluteText,
    relativeText,
  }
}

export function buildAIConversationSummarySubtaskContinuePrompt(summaryText: unknown, language: unknown) {
  const trimmedSummaryText = typeof summaryText === 'string' ? summaryText.trim() : ''
  if (!trimmedSummaryText) {
    return ''
  }
  const normalizedLanguage = String(language || '').toLowerCase()
  const handoffInstruction = normalizedLanguage.startsWith('zh')
    ? '您是本次新的对接工程师,以上是交接文档!请继续工作,可能需要您先检查当前的基线工作进度确保交接内容属实'
    : 'You are the new handoff engineer for this task. The content above is the handoff document. Please continue the work, and you may need to first verify the current baseline progress to ensure the handoff is accurate.'
  return `${trimmedSummaryText}\n\n${handoffInstruction}`
}

export function getAIHistoryRelativeTimeToneStyle(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { color: 'var(--text-tertiary)', opacity: 0.5 }
  }
  const diffMs = Math.abs(Date.now() - numericValue)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  if (diffMs <= 5 * minuteMs) {
    return { color: 'var(--success)', opacity: 1 }
  }
  if (diffMs <= 10 * minuteMs) {
    return { color: 'var(--success)', opacity: 0.9 }
  }
  if (diffMs <= 30 * minuteMs) {
    return { color: 'var(--accent)', opacity: 1 }
  }
  if (diffMs <= hourMs) {
    return { color: 'var(--accent)', opacity: 0.9 }
  }
  if (diffMs <= 3 * hourMs) {
    return { color: 'var(--text-secondary)', opacity: 1 }
  }
  if (diffMs <= 6 * hourMs) {
    return { color: 'var(--text-secondary)', opacity: 0.9 }
  }
  if (diffMs <= 12 * hourMs) {
    return { color: 'var(--text-tertiary)', opacity: 0.8 }
  }
  if (diffMs <= 24 * hourMs) {
    return { color: 'var(--text-tertiary)', opacity: 0.7 }
  }
  return { color: 'var(--text-tertiary)', opacity: 0.5 }
}
