import { ChevronLeft, History, MessagesSquare, RotateCcw, Trash2, type LucideIcon } from 'lucide-react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from '../../i18n.ts'
import { Switch } from '../ui'
import { deleteAIConversationBackup, getAIConversationBackupHistory, listAIConversationBackups, restoreAIConversationBackup } from './aiConversationBackupBridge.ts'
import { DEFAULT_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT, MAX_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT } from './aiGlobalSettingsBridge.ts'
import AIChatMarkdown from './chat/AIChatMarkdown.tsx'

/** 备份条目（bridge 归一化后的宽松结构） */
interface ConversationBackup {
  id: string
  ts: number
  message?: string
  messageRole?: string
  [key: string]: unknown
}

/** 备份历史消息（bridge 归一化后的宽松结构） */
interface ConversationBackupHistoryEntry {
  messageId?: string
  role?: string
  content?: unknown
  ts?: number
}

function formatRelativeTime(timestamp: number, language: string) {
  const diffMs = timestamp - Date.now()
  const absDiffMs = Math.abs(diffMs)
  const divisions = [
    { unit: 'year' as const, ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month' as const, ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'week' as const, ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: 'day' as const, ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour' as const, ms: 1000 * 60 * 60 },
    { unit: 'minute' as const, ms: 1000 * 60 },
    { unit: 'second' as const, ms: 1000 },
  ]
  for (const division of divisions) {
    if (absDiffMs >= division.ms || division.unit === 'second') {
      const value = Math.round(diffMs / division.ms)
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(value, division.unit)
    }
  }
  return ''
}

function formatDateTime(value: number | string, language: string) {
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) {
    return String(value || '')
  }
  return date.toLocaleString(language).replace(/\//g, '-')
}

function formatBackupIdTime(backupId: string, language: string) {
  const normalized = String(backupId || '').replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-\d+)?Z$/, '$1-$2-$3T$4:$5:$6Z')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return String(backupId || '')
  }
  return formatDateTime(date.getTime(), language)
}

function getHistoryText(content: unknown) {
  if (typeof content === 'string' && content.trim()) {
    return content
  }
  if (Array.isArray(content)) {
    const parts = (content as Array<Record<string, unknown>>)
      .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => (block.text as string).trim())
      .filter(Boolean)
    if (parts.length > 0) {
      return parts.join('\n\n')
    }
  }
  return ''
}

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}

