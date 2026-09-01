import AIChatMessageActionBar from './AIChatMessageActionBar.tsx'
import { cn } from '../../../utils/cn.ts'

const userTitleKey = '用户'

function openExternalLink(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
  const nextHref = typeof href === 'string' ? href.trim() : ''
  if (!nextHref) {
    return
  }
  const openUrl = window?.runtime?.BrowserOpenURL
  if (typeof openUrl === 'function') {
    event.preventDefault()
    openUrl(nextHref)
  }
}

interface AIChatUserMessageProps {
  message?: {
    id?: string;
    text?: string;
    time?: string;
    images?: unknown[];
    extra?: Record<string, unknown>;
  };
  onRetry?: (id: string, text: string, images: string[]) => void;
  onEdit?: (id: string, text: string, images: string[]) => void;
  onDelete?: (id: string) => void;
  perfMetricsText?: string;
  isEditingTarget?: boolean;
  isFirstUserMessage?: boolean;
}

export default function AIChatUserMessage({ message, onRetry, onEdit, onDelete, perfMetricsText = '', isEditingTarget = false, isFirstUserMessage = false }: AIChatUserMessageProps) {
  const text = typeof message?.text === 'string' ? message.text : ''
  const time = typeof message?.time === 'string' ? message.time : ''
  const messageId = typeof message?.id === 'string' ? message.id : ''
  const images = Array.isArray(message?.images) ? message.images.filter((item): item is string => typeof item === 'string' && !!item.trim()) : []
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
  // 原编辑态呼吸边框动画 ai-chat-message-breathe-border（keyframes 已上收全局样式表）
  const editingCardClass = isEditingTarget
    ? 'animate-[ai-chat-message-breathe-border_2.2s_ease-in-out_infinite] [will-change:background-color,border-color,box-shadow]'
    : 'will-change-auto'

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {images.map((image, index) => (
        <a
          key={`${messageId}-image-${index}`}
          href={image}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => openExternalLink(event, image)}
          className="block overflow-hidden rounded-[var(--radius-md)] border border-line bg-canvas">
          <img
            src={image}
            alt=""
            className="block h-[120px] w-full object-cover"
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
        className="inline-flex h-6 min-w-0 max-w-[52%] items-center gap-1.5 box-border overflow-hidden rounded-[var(--radius-sm)] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-2 text-accent"
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold">
          {requestModelLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-full">
      <div className="grid w-full gap-0">
        <div className={cn('grid w-full gap-0 overflow-hidden rounded-[var(--radius-md)] border border-line bg-overlay shadow-[inset_0_1px_0_var(--border-light)] [transition:background_180ms_ease,border-color_180ms_ease,box-shadow_180ms_ease]', editingCardClass)}>
          {hasContent ? (
            <div className={cn('grid px-3 py-2.5', hasText && hasImages ? 'gap-2' : 'gap-0')}>
              {hasText ? (
                <div className="whitespace-pre-wrap text-base leading-[1.6] text-primary [word-break:break-word] [overflow-wrap:anywhere]">
                  {text}
                </div>
              ) : null}
              {hasImages ? renderImages() : null}
            </div>
          ) : null}
          <div className={cn('px-3', hasContent && 'border-t border-t-line-subtle')}>
            {renderActionBar()}
          </div>
        </div>
      </div>
    </div>
  )
}
