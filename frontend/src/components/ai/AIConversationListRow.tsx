import { ArchiveRestore, Bot, Check, FolderOpen, Pencil, Scissors } from 'lucide-react'
import { cn } from '../../utils/cn.ts'
import Tiptop from '../Tiptop.tsx'
import { getLanguage } from '../../i18n.ts'
import { buildAIHistoryDisplayTimeParts, getAIHistoryRelativeTimeToneStyle } from './aiTimeFormat.ts'
import { type PanelState, type DisplayConversationItem } from './aiChatLogic.ts'
import type { I18nKey } from '../../i18n.ts'

type LooseT = (key: I18nKey, vars?: Record<string, unknown>) => string

const AI_ROW_ACTION_BASE =
  'w-[26px] h-[26px] inline-flex items-center justify-center rounded-md shadow-none shrink-0 cursor-pointer transition-colors duration-[120ms]';
const AI_ROW_ACTION_HOVER_ACCENT =
  'hover:text-accent hover:bg-[rgba(var(--accent-rgb),0.10)] focus-visible:text-accent focus-visible:bg-[rgba(var(--accent-rgb),0.10)]';
const AI_ROW_ACTION_HOVER_DANGER =
  'hover:text-danger hover:bg-danger-dim focus-visible:text-danger focus-visible:bg-danger-dim';

// AI 首页会话列表行渲染段：子代理/摘要子任务徽标、临时会话标签、时间与消息数、
// 多选勾选与行内操作（转正/打开目录/重命名/删除）。
// 从 renderedConversationList useMemo 原样搬移，闭包依赖经 deps 同名注入，代码零改动。
export interface AIConversationListRowDeps {
  t: LooseT
  panelState: PanelState
  selectedConversationIds: Set<string>
  conversationSelectionMode: boolean
  toggleConversationSelection: (conversationId: string) => void
  handleOpenConversation: (conversationId: string, delegateToWorkspace?: boolean) => Promise<void>
  handleMakeConversationPermanent: (conversationId: string) => Promise<void>
  handleOpenConversationFolder: (conversationId: string) => Promise<void>
  handleRenameConversationTitle: (targetConversationId?: string) => Promise<void>
  handleDeleteConversation: (conversationId: string) => Promise<void>
}

