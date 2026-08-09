import AIChatMessageActionBar from './AIChatMessageActionBar.jsx'
import { Browser } from '@wailsio/runtime'

const userTitleKey = '用户'

function openExternalLink(event, href) {
  const nextHref = typeof href === 'string' ? href.trim() : ''
  if (!nextHref) {
    return
  }
  if (Browser?.OpenURL) {
    event.preventDefault()
    Browser.OpenURL(nextHref)
  }
}

export default function AIChatUserMessage({ message, onRetry, onEdit, onDelete, messageActionBarAtBottom = false, perfMetricsText = '', isEditingTarget = false, isFirstUserMessage = false }) {
  const text = typeof message?.text === 'string' ? message.text : ''
  const time = typeof message?.time === 'string' ? message.time : ''
  const messageId = typeof message?.id === 'string' ? message.id : ''
  const images = Array.isArray(message?.images) ? message.images.filter((item) => typeof item === 'string' && item.trim()) : []
  const requestModelLabel = typeof message?.extra?.requestModelLabel === 'string' ? message.extra.requestModelLabel.trim() : ''
  const requestModelName = typeof message?.extra?.requestModelName === 'string' ? message.extra.requestModelName.trim() : ''
  const requestProviderName = typeof message?.extra?.requestProviderName === 'string' ? message.extra.requestProviderName.trim() : ''
  const requestProviderType = typeof message?.extra?.requestProviderType === 'string' ? message.extra.requestProviderType.trim() : ''
  const requestModelTitle = [requestModelName, requestProviderName, requestProviderType].filter(Boolean).join(' · ')
  const hasText = Boolean(text)
  const hasImages = images.length > 0
  const hasContent = hasText || hasImages
  const handleCopyText = () => {
    if (!text.trim()) {
      return
    }
    navigator.clipboard.writeText(text).catch(() => {})
  }
  const messageActions = [
    { key: 'retry', onClick: () => onRetry?.(messageId, text, images) },
    { key: 'copy', onClick: handleCopyText },
    { key: 'edit', onClick: () => onEdit?.(messageId, text, images) },
    { key: 'delete', onClick: isFirstUserMessage ? undefined : () => onDelete?.(messageId), disabled: isFirstUserMessage },
  ]
  const handleCopyPerfMetrics = perfMetricsText
    ? () => navigator.clipboard.writeText(perfMetricsText).catch(() => {})
    : undefined
  const editingCardStyle = isEditingTarget
    ? {
        animation: 'ai-chat-message-breathe-border 2.2s ease-in-out infinite',
      }
    : null

  const renderActionBar = () => (
    <AIChatMessageActionBar
      variant="user"
      title={userTitleKey}
      time={time}
      actions={messageActions}
      onTitleIconClick={handleCopyPerfMetrics}
      titleIconClickTitle="复制本次发送耗时"
      leadingContent={renderRequestModelBadge()}
    />
  )

  const renderImages = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
      {images.map((image, index) => (
        <a
          key={`${messageId}-image-${index}`}
          href={image}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => openExternalLink(event, image)}
          style={{
            display: 'block',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface-base)',
          }}>
          <img
            src={image}
            alt=""
            style={{
              width: '100%',
              height: 120,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </a>
      ))}
    </div>
  )

  const renderRequestModelBadge = () => {
    if (!requestModelLabel) {
      return null
    }
    return (
      <div
        title={requestModelTitle || requestModelLabel}
        aria-label={requestModelTitle || requestModelLabel}
        style={{
          minWidth: 0,
          maxWidth: '52%',
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          borderRadius: 999,
          border: '1px solid rgba(var(--accent-rgb), 0.16)',
          background: 'rgba(var(--accent-rgb), 0.08)',
          color: 'var(--accent)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600 }}>
          {requestModelLabel}
        </span>
      </div>
    )
  }

  if (messageActionBarAtBottom) {
    return (
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ width: '100%', display: 'grid', gap: 0 }}>
          <div style={{ width: '100%', display: 'grid', gap: 0, borderRadius: 12, background: 'var(--surface-overlay)', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--border-light)', overflow: 'hidden', transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease', willChange: isEditingTarget ? 'background-color, border-color, box-shadow' : 'auto', ...(editingCardStyle || {}) }}>
            {hasContent ? (
              <div style={{ padding: '10px 12px', display: 'grid', gap: hasText && hasImages ? 8 : 0 }}>
                {hasText ? (
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {text}
                  </div>
                ) : null}
                {hasImages ? renderImages() : null}
              </div>
            ) : null}
            <div style={{ borderTop: hasContent ? '1px solid var(--border-subtle)' : 'none', padding: '0 12px' }}>
              {renderActionBar()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      <div style={{ width: '100%', display: 'grid', gap: 6 }}>
        <div>
          {renderActionBar()}
        </div>
        {hasText ? (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-overlay)', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--border-light)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease', willChange: isEditingTarget ? 'background-color, border-color, box-shadow' : 'auto', ...(editingCardStyle || {}) }}>
            {text}
          </div>
        ) : null}
        {hasImages ? renderImages() : null}
      </div>
    </div>
  )
}