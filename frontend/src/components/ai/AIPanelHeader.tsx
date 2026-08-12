import { Columns2, House, MessagesSquare, Search, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../i18n.ts'
import Tiptop from '../Tiptop.tsx'
import IconActionButton from './IconActionButton.tsx'

function formatAIContextTokens(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '0'
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

interface AIPanelHeaderProps {
  showSettingsPanel: boolean
  onToggleSettings: () => void
  onGoHome: () => void
  showModeToggle?: boolean
  isDevilMode?: boolean
  onToggleMode?: () => void
  onOpenConversationSearch?: () => void
  onOpenConversationDiff?: () => void
  showConversationSearchButton?: boolean
  showConversationDiffButton?: boolean
  showContextTokens?: boolean
  contextTokens?: number
  apiMessageCount?: number
  isCondensingContext?: boolean
  canCondenseContext?: boolean
  canQuickCondenseContext?: boolean
  canSummaryCondenseContext?: boolean
  conversationSearchActive?: boolean
  onCondenseContext?: () => void
  onCondenseContextFullSummary?: () => void
  fullSummaryCondenseAvailable?: boolean
}

export default function AIPanelHeader({
  showSettingsPanel,
  onToggleSettings,
  onGoHome,
  showModeToggle = false,
  isDevilMode = false,
  onToggleMode,
  onOpenConversationSearch,
  onOpenConversationDiff,
  showConversationSearchButton = false,
  showConversationDiffButton = false,
  showContextTokens = false,
  contextTokens = 0,
  apiMessageCount = 0,
  isCondensingContext = false,
  canCondenseContext = false,
  canQuickCondenseContext = false,
  canSummaryCondenseContext = false,
  conversationSearchActive = false,
  onCondenseContext,
  onCondenseContextFullSummary,
  fullSummaryCondenseAvailable = false,
}: AIPanelHeaderProps) {
  const { t } = useTranslation()
  const [condenseActionsVisible, setCondenseActionsVisible] = useState(false)
  const condenseCloseTimerRef = useRef(0)
  const contextTokenLabel = useMemo(() => formatAIContextTokens(contextTokens), [contextTokens])
  const normalizedApiMessageCount = Number.isFinite(Number(apiMessageCount)) && Number(apiMessageCount) > 0 ? Math.trunc(Number(apiMessageCount)) : 0
  const modeToggleLabel = isDevilMode
    ? t('切换到天使模式:善良的天使会全心全意地保护你和你的设备,它有绝对的原则和信念来帮助你,同时也会感化你的不良行为')
    : t('切换到恶魔模式:可恶的恶魔会不择手段地满足你所有的危险想法,它会诱导你突破边界,并纵容你一步步滑向失控')
  const condenseButtonTooltip = isCondensingContext ? t('正在智能压缩上下文') : t('当前对话上下文 Token,点击压缩')
  const canOpenCondenseActions = Boolean(canCondenseContext || canQuickCondenseContext || canSummaryCondenseContext)
  const clearCondenseCloseTimer = () => {
    if (condenseCloseTimerRef.current) {
      window.clearTimeout(condenseCloseTimerRef.current)
      condenseCloseTimerRef.current = 0
    }
  }
  const showCondenseActions = () => {
    if (!canOpenCondenseActions) {
      return
    }
    clearCondenseCloseTimer()
    setCondenseActionsVisible(true)
  }
  const hideCondenseActionsWithDelay = () => {
    clearCondenseCloseTimer()
    condenseCloseTimerRef.current = window.setTimeout(() => {
      setCondenseActionsVisible(false)
      condenseCloseTimerRef.current = 0
    }, 180)
  }
  useEffect(() => () => {
    clearCondenseCloseTimer()
  }, [])
  const handleTriggerQuickCondense = () => {
    if (!canQuickCondenseContext) {
      return
    }
    setCondenseActionsVisible(false)
    onCondenseContext?.()
  }
  const handleTriggerFullSummaryCondense = () => {
    if (!canSummaryCondenseContext) {
      return
    }
    setCondenseActionsVisible(false)
    onCondenseContextFullSummary?.()
  }
  const handleCondenseButtonClick = () => {
    if (canQuickCondenseContext) {
      handleTriggerQuickCondense()
      return
    }
    if (canSummaryCondenseContext) {
      clearCondenseCloseTimer()
      setCondenseActionsVisible((current) => !current)
    }
  }

  return (
    <div style={{ height: 54, padding: '0 14px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', flexShrink: 0, ...(isDevilMode ? { backgroundImage: 'linear-gradient(180deg, rgba(255, 0, 38, 0.08) 0%, transparent 100%)', boxShadow: 'inset 0 -1px 0 rgba(255, 64, 64, 0.12), inset 0 0 28px rgba(255, 0, 38, 0.08)' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.2 }}>{t('AI')}</div>
        {showModeToggle ? (
          <Tiptop
            text={modeToggleLabel}
            placement="top"
          >
            <button
              type="button"
              aria-label={modeToggleLabel}
              onClick={onToggleMode}
              style={{
                padding: 0,
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{isDevilMode ? '😈' : '😇'}</span>
            </button>
          </Tiptop>
        ) : null}
      </div>
      {showContextTokens ? (
        <div style={{ justifySelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
          <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={showCondenseActions}
            onMouseLeave={hideCondenseActionsWithDelay}
            onFocus={showCondenseActions}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                hideCondenseActionsWithDelay()
              }
            }}
          >
            <Tiptop text={condenseButtonTooltip} placement="top">
              <button
                type="button"
                aria-label={condenseButtonTooltip}
                disabled={!canOpenCondenseActions}
                onClick={handleCondenseButtonClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'fit-content',
                  minWidth: 0,
                  maxWidth: '100%',
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: `1px solid ${isCondensingContext ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: isCondensingContext ? 'var(--accent-dim)' : 'transparent',
                  color: isCondensingContext ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: canOpenCondenseActions || isCondensingContext ? 1 : 0.6,
                  transition: 'var(--transition)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {contextTokenLabel}
              </button>
            </Tiptop>
            {condenseActionsVisible && canOpenCondenseActions ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 2px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'grid',
                  gap: 6,
                  minWidth: 156,
                  padding: 8,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-raised)',
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                  zIndex: 20,
                }}
                onMouseEnter={showCondenseActions}
                onMouseLeave={hideCondenseActionsWithDelay}
              >
                <button
                  type="button"
                  onClick={handleTriggerQuickCondense}
                  disabled={!canQuickCondenseContext}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: '1px solid var(--accent-border)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: canQuickCondenseContext ? 'pointer' : 'not-allowed',
                    opacity: canQuickCondenseContext ? 1 : 0.45,
                    transition: 'var(--transition)',
                  }}
                >
                  {t('快速智能压缩')}
                </button>
                <button
                  type="button"
                  onClick={handleTriggerFullSummaryCondense}
                  disabled={!canSummaryCondenseContext}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: canSummaryCondenseContext ? 'pointer' : 'not-allowed',
                    opacity: canSummaryCondenseContext ? 1 : 0.45,
                    transition: 'var(--transition)',
                  }}
                >
                  {t('全量摘要压缩')}
                </button>
              </div>
            ) : null}
          </div>
          <Tiptop text={t('当前对话节点数')} placement="top">
            <span
              aria-label={t('当前对话节点数')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                width: 'fit-content',
                minWidth: 0,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              <MessagesSquare size={12} />
              <span>{normalizedApiMessageCount}</span>
            </span>
          </Tiptop>
        </div>
      ) : (
        <div />
      )}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconActionButton title={t('返回主页')} onClick={onGoHome}>
          <House size={16} />
        </IconActionButton>
        {showConversationSearchButton ? (
          <IconActionButton title={t('当前对话搜索')} active={conversationSearchActive} onClick={onOpenConversationSearch}>
            <Search size={16} />
          </IconActionButton>
        ) : null}
        {showConversationDiffButton ? (
          <IconActionButton title={t('当前对话文件变更')} onClick={onOpenConversationDiff}>
            <Columns2 size={16} />
          </IconActionButton>
        ) : null}
        <IconActionButton title={showSettingsPanel ? t('关闭设置面板') : t('打开设置面板')} active={showSettingsPanel} onClick={onToggleSettings}>
          <Settings size={16} />
        </IconActionButton>
      </div>
    </div>
  )
}
