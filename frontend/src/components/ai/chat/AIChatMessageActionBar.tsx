import { MessageSquare, User, type LucideIcon } from 'lucide-react'
import { useTranslation, t, type I18nKey } from '../../../i18n.ts'
import AIChatMessageActions, { type MessageAction } from './AIChatMessageActions.tsx'

const assistantTitleKey = 'AI'

interface TitleIconProps {
  Icon: LucideIcon
  onClick?: () => void
  clickTitle?: string
}

function TitleIcon({ Icon, onClick, clickTitle }: TitleIconProps) {
  if (typeof onClick !== 'function') {
    return <Icon size={13} />
  }
  return (
    <button
      type="button"
      title={clickTitle ? t(clickTitle as I18nKey) : undefined}
      aria-label={clickTitle ? t(clickTitle as I18nKey) : undefined}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}
    >
      <Icon size={13} />
    </button>
  )
}

interface MessageActionBarProps {
  t: (key: I18nKey, vars?: Record<string, unknown>) => string
  title: string
  time: string
  actions: Array<string | MessageAction>
  onTitleIconClick?: () => void
  titleIconClickTitle?: string
  leadingContent?: React.ReactNode
}

function UserMessageActionBar({ t, title, time, actions, onTitleIconClick, titleIconClickTitle, leadingContent = null }: MessageActionBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
      {leadingContent}
      <AIChatMessageActions actions={actions} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span>{time}</span>
        {/* title 为动态文案（可能不在翻译表），t() 内部有兜底 */}
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{t(title as I18nKey)}</span>
        <TitleIcon Icon={User} onClick={onTitleIconClick} clickTitle={titleIconClickTitle} />
      </div>
    </div>
  )
}

interface AssistantMessageActionBarProps extends MessageActionBarProps {
  status?: React.ReactNode
}

function AssistantMessageActionBar({ t, title, time, actions, status, onTitleIconClick, titleIconClickTitle }: AssistantMessageActionBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
      <TitleIcon Icon={MessageSquare} onClick={onTitleIconClick} clickTitle={titleIconClickTitle} />
      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{/* 同 title：动态文案，t() 内部有兜底 */}{t(title as I18nKey)}</span>
      <span>{time}</span>
      <AIChatMessageActions actions={actions} />
      {status}
    </div>
  )
}

interface AIChatMessageActionBarProps {
  variant?: 'user' | 'assistant'
  title?: string
  time?: string
  actions?: Array<string | MessageAction>
  status?: React.ReactNode
  onTitleIconClick?: () => void
  titleIconClickTitle?: string
  leadingContent?: React.ReactNode
}

export default function AIChatMessageActionBar({ variant = 'assistant', title = assistantTitleKey, time = '', actions = [], status = null, onTitleIconClick, titleIconClickTitle = '', leadingContent = null }: AIChatMessageActionBarProps) {
  const { t } = useTranslation()
  if (variant === 'user') {
    return <UserMessageActionBar t={t} title={title} time={time} actions={actions} onTitleIconClick={onTitleIconClick} titleIconClickTitle={titleIconClickTitle} leadingContent={leadingContent} />
  }
  return <AssistantMessageActionBar t={t} title={title} time={time} actions={actions} status={status} onTitleIconClick={onTitleIconClick} titleIconClickTitle={titleIconClickTitle} />
}
