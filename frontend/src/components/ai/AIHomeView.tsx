import { Archive, ArchiveRestore, Check, CheckSquare, FolderPlus, Search, Trash2 } from 'lucide-react'
import { Z } from '../../constants/zIndex'
import { Button } from '../ui'
import { cn } from '../../utils/cn.ts'
import { getLanguage } from '../../i18n.ts'
import { buildAIConversationDisplayList, type PanelState } from './aiChatLogic.ts'
import type { AIConversationMessageSearchResult } from './aiConversationBridge.ts'
import type { ConversationSummary } from './aiConversationSummary.ts'
import { buildAIHistoryDisplayTimeParts, getAIHistoryRelativeTimeToneStyle } from './aiTimeFormat.ts'
import type { AIConversationOrganizerState } from '../../utils/aiConversationOrganizer.ts'
import { renderAIConversationListRow } from './AIConversationListRow.tsx'
import type { I18nKey } from '../../i18n.ts'
import type * as React from 'react'

type LooseT = (key: I18nKey, vars?: Record<string, unknown>) => string

// AI 面板首页视图渲染段：全局搜索结果列表 / 分组 tab（拖拽重排/重命名）/ 会话列表 /
// 多选批量操作条。从 renderedConversationList useMemo 原样搬移，
// 闭包依赖经 deps 同名注入，行渲染委托 renderAIConversationListRow。
export interface AIHomeViewDeps {
  t: LooseT
  conversationList: ConversationSummary[]
  conversationOrganizer: AIConversationOrganizerState
  conversationFilter: string
  setConversationFilter: (filter: string) => void
  conversationSelectionMode: boolean
  setConversationSelectionMode: (mode: boolean) => void
  selectedConversationIds: Set<string>
  moveToGroupOpen: boolean
  setMoveToGroupOpen: React.Dispatch<React.SetStateAction<boolean>>
  editingConversationGroupId: string
  editingConversationGroupName: string
  setEditingConversationGroupName: (name: string) => void
  draggingConversationGroupId: string
  dragOverConversationGroupId: string
  setDraggingConversationGroupId: (groupId: string) => void
  setDragOverConversationGroupId: (groupId: string) => void
  panelState: PanelState
  globalSearchOpen: boolean
  globalSearchQuery: string
  setGlobalSearchQuery: (query: string) => void
  normalizedGlobalSearchQuery: string
  globalSearchLoading: boolean
  globalSearchResults: AIConversationMessageSearchResult[]
  globalSearchInputRef: React.RefObject<HTMLInputElement | null>
  conversationGroupRenameInputRef: React.RefObject<HTMLInputElement | null>
  resetGlobalSearchState: () => void
  handleOpenGlobalSearch: () => void
  handleSelectGlobalSearchResult: (result: AIConversationMessageSearchResult) => Promise<void>
  toggleConversationSelection: (conversationId: string) => void
  clearConversationSelection: () => void
  handleOpenConversation: (conversationId: string, delegateToWorkspace?: boolean) => Promise<void>
  handleMakeConversationPermanent: (conversationId: string) => Promise<void>
  handleOpenConversationFolder: (conversationId: string) => Promise<void>
  handleRenameConversationTitle: (targetConversationId?: string) => Promise<void>
  handleDeleteConversation: (conversationId: string) => Promise<void>
  handleCreateConversationGroup: () => Promise<void>
  beginRenameConversationGroup: (groupId: string) => void
  cancelRenameConversationGroup: () => void
  commitRenameConversationGroup: () => void
  reorderConversationGroup: (sourceId: string, targetId: string) => void
  showSystemGroupRenameUnsupported: () => void
  handleDeleteConversationGroup: (groupId: string) => Promise<void>
  handleMoveSelectedConversations: (groupId: string) => void
  handleSetSelectedArchived: (archived: boolean) => Promise<void>
  handleDeleteSelectedConversations: () => Promise<void>
}

