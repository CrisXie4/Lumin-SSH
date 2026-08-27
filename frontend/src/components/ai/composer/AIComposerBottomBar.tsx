import type React from 'react';
import { Z } from '../../../constants/zIndex.ts';
import { useTranslation } from '../../../i18n.ts';
import { cn } from '../../../utils/cn.ts';
import Tiptop from '../../Tiptop.tsx';
import { Switch } from '../../ui';
import AIAutoApproveDropdown from '../AIAutoApproveDropdown.tsx';
import AICollaborationPromptDropdown from '../AICollaborationPromptDropdown.tsx';
import AIProviderSelector from '../AIProviderSelector.tsx';

export interface AIComposerBottomBarProps {
  currentProviderId?: string;
  onCurrentProviderChange?: (providerId: string) => void;
  providerBalanceRefreshSignal?: number;
  persistProviderSelection?: boolean;
  dismissSignal?: number;
  autoApprovalSettings?: Record<string, unknown> | null;
  onPatchAutoApprovalSettings?: (patch: Record<string, unknown>) => void;
  collaborationPromptOpen: boolean;
  setCollaborationPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  alwaysAllowAssistantCollaboration: boolean;
  collaborationExtraPrompt?: string;
  onCollaborationExtraPromptChange?: (value: string) => void;
  collaborationPromptPresets?: unknown;
  onCollaborationPromptPresetsChange?: (presets: unknown) => void;
  collaborationToggleRef: React.RefObject<HTMLButtonElement | null>;
  collaborationPromptScopeIsTask?: boolean;
  canToggleAssistantCollaboration: boolean;
  handleToggleAssistantCollaboration: () => void;
  temporarySessionEnabled: boolean;
  onTemporarySessionEnabledChange?: (enabled: boolean) => void;
}

export function AIComposerBottomBar({
  currentProviderId,
  onCurrentProviderChange,
  providerBalanceRefreshSignal,
  persistProviderSelection,
  dismissSignal,
  autoApprovalSettings,
  onPatchAutoApprovalSettings,
  collaborationPromptOpen,
  setCollaborationPromptOpen,
  alwaysAllowAssistantCollaboration,
  collaborationExtraPrompt,
  onCollaborationExtraPromptChange,
  collaborationPromptPresets,
  onCollaborationPromptPresetsChange,
  collaborationToggleRef,
  collaborationPromptScopeIsTask,
  canToggleAssistantCollaboration,
  handleToggleAssistantCollaboration,
  temporarySessionEnabled,
  onTemporarySessionEnabledChange,
}: AIComposerBottomBarProps) {
  const { t } = useTranslation();

  return (
    <div className="h-10 border-t border-line flex items-center gap-2.5 pl-3 pr-2.5 relative w-full min-w-0 max-w-full" style={{ zIndex: Z.PANEL_BUTTON }}>
      <div className="flex items-center gap-2 flex-1 w-0 min-w-0 overflow-x-auto [scrollbar-width:none] py-1">
        <AIProviderSelector
          currentProviderId={currentProviderId}
          onCurrentProviderChange={onCurrentProviderChange}
          balanceRefreshSignal={providerBalanceRefreshSignal}
          persistSelectedProviderId={persistProviderSelection}
          dismissSignal={dismissSignal}
        />
        <AIAutoApproveDropdown
          settings={autoApprovalSettings}
          onPatchSettings={onPatchAutoApprovalSettings}
          disabled={false}
          dismissSignal={dismissSignal}
        />
        <AICollaborationPromptDropdown
          open={collaborationPromptOpen && alwaysAllowAssistantCollaboration}
          onOpenChange={setCollaborationPromptOpen}
          extraPrompt={collaborationExtraPrompt}
          onExtraPromptChange={onCollaborationExtraPromptChange}
          presets={collaborationPromptPresets}
          onPresetsChange={onCollaborationPromptPresetsChange}
          anchorRef={collaborationToggleRef}
          scopeIsTask={collaborationPromptScopeIsTask}
          dismissSignal={dismissSignal}
        />
        <Tiptop text={t('建议长程任务开启')}>
          <button
            ref={collaborationToggleRef}
            type="button"
            aria-label={t('助理协同')}
            aria-pressed={alwaysAllowAssistantCollaboration}
            disabled={!canToggleAssistantCollaboration}
            onClick={handleToggleAssistantCollaboration}
            onContextMenu={(event) => {
              event.preventDefault();
              if (alwaysAllowAssistantCollaboration) {
                setCollaborationPromptOpen((previous) => !previous);
              }
            }}
            className={cn(
              'h-7 inline-flex items-center gap-2 px-2.5 rounded-[var(--radius-sm)] border text-sm font-medium',
              'transition-colors duration-[80ms] whitespace-nowrap',
              'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
              alwaysAllowAssistantCollaboration
                ? 'border-accent-border bg-accent-dim text-primary cursor-pointer'
                : 'border-line bg-transparent text-secondary cursor-pointer',
            )}>
            <span>{t('助理协同')}</span>
            <Switch indicator checked={alwaysAllowAssistantCollaboration} size="sm" />
          </button>
        </Tiptop>
        <Tiptop text={t('开启后对话仅在本次软件运行期间保留')}>
          <button
            type="button"
            aria-label={t('临时会话')}
            aria-pressed={temporarySessionEnabled}
            disabled={typeof onTemporarySessionEnabledChange !== 'function'}
            onClick={() => onTemporarySessionEnabledChange?.(!temporarySessionEnabled)}
            className={cn(
              'h-7 inline-flex items-center gap-2 px-2.5 rounded-[var(--radius-sm)] border text-sm font-medium',
              'transition-colors duration-[80ms] whitespace-nowrap',
              'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
              temporarySessionEnabled
                ? 'border-accent-border bg-accent-dim text-primary cursor-pointer'
                : 'border-line bg-transparent text-secondary cursor-pointer',
            )}>
            <span>{t('临时会话')}</span>
            <Switch indicator checked={temporarySessionEnabled} size="sm" />
          </button>
        </Tiptop>
      </div>
    </div>
  );
}
