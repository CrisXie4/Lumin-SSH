import {
  CheckSquare,
  Database,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  History,
  LayoutGrid,
  List,
  Monitor,
  MonitorUp,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import type { ServerListViewMode } from '../../hooks/useDashboardPreferences.ts';
import { useTranslation } from '../../i18n.ts';
import { cn } from '../../utils/cn.ts';
import Tiptop from '../Tiptop.tsx';
import { Button, ContextMenu } from '../ui';
import type { MenuItem } from '../ui';

export interface DashboardHeaderActionsProps {
  hostPageMode: 'hosts' | 'recent';
  switchHostPageMode: (mode: string) => void;
  recentServersCount: number;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  localMenuPos: { x: number; y: number } | null;
  setLocalMenuPos: (pos: { x: number; y: number } | null) => void;
  localMenuItems: MenuItem[];
  selectionMode: boolean;
  onSelectionModeToggle: () => void;
  serverListViewMode: ServerListViewMode;
  onViewModeChange: (mode: ServerListViewMode) => void;
  hideSensitive: boolean;
  onHideSensitiveToggle: () => void;
  hasVisibleGroupHeaders: boolean;
  allCollapsed: boolean;
  onToggleCollapseAllGroups: () => void;
  onOpenImportExport: () => void;
  onOpenBigScreen?: () => void;
  onClearRecent: () => Promise<void>;
  hasRecentServers: boolean;
}

export function DashboardHeaderActions({
  hostPageMode,
  switchHostPageMode,
  recentServersCount,
  searchQuery,
  onSearchChange,
  localMenuPos,
  setLocalMenuPos,
  localMenuItems,
  selectionMode,
  onSelectionModeToggle,
  serverListViewMode,
  onViewModeChange,
  hideSensitive,
  onHideSensitiveToggle,
  hasVisibleGroupHeaders,
  allCollapsed,
  onToggleCollapseAllGroups,
  onOpenImportExport,
  onOpenBigScreen,
  onClearRecent,
  hasRecentServers,
}: DashboardHeaderActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 py-1">
      {/* 左侧：模式切换 + 搜索（占满剩余宽度，输入框不再窄） */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="inline-flex h-8.5 shrink-0 items-center gap-0.5 rounded-[var(--radius-sm)] border border-line-subtle bg-sunken p-0.5">
          <Tiptop text={t('主机')} placement="bottom">
            <button
              type="button"
              onClick={() => switchHostPageMode('hosts')}
              aria-label={t('主机')}
              aria-pressed={hostPageMode === 'hosts'}
              className={cn(
                'inline-flex h-7 items-center justify-center gap-1.5 rounded-[6px] px-3 text-xs font-medium whitespace-nowrap transition-colors',
                hostPageMode === 'hosts'
                  ? 'border border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                  : 'border border-transparent text-secondary hover:text-primary hover:bg-hover/60',
              )}
            >
              <Monitor size={14} />
              <span>{t('主机')}</span>
            </button>
          </Tiptop>
          <Tiptop text={t('最近连接')} placement="bottom">
            <button
              type="button"
              onClick={() => switchHostPageMode('recent')}
              aria-label={t('最近连接')}
              aria-pressed={hostPageMode === 'recent'}
              className={cn(
                'inline-flex h-7 items-center justify-center gap-1.5 rounded-[6px] px-3 text-xs font-medium whitespace-nowrap transition-colors',
                hostPageMode === 'recent'
                  ? 'border border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                  : 'border border-transparent text-secondary hover:text-primary hover:bg-hover/60',
              )}
            >
              <History size={14} />
              <span>{t('最近连接')}</span>
              {recentServersCount > 0 && (
                <span
                  className={cn(
                    'ml-0.5 inline-flex min-w-[18px] h-[17px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none font-mono',
                    hostPageMode === 'recent'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-accent/15 text-accent ring-1 ring-accent/25 ring-inset',
                  )}
                >
                  {recentServersCount}
                </span>
              )}
            </button>
          </Tiptop>
        </div>

        <div className="relative flex min-w-[200px] max-w-[480px] flex-1 items-center">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            id="server-search"
            name="serverSearch"
            type="search"
            autoComplete="off"
            aria-label={t('搜索服务器...')}
            className="h-8.5 w-full rounded-[var(--radius-sm)] border border-line-subtle bg-sunken pl-9 pr-8 text-[13px] text-primary placeholder:text-muted outline-none transition-colors focus:border-focus focus:bg-raised focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            placeholder={t('搜索服务器...')}
            value={searchQuery}
            onChange={onSearchChange}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label={t('清空')}
              onClick={() => onSearchChange({ target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>)}
              className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-muted hover:bg-hover hover:text-primary transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 右侧：操作区 — 统一 34px 高度（宽松），图标与文字按钮视觉对齐 */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Tiptop text={t('本地终端 & 串口')} placement="bottom">
          <Button
            variant="ghost"
            size="icon"
            className="!h-8.5 !w-8.5 !min-w-8.5 rounded-[var(--radius-sm)] !border !border-line-subtle !bg-sunken hover:!bg-hover hover:!text-primary hover:!border-line"
            aria-pressed={!!localMenuPos}
            aria-label={t('本地连接')}
            onClick={(e) => {
              if (localMenuPos) {
                setLocalMenuPos(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              setLocalMenuPos({ x: rect.right - 200, y: rect.bottom + 4 });
            }}
          >
            <Terminal size={15} />
          </Button>
        </Tiptop>
        {localMenuPos && (
          <ContextMenu
            x={localMenuPos.x}
            y={localMenuPos.y}
            minWidth={200}
            items={localMenuItems}
            onClose={() => setLocalMenuPos(null)}
          />
        )}

        <Button
          variant="secondary"
          onClick={() => onOpenBigScreen?.()}
          aria-label={t('数据大屏')}
          className="h-8.5 shrink-0 gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium"
        >
          <MonitorUp size={14} />
          <span className="hidden md:inline">{t('数据大屏')}</span>
        </Button>

        {hostPageMode === 'hosts' ? (
          <>
            <Tiptop text={selectionMode ? t('退出选择') : t('选择模式')} placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  '!h-8.5 !w-8.5 !min-w-8.5 rounded-[var(--radius-sm)] !border !bg-sunken hover:!border-line',
                  selectionMode
                    ? '!border-accent-border !bg-accent-dim !text-accent'
                    : '!border-line-subtle hover:!bg-hover hover:!text-primary',
                )}
                onClick={onSelectionModeToggle}
                aria-label={selectionMode ? t('退出选择') : t('选择模式')}
                aria-pressed={selectionMode}
              >
                <CheckSquare size={15} />
              </Button>
            </Tiptop>

            <div className="inline-flex h-8.5 items-center gap-0.5 rounded-[var(--radius-sm)] border border-line-subtle bg-sunken p-0.5">
              <Tiptop text={t('卡片视图')} placement="bottom">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  aria-label={t('卡片视图')}
                  aria-pressed={serverListViewMode === 'grid'}
                  className={cn(
                    'inline-flex h-7 w-8 items-center justify-center rounded-[6px] text-xs transition-colors',
                    serverListViewMode === 'grid'
                      ? 'border border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                      : 'border border-transparent text-secondary hover:text-primary hover:bg-hover/60',
                  )}
                >
                  <LayoutGrid size={15} />
                </button>
              </Tiptop>
              <Tiptop text={t('列表视图')} placement="bottom">
                <button
                  type="button"
                  onClick={() => onViewModeChange('table')}
                  aria-label={t('列表视图')}
                  aria-pressed={serverListViewMode === 'table'}
                  className={cn(
                    'inline-flex h-7 w-8 items-center justify-center rounded-[6px] text-xs transition-colors',
                    serverListViewMode === 'table'
                      ? 'border border-accent-border bg-accent-dim text-accent font-semibold shadow-xs'
                      : 'border border-transparent text-secondary hover:text-primary hover:bg-hover/60',
                  )}
                >
                  <List size={15} />
                </button>
              </Tiptop>
            </div>

            <Tiptop text={hideSensitive ? t('显示敏感信息') : t('隐藏敏感信息')} placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  '!h-8.5 !w-8.5 !min-w-8.5 rounded-[var(--radius-sm)] !border !bg-sunken hover:!border-line',
                  hideSensitive
                    ? '!border-[rgba(var(--warning-rgb),0.35)] !bg-warning-dim !text-warning hover:!bg-warning-dim'
                    : '!border-line-subtle hover:!bg-hover hover:!text-primary',
                )}
                onClick={onHideSensitiveToggle}
                aria-label={hideSensitive ? t('显示敏感信息') : t('隐藏敏感信息')}
                aria-pressed={hideSensitive}
              >
                {hideSensitive ? <Eye size={15} /> : <EyeOff size={15} />}
              </Button>
            </Tiptop>

            <div className="mx-1 hidden h-6 w-px shrink-0 bg-line-subtle sm:block" aria-hidden="true" />
            {hasVisibleGroupHeaders && (
              <Button
                variant="secondary"
                onClick={onToggleCollapseAllGroups}
                className="h-8.5 shrink-0 gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium"
              >
                {allCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
                <span className="hidden sm:inline">{allCollapsed ? t('打开分组') : t('收起分组')}</span>
                <span className="sm:hidden">{allCollapsed ? t('打开') : t('收起')}</span>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={onOpenImportExport}
              aria-label={t('数据管理')}
              className="h-8.5 shrink-0 gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium"
            >
              <Database size={14} />
              <span className="hidden sm:inline">{t('数据管理')}</span>
              <span className="sm:hidden">{t('数据')}</span>
            </Button>
          </>
        ) : (
          <>
            <Tiptop text={hideSensitive ? t('显示敏感信息') : t('隐藏敏感信息')} placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  '!h-8.5 !w-8.5 !min-w-8.5 rounded-[var(--radius-sm)] !border !bg-sunken hover:!border-line',
                  hideSensitive
                    ? '!border-[rgba(var(--warning-rgb),0.35)] !bg-warning-dim !text-warning hover:!bg-warning-dim'
                    : '!border-line-subtle hover:!bg-hover hover:!text-primary',
                )}
                onClick={onHideSensitiveToggle}
                aria-label={hideSensitive ? t('显示敏感信息') : t('隐藏敏感信息')}
                aria-pressed={hideSensitive}
              >
                {hideSensitive ? <Eye size={15} /> : <EyeOff size={15} />}
              </Button>
            </Tiptop>
            <div className="mx-1 hidden h-6 w-px shrink-0 bg-line-subtle sm:block" aria-hidden="true" />
            <Button
              variant="secondary"
              onClick={() => void onClearRecent()}
              disabled={!hasRecentServers}
              aria-label={t('清空最近连接')}
              className="h-8.5 shrink-0 gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium"
            >
              <Trash2 size={14} />
              <span>{t('清空')}</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
