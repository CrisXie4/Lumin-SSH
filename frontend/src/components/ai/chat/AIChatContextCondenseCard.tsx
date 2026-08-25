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
    <div className="grid w-full gap-2.5 rounded-xl border border-line bg-overlay px-3.5 py-3">
      <div className="flex items-center justify-between gap-2.5">
        <div className="inline-flex min-w-0 items-center gap-2">
          <Scissors size={14} color="var(--accent)" />
          <span className="text-base font-bold text-primary">{title}</span>
        </div>
        {hasTokenMetrics ? (
          <span className="shrink-0 text-sm font-bold text-accent">
            {formatTokenValue(prevTokens)} → {formatTokenValue(newTokens)}
          </span>
        ) : null}
      </div>
      {sourceText ? (
        <div className="whitespace-pre-wrap text-sm leading-[1.5] [word-break:break-word] text-secondary">
          {sourceText}
        </div>
      ) : null}
      {summary ? (
        <div className="whitespace-pre-wrap text-sm leading-[1.7] [word-break:break-word] text-secondary">
          {summary}
        </div>
      ) : null}
    </div>
  )
}
