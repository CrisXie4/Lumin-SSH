import { useState } from 'react'
import { Check, Clipboard, RefreshCw, SquarePen, Trash2, type LucideIcon } from 'lucide-react'
import { t, type I18nKey } from '../../../i18n.ts'

interface ActionSpec {
  icon: LucideIcon
  title: string
}

const actionMap: Record<string, ActionSpec> = {
  retry: { icon: RefreshCw, title: '重试' },
  copy: { icon: Clipboard, title: '复制' },
  edit: { icon: SquarePen, title: '编辑' },
  delete: { icon: Trash2, title: '删除' },
}

/** 操作按钮（字符串 = 内置动作 key，对象 = 自定义动作） */
export interface MessageAction {
  key?: string
  icon?: LucideIcon
  title?: string
  disabled?: boolean
  onClick?: () => void
}

interface AIChatMessageActionsProps {
  actions?: Array<string | MessageAction>
  style?: React.CSSProperties
}

export default function AIChatMessageActions({ actions = [], style }: AIChatMessageActionsProps) {
  const [copied, setCopied] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {actions.map((action) => {
        const normalizedAction = typeof action === 'string'
          ? { key: action, ...actionMap[action] }
          : { ...(action?.key ? actionMap[action.key] : undefined), ...action }

        if (!normalizedAction?.icon || !normalizedAction?.key) {
          return null
        }

        const isCopied = normalizedAction.key === 'copy' && copied
        const Icon = isCopied ? Check : normalizedAction.icon
        // title 来自 actionMap 或调用方自定义文案（动态 key），t() 内部有兜底
        const title = isCopied ? '已复制' : normalizedAction.title

        const isDisabled = normalizedAction.disabled === true
        return (
          <button
            key={normalizedAction.key}
            type="button"
            title={t(/* title 为动态文案（可能不在翻译表），t() 内部有兜底 */ (title ?? '') as I18nKey)}
            aria-label={t((title ?? '') as I18nKey)}
            disabled={isDisabled}
            onClick={(event) => {
              event.stopPropagation()
              if (isDisabled) {
                return
              }
              normalizedAction.onClick?.()
              if (normalizedAction.key === 'copy') {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              }
            }}
            style={{
              width: 26,
              height: 26,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              color: isCopied ? 'var(--success)' : 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid transparent',
              transition: 'var(--transition)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.45 : 1,
            }}
          >
            <Icon size={14} />
          </button>
        )
      })}
    </div>
  )
}
