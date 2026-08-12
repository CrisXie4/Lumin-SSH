import { CheckCircle2 } from 'lucide-react'
import { useTranslation, type I18nKey } from '../../../i18n.ts'
import AIChatMarkdown from './AIChatMarkdown.tsx'

const completionTitleKey = '任务完成'
const completionStatusKey = '已完成'

interface AIChatCompletionCardProps {
  title?: string
  summary?: string
  result?: string
  status?: string
}

function normalizeAICompletionStatus(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default function AIChatCompletionCard({ title = completionTitleKey, summary = '', result = '', status = completionStatusKey }: AIChatCompletionCardProps) {
  const { t } = useTranslation()
  const normalizedSummary = typeof summary === 'string' ? summary.trim() : ''
  const normalizedResult = typeof result === 'string' ? result.trim() : ''
  const normalizedStatus = normalizeAICompletionStatus(status)
  const statusPalette = normalizedStatus === completionStatusKey
    ? {
        border: '1px solid rgba(var(--success-rgb), 0.35)',
        background: 'rgba(var(--success-rgb), 0.08)',
        color: 'var(--success)',
      }
    : normalizedStatus === '等待处理'
      ? {
          border: '1px solid rgba(var(--warning-rgb), 0.35)',
          background: 'rgba(var(--warning-rgb), 0.08)',
          color: 'var(--warning)',
        }
      : {
          border: '1px solid rgba(var(--accent-rgb), 0.35)',
          background: 'rgba(var(--accent-rgb), 0.08)',
          color: 'var(--accent)',
        }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
        <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={14} color={normalizedStatus === completionStatusKey ? 'var(--success)' : 'var(--accent)'} />
          {/* title 为 AI 返回动态文案（可能不在翻译表），t() 内部有兜底 */}
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t(title as I18nKey)}</span>
        </div>
        {normalizedStatus ? (
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              ...statusPalette,
            }}>
            {/* 同 title：动态状态文案兜底 */}
            {t(normalizedStatus as I18nKey)}
          </div>
        ) : null}
      </div>
      <div style={{ width: '100%', border: '1px solid var(--ai-chat-completion-card-border)', borderRadius: 8, background: 'var(--ai-chat-completion-card-bg)', overflow: 'hidden' }}>
        <div style={{ padding: '10px', background: 'var(--ai-chat-completion-card-header-bg)', display: 'grid', gap: normalizedSummary ? 6 : 0 }}>
          {normalizedSummary ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, wordBreak: 'break-word' }}>
              <AIChatMarkdown text={normalizedSummary} enableQuoteContextMenu={true} />
            </div>
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75, wordBreak: 'break-word' }}>
            {/* result 为动态内容（可能不在翻译表），t() 内部有兜底 */}
            <AIChatMarkdown text={normalizedResult ? t(normalizedResult as I18nKey) : t('任务已完成')} enableQuoteContextMenu={true} />
          </div>
        </div>
      </div>
    </div>
  )
}
