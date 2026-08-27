import { ChevronDown, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '../../../i18n.ts'

interface AIChatMCPCardProps {
  serverName?: string
  toolName?: string
  args?: string
  response?: string
  extra?: Record<string, unknown>
  isLast?: boolean
  hasSubsequentAssistantMessage?: boolean
}

export default function AIChatMCPCard({ serverName, toolName, args, response, extra = {}, isLast = false, hasSubsequentAssistantMessage = false }: AIChatMCPCardProps) {
  const { t } = useTranslation()
  const [isRequestExpanded, setIsRequestExpanded] = useState(isLast)
  const [isResponseExpanded, setIsResponseExpanded] = useState(false)
  const resultTokenEstimateDisplay = typeof extra?.resultTokenEstimateDisplay === 'string' ? extra.resultTokenEstimateDisplay.trim() : ''

  useEffect(() => {
    if (isLast) {
      setIsRequestExpanded(true)
    }
  }, [isLast])

  useEffect(() => {
    if (response) {
      setIsResponseExpanded(true)
    }
  }, [response])

  useEffect(() => {
    if (!hasSubsequentAssistantMessage) {
      return
    }
    setIsRequestExpanded(false)
    if (response) {
      setIsResponseExpanded(false)
    }
  }, [hasSubsequentAssistantMessage, response])

  return (
    <div className="grid gap-2">
      <div className="grid w-full gap-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Server size={14} color="var(--text-secondary)" />
            <span className="font-bold text-primary">{serverName}</span>
            {toolName ? <span className="font-mono text-xs text-tertiary">{toolName}</span> : null}
          </span>
          <div className="inline-flex shrink-0 items-center gap-2">
            {response ? (
              <span className="whitespace-nowrap rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_30%,var(--border))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface-overlay))] px-2 py-0.5 text-xs font-semibold text-success">
                {t('completed')}
              </span>
            ) : null}
            {resultTokenEstimateDisplay ? (
              <div className="whitespace-nowrap rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-overlay))] px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-secondary">
                {resultTokenEstimateDisplay}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsRequestExpanded((previous) => !previous)}
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0">
              <ChevronDown
                size={14}
                color="var(--text-tertiary)"
                style={{
                  transform: isRequestExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 300ms ease',
                }}
              />
            </button>
          </div>
        </div>
        {isRequestExpanded ? (
          <div className="w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-overlay">
            <div className="grid gap-2.5 p-3">
              <div className="grid gap-1.5">
                <div className="text-xs uppercase tracking-[0.4px] text-tertiary">{t('arguments')}</div>
                <pre className="m-0 max-h-[260px] overflow-x-auto overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-[var(--radius-sm)] border border-line bg-canvas px-3 py-2.5 font-mono text-sm leading-[1.65] text-secondary [word-break:break-word]">{args}</pre>
              </div>
            </div>
          </div>
        ) : null}
        {response ? (
          <div className="w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-overlay">
            <button
              type="button"
              onClick={() => setIsResponseExpanded((previous) => !previous)}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-none bg-raised px-3 py-2.5 text-left">
              <span className="inline-flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.4px] text-tertiary">{t('response')}</span>
              </span>
              <ChevronDown
                size={14}
                color="var(--text-tertiary)"
                style={{
                  transform: isResponseExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 300ms ease',
                }}
              />
            </button>
            {isResponseExpanded ? (
              <div className="grid gap-2.5 p-3">
                <div className="max-h-[320px] overflow-x-auto overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-lg border border-line-subtle bg-canvas px-3 py-2.5 text-base leading-[1.65] text-primary [word-break:break-word]">{response}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
