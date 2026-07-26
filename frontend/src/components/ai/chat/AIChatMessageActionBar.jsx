import { MessageSquare, User } from 'lucide-react'
import { useTranslation } from '../../../i18n.js'
import AIChatMessageActions from './AIChatMessageActions.jsx'

const assistantTitleKey = 'AI'

function TitleIcon({ Icon, onClick, clickTitle }) {
  if (typeof onClick !== 'function') {
    return <Icon size={13} />
  }
  return (
    <button
      type="button"
      title={clickTitle}
      aria-label={clickTitle}
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

function UserMessageActionBar({ t, title, time, actions, onTitleIconClick, titleIconClickTitle, leadingContent = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
      {leadingContent}
      <AIChatMessageActions actions={actions} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span>{time}</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{t(title)}</span>
        <TitleIcon Icon={User} onClick={onTitleIconClick} clickTitle={titleIconClickTitle} />
      </div>
    </div>
  )
}

function AssistantMessageActionBar({ t, title, time, actions, status, onTitleIconClick, titleIconClickTitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
      <TitleIcon Icon={MessageSquare} onClick={onTitleIconClick} clickTitle={titleIconClickTitle} />
      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t(title)}</span>
      <span>{time}</span>
      <AIChatMessageActions actions={actions} />
      {status}
    </div>
  )
}

export default function AIChatMessageActionBar({ variant = 'assistant', title = assistantTitleKey, time = '', actions = [], status = null, onTitleIconClick, titleIconClickTitle = '', leadingContent = null }) {
  const { t } = useTranslation()
  if (variant === 'user') {
    return <UserMessageActionBar t={t} title={title} time={time} actions={actions} onTitleIconClick={onTitleIconClick} titleIconClickTitle={titleIconClickTitle} leadingContent={leadingContent} />
  }
  return <AssistantMessageActionBar t={t} title={title} time={time} actions={actions} status={status} onTitleIconClick={onTitleIconClick} titleIconClickTitle={titleIconClickTitle} />
}