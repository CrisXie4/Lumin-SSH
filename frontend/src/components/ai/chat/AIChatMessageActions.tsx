import { useState } from 'react'
import { Check, Clipboard, RefreshCw, SquarePen, Trash2, type LucideIcon } from 'lucide-react'
import { t, type I18nKey } from '../../../i18n.ts'
import { cn } from '../../../utils/cn.ts'
import Tiptop from '../../Tiptop.tsx'

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
    <div style={style} className="flex items-center gap-1.5">
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
        const label = t((title ?? '') as I18nKey)
        return (
          <Tiptop key={normalizedAction.key} text={label}>
            <button
              type="button"
              aria-label={label}
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
              className={cn(
                'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-transparent bg-transparent [transition:var(--transition)]',
                isCopied ? 'text-success' : 'text-muted',
                isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
              )}
            >
              <Icon size={14} />
            </button>
          </Tiptop>
        )
      })}
    </div>
  )
}