export function renderAIHomeView({
  t,
  conversationList,
  conversationOrganizer,
  conversationFilter,
  setConversationFilter,
  conversationSelectionMode,
  setConversationSelectionMode,
  selectedConversationIds,
  moveToGroupOpen,
  setMoveToGroupOpen,
  editingConversationGroupId,
  editingConversationGroupName,
  setEditingConversationGroupName,
  draggingConversationGroupId,
  dragOverConversationGroupId,
  setDraggingConversationGroupId,
  setDragOverConversationGroupId,
  panelState,
  globalSearchOpen,
  globalSearchQuery,
  setGlobalSearchQuery,
  normalizedGlobalSearchQuery,
  globalSearchLoading,
  globalSearchResults,
  globalSearchInputRef,
  conversationGroupRenameInputRef,
  resetGlobalSearchState,
  handleOpenGlobalSearch,
  handleSelectGlobalSearchResult,
  toggleConversationSelection,
  clearConversationSelection,
  handleOpenConversation,
  handleMakeConversationPermanent,
  handleOpenConversationFolder,
  handleRenameConversationTitle,
  handleDeleteConversation,
  handleCreateConversationGroup,
  beginRenameConversationGroup,
  cancelRenameConversationGroup,
  commitRenameConversationGroup,
  reorderConversationGroup,
  showSystemGroupRenameUnsupported,
  handleDeleteConversationGroup,
  handleMoveSelectedConversations,
  handleSetSelectedArchived,
  handleDeleteSelectedConversations,
}: AIHomeViewDeps) {
    const getConversationGroupId = (item: ConversationSummary) => {
      const ownerId = item.rootConversationId || item.parentConversationId || item.id
      return conversationOrganizer.assignments[item.id] || conversationOrganizer.assignments[ownerId] || ''
    }
    const visibleConversationList = conversationList.filter((item) => {
      if (conversationFilter === 'archived') return item.archived === true
      if (item.archived === true) return false
      if (conversationFilter === 'all') return true
      const groupId = getConversationGroupId(item)
      return conversationFilter === 'ungrouped' ? !groupId : groupId === conversationFilter
    })
    const displayConversationList = buildAIConversationDisplayList(visibleConversationList)
    let content: React.ReactNode = null

    if (globalSearchOpen) {
      content = (
        <div className="grid min-h-0">
          <div className="px-3.5 py-2.5 border-b border-line-subtle bg-canvas">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <input
                id="ai-panel-main-global-search"
                name="ai-panel-main-global-search"
                autoComplete="off"
                ref={globalSearchInputRef}
                value={globalSearchQuery}
                onChange={(event) => setGlobalSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    resetGlobalSearchState()
                  }
                }}
                placeholder={t('输入关键词搜索全部对话')}
                className="h-[34px] w-full rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 box-border outline-none transition-colors focus:border-focus focus:bg-raised focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                title={t('关闭搜索')}
                aria-label={t('关闭搜索')}
                onClick={resetGlobalSearchState}
                className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-line bg-canvas hover:bg-hover text-tertiary hover:text-primary cursor-pointer transition-colors"
              >
                ×
              </button>
            </div>
          </div>
          {normalizedGlobalSearchQuery ? (
            globalSearchLoading ? (
              <div className="min-h-[calc(100%-101px)] flex items-center justify-center p-5 text-center text-tertiary text-sm leading-[1.8]">
                {t('加载中...')}
              </div>
            ) : globalSearchResults.length === 0 ? (
              <div className="min-h-[calc(100%-101px)] flex items-center justify-center p-5 text-center text-tertiary text-sm leading-[1.8]">
                {t('没有找到匹配内容')}
              </div>
            ) : (
              <div className="grid">
                {globalSearchResults.map((result) => {
                  const historyTimeParts = buildAIHistoryDisplayTimeParts(result.updatedAt || 0, getLanguage() || 'zh-CN')
                  const historyRelativeToneStyle = getAIHistoryRelativeTimeToneStyle(result.updatedAt || 0)
                  const isSelected = selectedConversationIds.has(result.conversationId)
                  return (
                    <div
                      key={`${result.conversationId}:${result.messageId}`}
                      className="w-full flex items-center border-0 border-b border-line transition-colors duration-[120ms]"
                      style={{
                        background: isSelected ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                      }}
                    >
                      {conversationSelectionMode ? (
                        <button
                          type="button"
                          aria-label={isSelected ? t('取消选择') : t('选择')}
                          aria-pressed={isSelected}
                          onClick={() => toggleConversationSelection(result.conversationId)}
                          className={cn(
                            'w-[34px] self-stretch inline-flex items-center justify-center border-0 bg-transparent cursor-pointer shrink-0 transition-colors',
                            'hover:bg-hover focus-visible:text-accent',
                            isSelected ? 'text-accent' : 'text-muted',
                          )}
                        >
                          <div className={cn('custom-checkbox', isSelected && 'checked')}>
                            {isSelected && <Check size={10} strokeWidth={4} />}
                          </div>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (conversationSelectionMode) {
                            toggleConversationSelection(result.conversationId)
                          } else {
                            void handleSelectGlobalSearchResult(result)
                          }
                        }}
                        className="flex-1 min-w-0 grid gap-2 py-3 px-3.5 border-0 bg-transparent text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 text-md font-bold text-primary whitespace-nowrap overflow-hidden text-ellipsis">{result.conversationTitle}</div>
                          <div className="shrink-0 text-xs text-tertiary">{result.role === 'user' ? t('用户') : t('AI')}</div>
                        </div>
                        <div className="text-xs text-muted flex items-center gap-0 flex-wrap">
                          <span>{historyTimeParts.absoluteText}</span>
                          {historyTimeParts.relativeText ? (
                            <span style={historyRelativeToneStyle}>({historyTimeParts.relativeText})</span>
                          ) : null}
                        </div>
                        <div className="text-sm text-secondary leading-[1.6] whitespace-pre-wrap break-words">{result.snippet}</div>
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="min-h-[calc(100%-101px)] flex items-center justify-center p-5 text-center text-tertiary text-sm leading-[1.8]">
              {t('搜索全部对话中的消息')}
            </div>
          )}
        </div>
      )
    } else if (displayConversationList.length === 0) {
      content = (
        <div className="min-h-[calc(100%-53px)] flex items-center justify-center p-5 text-center text-tertiary text-sm leading-[1.8]">
          <div className="max-w-[80%] grid gap-0.5">
            <div>{conversationFilter === 'archived' ? t('当前没有已归档会话') : t('当前分组没有会话')}</div>
          </div>
        </div>
      )
    } else {      content = (
        <div className="flex flex-col gap-[4px] px-1 pb-1">
          {displayConversationList.map((item) => renderAIConversationListRow({ t, panelState, selectedConversationIds, conversationSelectionMode, toggleConversationSelection, handleOpenConversation, handleMakeConversationPermanent, handleOpenConversationFolder, handleRenameConversationTitle, handleDeleteConversation }, item))}
        </div>
      )
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-canvas relative">
        <div className="px-2.5 py-2 border-b border-line-subtle bg-raised shrink-0 grid gap-2" style={{ zIndex: Z.STACK }}>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="text-sm font-semibold text-secondary min-w-0 truncate">{conversationSelectionMode ? t('已选择 {count} 项').replace('{count}', String(selectedConversationIds.size)) : t('对话历史')}</div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" title={conversationSelectionMode ? t('退出多选') : t('多选')} aria-label={conversationSelectionMode ? t('退出多选') : t('多选')} onClick={() => conversationSelectionMode ? clearConversationSelection() : setConversationSelectionMode(true)} className={cn(
                'w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border cursor-pointer transition-colors',
                conversationSelectionMode
                  ? 'border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                  : 'border-line-subtle bg-sunken text-tertiary hover:text-primary hover:bg-hover',
              )}><CheckSquare size={14} /></button>
              <button type="button" title={t('新建分组')} aria-label={t('新建分组')} onClick={() => void handleCreateConversationGroup()} className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-line-subtle bg-sunken text-tertiary hover:text-primary hover:bg-hover cursor-pointer transition-colors"><FolderPlus size={14} /></button>
              <button
                type="button"
                title={t('全局搜索对话')}
                aria-label={t('全局搜索对话')}
                onClick={handleOpenGlobalSearch}
                className={cn(
                  'w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border cursor-pointer shrink-0 transition-colors',
                  globalSearchOpen
                    ? 'border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                    : 'border-line-subtle bg-sunken text-tertiary hover:text-primary hover:bg-hover',
                )}
              >
                <Search size={14} />
              </button>
            </div>
          </div>
          <div role="tablist" aria-label={t('分组')} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] pb-px">
            <button role="tab" aria-selected={conversationFilter === 'all'} type="button" onClick={() => { setConversationFilter('all'); clearConversationSelection(); cancelRenameConversationGroup() }} onDoubleClick={showSystemGroupRenameUnsupported} className={cn(
              'h-[26px] px-[9px] rounded-[var(--radius-sm)] border text-xs whitespace-nowrap cursor-pointer shrink-0 transition-colors font-medium',
              conversationFilter === 'all'
                ? 'border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                : 'border-line-subtle bg-transparent text-secondary hover:text-primary hover:bg-hover/60',
            )}>{t('全部')}</button>
            {conversationOrganizer.groups.map((group) => {
              const selected = conversationFilter === group.id
              const editing = editingConversationGroupId === group.id
              const dragging = draggingConversationGroupId === group.id
              const dragOver = dragOverConversationGroupId === group.id && !dragging
              return editing ? (
                <input
                  key={group.id}
                  ref={conversationGroupRenameInputRef}
                  aria-label={t('重命名分组')}
                  value={editingConversationGroupName}
                  onChange={(event) => setEditingConversationGroupName(event.target.value)}
                  onBlur={commitRenameConversationGroup}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); commitRenameConversationGroup() }
                    if (event.key === 'Escape') { event.preventDefault(); cancelRenameConversationGroup() }
                  }}
                  className="h-[26px] px-2 rounded-[var(--radius-sm)] border border-accent-border bg-sunken text-primary text-xs outline-2 outline-accent/20 shrink-0"
                  style={{ width: Math.max(72, Math.min(150, editingConversationGroupName.length * 12 + 24)) }}
                />
              ) : (
                <button
                  key={group.id}
                  role="tab"
                  aria-selected={selected}
                  draggable
                  type="button"
                  onClick={() => { setConversationFilter(group.id); clearConversationSelection() }}
                  onDoubleClick={() => beginRenameConversationGroup(group.id)}
                  onContextMenu={(event) => { event.preventDefault(); void handleDeleteConversationGroup(group.id) }}
                  onDragStart={(event) => { setDraggingConversationGroupId(group.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', group.id) }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverConversationGroupId(group.id) }}
                  onDrop={(event) => { event.preventDefault(); reorderConversationGroup(draggingConversationGroupId || event.dataTransfer.getData('text/plain'), group.id); setDraggingConversationGroupId(''); setDragOverConversationGroupId('') }}
                  onDragEnd={() => { setDraggingConversationGroupId(''); setDragOverConversationGroupId('') }}
                  className={cn(
                    'h-[26px] px-[9px] rounded-[var(--radius-sm)] border text-xs whitespace-nowrap shrink-0 transition-colors font-medium',
                    dragOver
                      ? 'border-accent ring-2 ring-accent/20'
                      : (selected
                        ? 'border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                        : 'border-line-subtle bg-transparent text-secondary hover:text-primary hover:bg-hover/60'),
                  )}
                  style={{
                    cursor: dragging ? 'grabbing' : 'grab',
                    opacity: dragging ? 0.5 : 1,
                    transform: dragOver ? 'translateX(2px)' : 'none',
                  }}>
                  {group.name}
                </button>
              )
            })}
            <button role="tab" aria-selected={conversationFilter === 'archived'} type="button" onClick={() => { setConversationFilter('archived'); clearConversationSelection(); cancelRenameConversationGroup() }} onDoubleClick={showSystemGroupRenameUnsupported} className={cn(
              'h-[26px] px-[9px] rounded-[var(--radius-sm)] border text-xs whitespace-nowrap cursor-pointer shrink-0 transition-colors font-medium',
              conversationFilter === 'archived'
                ? 'border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                : 'border-line-subtle bg-transparent text-secondary hover:text-primary hover:bg-hover/60',
            )}>{t('已归档')}</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {content}
        </div>
        {conversationSelectionMode && selectedConversationIds.size > 0 ? (
          <div className="shrink-0 p-2 border-t border-line bg-raised grid gap-1.5" style={{ zIndex: Z.STACK + 1 }}>
            {moveToGroupOpen ? (
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                <Button variant="ghost" size="sm" onClick={() => handleMoveSelectedConversations('')} className="shrink-0 h-7 text-xs rounded-[var(--radius-sm)]">{t('移出分组')}</Button>
                {conversationOrganizer.groups.map((group) => <Button key={group.id} variant="ghost" size="sm" onClick={() => handleMoveSelectedConversations(group.id)} className="shrink-0 h-7 text-xs rounded-[var(--radius-sm)]">{group.name}</Button>)}
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 pl-1 pr-1.5 shrink-0 text-xs font-semibold text-primary">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-[11px] font-bold">
                  {selectedConversationIds.size}
                </span>
                <span>{t('项')}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setMoveToGroupOpen((current) => !current)} className="flex-1 h-7 text-xs rounded-[var(--radius-sm)]">{t('移动到分组')}</Button>
              <Button variant="secondary" size="sm" onClick={() => void handleSetSelectedArchived(conversationFilter !== 'archived')} className="flex-1 h-7 text-xs gap-1.5 rounded-[var(--radius-sm)]">
                {conversationFilter === 'archived' ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {conversationFilter === 'archived' ? t('恢复') : t('归档')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => void handleDeleteSelectedConversations()} aria-label={t('删除')} className="w-7 h-7 p-0 shrink-0 rounded-[var(--radius-sm)]">
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )}