export function renderAIConversationListRow({
  t,
  panelState,
  selectedConversationIds,
  conversationSelectionMode,
  toggleConversationSelection,
  handleOpenConversation,
  handleMakeConversationPermanent,
  handleOpenConversationFolder,
  handleRenameConversationTitle,
  handleDeleteConversation,
}: AIConversationListRowDeps, item: DisplayConversationItem) {
        const isAgentSubtask = item.relationType === 'agent'
        const isArchivedAgentSubtask = isAgentSubtask && item.archived === true
        const isSummarySubtask = item.relationType === 'phase' && item.relationSource === 'summary_condense'
        const historyTimeParts = buildAIHistoryDisplayTimeParts(item.updatedAt, getLanguage() || 'zh-CN')
        const historyRelativeToneStyle = getAIHistoryRelativeTimeToneStyle(item.updatedAt)
        const displayTitle = typeof item.title === 'string'
          ? item.title.replace(/\s*·\s*摘要子任务\s*$/u, '').replace(/\s*·\s*子代理任务\s*$/u, '').trim()
          : ''
        const selected = selectedConversationIds.has(item.id)
        return (
          <div
            key={item.id}
            className={cn(
              'ai-conversation-row group w-full flex items-center rounded-[var(--radius-md)] shrink-0 relative overflow-hidden',
              'transition-[color,background-color,border-color,opacity,box-shadow] duration-[120ms]',
              selected && 'selected',
              panelState.activeConversationId === item.id && 'is-active',
            )}
            style={{ opacity: item.archived === true ? 0.72 : 1 }}
          >
            {conversationSelectionMode ? (
              <button
                type="button"
                aria-label={selected ? t('取消选择') : t('选择')}
                aria-pressed={selected}
                onClick={() => toggleConversationSelection(item.id)}
                className={cn(
                  'w-[34px] self-stretch inline-flex items-center justify-center border-0 bg-transparent cursor-pointer shrink-0 transition-colors',
                  'hover:bg-hover focus-visible:text-accent',
                  selected ? 'text-accent' : 'text-muted',
                )}>
                <div className={cn('custom-checkbox', selected && 'checked')}>
                  {selected && <Check size={10} strokeWidth={4} />}
                </div>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => conversationSelectionMode ? toggleConversationSelection(item.id) : void handleOpenConversation(item.id)}
              className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 border-0 bg-transparent text-left cursor-pointer"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5" style={{ paddingLeft: item.depth > 0 ? `${item.depth * 12}px` : 0 }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {isAgentSubtask ? (
                    <Tiptop text={t('子代理任务')} placement="top">
                      <span
                        aria-label={t('子代理任务')}
                        className={cn(
                          'w-[18px] h-[18px] inline-flex items-center justify-center rounded-full shrink-0 border',
                          isArchivedAgentSubtask
                            ? 'border-line bg-sunken text-tertiary'
                            : 'border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.10)] text-accent',
                        )}
                      >
                        <Bot size={11} />
                      </span>
                    </Tiptop>
                  ) : null}
                  {isSummarySubtask ? (
                    <Tiptop text={t('摘要子任务')} placement="top">
                      <span
                        aria-label={t('摘要子任务')}
                        className="w-[18px] h-[18px] inline-flex items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.10)] text-accent shrink-0"
                      >
                        <Scissors size={11} />
                      </span>
                    </Tiptop>
                  ) : null}
                  {item.transient === true ? (
                    <span title={t('临时会话')} className="shrink-0 px-[5px] py-px rounded-sm bg-[rgba(var(--accent-rgb),0.12)] text-accent text-[10px] font-semibold">
                      {t('临时会话')}
                    </span>
                  ) : null}
                  <div className={cn(
                    'flex-1 min-w-0 text-base leading-tight truncate',
                    isArchivedAgentSubtask ? 'text-secondary' : 'text-primary',
                    panelState.activeConversationId === item.id ? 'font-semibold' : 'font-medium',
                  )} title={displayTitle || item.title}>{displayTitle || item.title}</div>
                </div>
                <div className="flex items-center gap-1 min-w-0 text-xs text-tertiary">
                  <span className="truncate" title={historyTimeParts.absoluteText}>
                    {historyTimeParts.relativeText ? (
                      <>
                        <span style={historyRelativeToneStyle}>{historyTimeParts.relativeText}</span>
                        <span className="opacity-50 ml-1 text-[11px] font-mono">{historyTimeParts.absoluteText}</span>
                      </>
                    ) : (
                      <span>{historyTimeParts.absoluteText}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted">·{item.messageCount}</span>
                </div>
              </div>
            </button>
            {!conversationSelectionMode ? (
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-[var(--radius-sm)] bg-raised/95 backdrop-blur-sm border border-line-subtle shadow-xs opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-[120ms]">
                {item.transient === true ? (
                  <button
                    type="button"
                    title={`${t('临时会话')} → ${t('保存')}`}
                    aria-label={`${t('临时会话')} → ${t('保存')}`}
                    onClick={() => void handleMakeConversationPermanent(item.id)}
                    className={cn(AI_ROW_ACTION_BASE, AI_ROW_ACTION_HOVER_ACCENT, 'text-accent')}
                  >
                    <ArchiveRestore size={13} />
                  </button>
                ) : null}
                {item.transient !== true ? (
                  <button
                    type="button"
                    title={t('打开任务所在文件夹')}
                    aria-label={t('打开任务所在文件夹')}
                    onClick={() => void handleOpenConversationFolder(item.id)}
                    className={cn(AI_ROW_ACTION_BASE, AI_ROW_ACTION_HOVER_ACCENT, 'text-muted')}
                  >
                    <FolderOpen size={13} />
                  </button>
                ) : null}
                {item.transient !== true ? (
                  <button
                    type="button"
                    title={t('编辑任务标题')}
                    aria-label={t('编辑任务标题')}
                    onClick={() => void handleRenameConversationTitle(item.id)}
                    className={cn(AI_ROW_ACTION_BASE, AI_ROW_ACTION_HOVER_ACCENT, 'text-muted')}
                  >
                    <Pencil size={13} />
                  </button>
                ) : null}
                <button
                  type="button"
                  title={t('删除')}
                  aria-label={t('删除')}
                  onClick={() => {
                    void handleDeleteConversation(item.id)
                  }}
                  className={cn(AI_ROW_ACTION_BASE, AI_ROW_ACTION_HOVER_DANGER, 'text-muted')}
                >
                  ×
                </button>
              </div>
            ) : null}
          </div>
        )}