function ActionButton({ icon: Icon, label, onClick, disabled = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-w-0 h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--radius-sm)] border border-line text-xs font-semibold transition-colors ${
        disabled ? 'bg-hover text-muted cursor-not-allowed' : 'bg-raised text-primary hover:bg-hover cursor-pointer'
      }`}
    >
      <Icon size={14} />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
    </button>
  )
}

interface ToggleSwitchControlProps {
  checked: boolean
  onChange?: () => void
}

function ToggleSwitchControl({ checked, onChange }: ToggleSwitchControlProps) {
  return <Switch checked={checked} onChange={onChange} />
}

export interface AIConversationBackupSettingsProps {
  active: boolean
  conversationId: string
  conversationUpdatedAt?: number
  requestInFlight?: boolean
  onRestoreSnapshot?: (snapshot: unknown) => Promise<unknown> | void
  autoBackupEnabled?: boolean
  onToggleAutoBackup?: () => void
  autoBackupRetentionCount?: number
  onChangeAutoBackupRetentionCount?: (value: number) => void
}

export default function AIConversationBackupSettings({
  active,
  conversationId,
  conversationUpdatedAt = 0,
  requestInFlight = false,
  onRestoreSnapshot,
  autoBackupEnabled = true,
  onToggleAutoBackup,
  autoBackupRetentionCount = DEFAULT_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT,
  onChangeAutoBackupRetentionCount,
}: AIConversationBackupSettingsProps) {
  const { t, lang } = useTranslation()
  const [backups, setBackups] = useState<ConversationBackup[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<ConversationBackup | null>(null)
  const [lastViewedBackupId, setLastViewedBackupId] = useState('')
  const [historyEntries, setHistoryEntries] = useState<ConversationBackupHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const historyVirtuosoRef = useRef<VirtuosoHandle | null>(null)
  const historyAutoScrollBackupIdRef = useRef('')
  const normalizedRetentionCount = Number.isFinite(Number(autoBackupRetentionCount))
    ? Math.min(MAX_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT, Math.max(1, Math.trunc(Number(autoBackupRetentionCount))))
    : DEFAULT_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT

  const loadBackups = useCallback(async (options: { background?: boolean } = {}) => {
    const background = options?.background === true
    if (!conversationId) {
      setBackups([])
      setIsLoaded(true)
      setIsRefreshing(false)
      return
    }
    if (!background) {
      setIsLoaded(false)
    } else {
      setIsRefreshing(true)
    }
    try {
      const items = await listAIConversationBackups(conversationId)
      setBackups(items)
    } finally {
      setIsLoaded(true)
      setIsRefreshing(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (!active || !conversationId) {
      return
    }
    const timer = window.setTimeout(() => {
      void loadBackups({ background: isLoaded }).catch(() => {})
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active, conversationId, conversationUpdatedAt, isLoaded, loadBackups])

  useEffect(() => {
    if (!active || !selectedBackup) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [active, selectedBackup])

  useEffect(() => {
    if (!conversationId) {
      setSelectedBackup(null)
      setHistoryEntries([])
      setHistoryLoading(false)
    }
  }, [conversationId])

  const relativeTimeMap = useMemo(
    () => new Map(backups.map((backup) => {
      void now
      return [backup.id, backup.ts > 0 ? formatRelativeTime(backup.ts, lang) : '']
    })),
    [backups, lang, now],
  )

  useEffect(() => {
    const backupId = selectedBackup?.id || ''
    if (!backupId || historyEntries.length === 0 || historyAutoScrollBackupIdRef.current === backupId) {
      return
    }
    historyAutoScrollBackupIdRef.current = backupId
    const frame = window.requestAnimationFrame(() => {
      historyVirtuosoRef.current?.scrollToIndex({
        index: historyEntries.length - 1,
        align: 'end',
        behavior: 'auto',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [historyEntries.length, selectedBackup?.id])

  const handleOpenHistory = useCallback(async (backup: ConversationBackup) => {
    if (!conversationId || !backup?.id) {
      return
    }
    historyAutoScrollBackupIdRef.current = ''
    setHistoryEntries([])
    setSelectedBackup(backup)
    setLastViewedBackupId(backup.id)
    setHistoryLoading(true)
    const entries = await getAIConversationBackupHistory(conversationId, backup.id)
    setHistoryEntries(entries)
    setHistoryLoading(false)
  }, [conversationId])

  const handleRestore = useCallback(async (backupId: string) => {
    if (!conversationId || !backupId || requestInFlight) {
      return
    }
    const snapshot = await restoreAIConversationBackup(conversationId, backupId)
    if (snapshot) {
      await onRestoreSnapshot?.(snapshot)
      await loadBackups()
    }
  }, [conversationId, loadBackups, onRestoreSnapshot, requestInFlight])

  const handleDelete = useCallback(async (backupId: string) => {
    if (!conversationId || !backupId || requestInFlight) {
      return
    }
    await deleteAIConversationBackup(conversationId, backupId)
    if (selectedBackup?.id === backupId) {
      setSelectedBackup(null)
      setHistoryEntries([])
      setHistoryLoading(false)
    }
    await loadBackups()
  }, [conversationId, loadBackups, requestInFlight, selectedBackup?.id])

  const handleRetentionCountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10)
    if (!Number.isFinite(parsed)) {
      return
    }
    const nextValue = Math.min(MAX_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT, Math.max(1, parsed))
    onChangeAutoBackupRetentionCount?.(nextValue)
  }, [onChangeAutoBackupRetentionCount])

  if (!conversationId) {
    return null
  }

  const autoBackupControl = (
    <div className="bg-canvas p-3.5 rounded-[var(--radius-md)] border border-line flex justify-between items-center gap-4">
      <div className="min-w-0">
        <div className="text-primary text-base font-bold">{t('自动备份对话')}</div>
        <div className="text-tertiary text-sm leading-[1.6]">{t('关闭后不再创建新备份，已有备份仍可查看和恢复。')}</div>
      </div>
      <ToggleSwitchControl checked={autoBackupEnabled} onChange={onToggleAutoBackup} />
    </div>
  )

  const retentionControl = (
    <div className="bg-canvas p-3.5 rounded-[var(--radius-md)] border border-line flex justify-between items-center gap-4">
      <div className="min-w-0">
        <div className="text-primary text-base font-bold">{t('最多保留最新多少个')}</div>
        <div className="text-tertiary text-sm leading-[1.6]">{t('每个对话仅保留最近的自动备份,范围 1-200,默认 30 个.')}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min={1}
          max={MAX_CONVERSATION_AUTO_BACKUP_RETENTION_COUNT}
          step={1}
          value={normalizedRetentionCount}
          onChange={handleRetentionCountChange}
          aria-label={t('最多保留最新多少个')}
          className="w-24 h-9 px-2 rounded-[var(--radius-sm)] border border-line bg-canvas text-primary text-sm text-right"
        />
        <span className="text-sm text-secondary">{t('个')}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="grid shrink-0 gap-1">
        <div className="text-[18px] font-bold text-primary leading-[1.3]">{t('自动备份')}</div>
        <div className="text-sm text-tertiary leading-[1.5]">{t('查看和恢复当前对话的自动备份记录。')}</div>
      </div>
      {autoBackupControl}
      {retentionControl}
      <div className="relative flex flex-1 min-h-0">
        <div className={`flex flex-1 min-h-0 flex-col${selectedBackup ? ' invisible pointer-events-none' : ''}`}>
          {!isLoaded && backups.length === 0 ? (
            <div className="min-h-40 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-line bg-canvas text-tertiary text-base">
              <History size={18} />
              <span>{isRefreshing ? t('刷新中...') : t('加载备份列表中...')}</span>
            </div>
          ) : (backups.length === 0 ? (
            <div className="min-h-40 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-line bg-canvas text-tertiary text-base">
              <History size={22} className="opacity-35" />
              <span>{t('暂无自动备份')}</span>
            </div>
          ) : (
            <Virtuoso
              data={backups}
              style={{ height: '100%' }}
              className="rounded-[var(--radius-md)] border border-line bg-canvas"
              itemContent={(_, backup) => (
                <div className="px-1.5 py-1.5">
                  <div className={`p-3.5 rounded-[var(--radius-md)] bg-canvas border grid gap-3 ${backup.id === lastViewedBackupId ? 'border-accent' : 'border-line'}`}>
                    <div className="grid gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="inline-flex items-center min-h-[22px] px-2 rounded-full bg-raised text-primary text-xs font-bold">
                          {backup.messageRole === 'user' ? t('用户') : t('AI')}
                        </span>
                        <span className="text-xs text-tertiary whitespace-nowrap">
                          {backup.ts > 0 ? formatDateTime(backup.ts, lang) : formatBackupIdTime(backup.id, lang)}
                        </span>
                        <span className="text-xs text-muted whitespace-nowrap">
                          {relativeTimeMap.get(backup.id)}
                        </span>
                      </div>
                      <div className="max-h-44 overflow-y-auto overflow-x-hidden px-3 py-2.5 rounded-[var(--radius-sm)] bg-overlay text-primary text-base leading-[1.6]">
                        <AIChatMarkdown text={backup.message || t('暂无消息')} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton icon={RotateCcw} label={t('恢复')} onClick={() => void handleRestore(backup.id)} disabled={requestInFlight} />
                      <ActionButton icon={Trash2} label={t('删除')} onClick={() => void handleDelete(backup.id)} disabled={requestInFlight} />
                      <ActionButton icon={MessagesSquare} label={t('对话历史')} onClick={() => void handleOpenHistory(backup)} />
                    </div>
                  </div>
                </div>
              )}
            />
          ))}
        </div>
        {selectedBackup ? (
          <div className="absolute inset-0 z-10 flex min-h-0 flex-col gap-3 bg-overlay">
            <div className="grid shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setSelectedBackup(null)}
                className="w-fit h-[30px] inline-flex items-center gap-1.5 px-2.5 rounded-[var(--radius-sm)] border border-line bg-canvas text-primary text-sm font-bold cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>{t('返回')}</span>
              </button>
              <div className="text-[18px] font-bold text-primary leading-[1.3]">{`${t('自动备份')} / ${formatBackupIdTime(selectedBackup.id, lang)}`}</div>
              <div className="text-sm text-tertiary leading-[1.5]">{historyEntries.length} {t('消息')}</div>
            </div>
            {historyLoading ? (
              <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-line bg-canvas text-tertiary text-base">
                {t('加载中...')}
              </div>
            ) : (historyEntries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-line bg-canvas text-tertiary text-base">
                {t('暂无消息')}
              </div>
            ) : (
              <Virtuoso
                ref={historyVirtuosoRef}
                data={historyEntries}
                style={{ height: '100%' }}
                className="rounded-[var(--radius-md)] border border-line bg-canvas"
                computeItemKey={(index, entry) => entry.messageId || `${entry.ts || 0}-${index}`}
                itemContent={(_, entry) => {
                  const role = entry.role === 'user' ? 'user' : 'assistant'
                  const markdown = getHistoryText(entry.content)
                  return (
                    <div className="px-1.5 py-1.5">
                      <div className={`w-full min-w-0 grid gap-2.5 px-4 py-3.5 rounded-[var(--radius-md)] border ${role === 'user' ? 'border-[rgba(var(--accent-rgb),0.35)] bg-[rgba(var(--accent-rgb),0.10)]' : 'border-line bg-canvas'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center min-h-[22px] px-2 rounded-full bg-raised text-primary text-xs font-bold">
                            {role === 'user' ? t('用户') : t('AI')}
                          </span>
                          {entry.ts && entry.ts > 0 ? (
                            <span className="text-xs text-tertiary whitespace-nowrap">
                              {formatDateTime(entry.ts, lang)}
                            </span>
                          ) : null}
                        </div>
                        <div className="max-h-[20vh] overflow-y-auto overflow-x-hidden px-3 py-2.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.03)] text-primary text-base leading-[1.6]">
                          <AIChatMarkdown text={markdown || t('暂无消息')} />
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
