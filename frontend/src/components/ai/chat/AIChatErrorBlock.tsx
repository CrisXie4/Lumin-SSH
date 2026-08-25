import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../../i18n.ts'

interface AIChatErrorBlockProps {
  text?: string
}

export default function AIChatErrorBlock({ text = '' }: AIChatErrorBlockProps) {
  const { t } = useTranslation()
  const content = typeof text === 'string' ? text.trim() : ''

  if (!content) {
    return null
  }

  return (
    <div className="-mt-2.5 -mx-3 grid gap-2 box-border w-[calc(100%+24px)] rounded-t-xl border border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--danger)_12%,var(--surface-overlay)),color-mix(in_srgb,var(--danger)_5%,var(--surface-overlay)))] px-3 py-2.5">
      <div className="inline-flex items-center gap-2 text-sm font-bold text-danger">
        <AlertTriangle size={14} />
        <span>{t('错误')}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-[1.7] [word-break:break-word] text-secondary">
        {content}
      </div>
    </div>
  )
}
