import { Scissors } from 'lucide-react'
import { useTranslation, type I18nKey } from '../../../i18n.ts'

function formatTokenValue(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return ''
  }
  const rounded = Math.round(parsed)
  if (rounded >= 1e9) {
    return `${(rounded / 1e9).toFixed(2)}b`
  }
  if (rounded >= 1e6) {
    return `${(rounded / 1e6).toFixed(2)}m`
  }
  if (rounded >= 1e3) {
    return `${(rounded / 1e3).toFixed(2)}k`
  }
  return String(rounded)
}

function formatCondenseSummary(text: string, t: (key: I18nKey, vars?: Record<string, unknown>) => string) {
  const match = text.match(/^已压缩 (\d+) 个 工具调用结果,移除 (\d+) 个空白 assistant 消息,替换 (\d+) 个图片,移除 (\d+) 个 environment_details,压缩 (\d+) 个 file_content,压缩 (\d+) 个 terminal_output,压缩 (\d+) 个系统提示消息$/)
  if (!match) return text
  const [, toolResults, emptyAssistantMessages, images, environmentDetails, fileContent, terminalOutput, systemNotices] = match
  return t('上下文智能压缩摘要', {
    toolResults,
    emptyAssistantMessages,
    images,
    environmentDetails,
    fileContent,
    terminalOutput,
    systemNotices,
  })
}

interface AIChatContextCondenseCardProps {
  message?: {
    text?: string
    extra?: Record<string, unknown>
  }
}

export default function AIChatContextCondenseCard({ message }: AIChatContextCondenseCardProps) {
  const { t } = useTranslation()
  const isDerivedSubtask = message?.extra?.derivedSubtask === true
  const parentTitleSnapshot = typeof message?.extra?.parentTitleSnapshot === 'string' ? message.extra.parentTitleSnapshot.trim() : ''
  const rawSummary = typeof message?.text === 'string' ? message.text.trim() : ''
  const summary = rawSummary ? (isDerivedSubtask ? rawSummary : formatCondenseSummary(rawSummary, t)) : ''
  const prevTokens = Number(message?.extra?.prevContextTokens)
  const newTokens = Number(message?.extra?.newContextTokens)
  const hasTokenMetrics = Number.isFinite(prevTokens) && prevTokens >= 0 && Number.isFinite(newTokens) && newTokens >= 0
  const sourceText = isDerivedSubtask && parentTitleSnapshot ? t('继续自: {title}', { title: parentTitleSnapshot }) : ''
  const title = isDerivedSubtask ? t('已创建摘要子任务') : t('上下文已智能压缩')

  return (
    <div
      style={{
        width: '100%',
        display: 'grid',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-overlay)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Scissors size={14} color="var(--accent)" />
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{title}</span>
        </div>
        {hasTokenMetrics ? (
          <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>
            {formatTokenValue(prevTokens)} → {formatTokenValue(newTokens)}
          </span>
        ) : null}
      </div>
      {sourceText ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {sourceText}
        </div>
      ) : null}
      {summary ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {summary}
        </div>
      ) : null}
    </div>
  )
}
