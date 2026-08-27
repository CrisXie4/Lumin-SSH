import { CommandChip } from './AutoApproveWidgets.tsx';
import {
  ADD_BUTTON_CLASS,
  COMMAND_INPUT_CLASS,
  EXECUTE_APPROVAL_MODE_OPTIONS,
  SECTION_HINT_CLASS,
  type AutoApprovalSettings,
  type ExecuteApprovalMode,
} from './autoApproveTypes.ts';
import type { I18nKey } from '../../../i18n.ts';

export interface AIAutoApproveExecuteSectionProps {
  normalizedSettings: AutoApprovalSettings;
  commandInput: string;
  deniedCommandInput: string;
  setCommandInput: (val: string) => void;
  setDeniedCommandInput: (val: string) => void;
  handleExecuteApprovalModeChange: (mode: ExecuteApprovalMode) => void;
  handleAddAllowedCommand: () => void;
  handleAddDeniedCommand: () => void;
  handleRemoveAllowedCommand: (command: string) => void;
  handleRemoveDeniedCommand: (command: string) => void;
  t: (key: I18nKey, vars?: Record<string, unknown>) => string;
}

export default function AIAutoApproveExecuteSection({
  normalizedSettings,
  commandInput,
  deniedCommandInput,
  setCommandInput,
  setDeniedCommandInput,
  handleExecuteApprovalModeChange,
  handleAddAllowedCommand,
  handleAddDeniedCommand,
  handleRemoveAllowedCommand,
  handleRemoveDeniedCommand,
  t,
}: AIAutoApproveExecuteSectionProps) {
  if (!normalizedSettings.alwaysAllowExecute) {
    return null;
  }

  return (
    <div className="px-3 pb-3 grid gap-3 overflow-x-hidden">
      <div className="p-3 rounded-[var(--radius-md)] border border-line bg-canvas grid gap-3 overflow-x-hidden">
        <div className="text-primary text-sm font-bold">{t('执行')}</div>
        <div className="grid gap-1.5">
          <div className="text-primary text-sm font-semibold">{t('执行规则')}</div>
          <div role="group" className="grid grid-cols-3 p-0.5 gap-0.5 border border-line-subtle rounded-[var(--radius-sm)] bg-sunken">
            {EXECUTE_APPROVAL_MODE_OPTIONS.map((option) => {
              const active = normalizedSettings.executeApprovalMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleExecuteApprovalModeChange(option.value)}
                  className={`min-w-0 h-7 rounded-[6px] text-xs font-medium flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis ${
                    active
                      ? 'bg-accent text-white font-semibold shadow-xs'
                      : 'bg-transparent text-secondary hover:text-primary hover:bg-hover/60'
                  }`}>
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
          <div className={SECTION_HINT_CLASS}>
            {t('基本规则按命令白名单执行,只读批准保留变更命令白名单,全部批准自动放行全部命令.')}
          </div>
        </div>
        <div className="grid gap-1.5">
          <div className="text-primary text-sm font-semibold">{t('命令白名单')}</div>
          <div className={SECTION_HINT_CLASS}>
            {t('当前启用时可以自动执行的命令前缀.')}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <input
              id="ai-auto-approve-allowed"
              name="ai-auto-approve-allowed"
              autoComplete="off"
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAddAllowedCommand();
                }
              }}
              placeholder={t("输入命令前缀(例如 'git')")}
              className={COMMAND_INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => void handleAddAllowedCommand()}
              className={ADD_BUTTON_CLASS}>
              {t('添加')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 min-w-0 overflow-hidden">
            {normalizedSettings.allowedCommands.map((command) => (
              <CommandChip key={command} text={command} onRemove={() => void handleRemoveAllowedCommand(command)} />
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <div className="text-primary text-sm font-semibold">{t('拒绝的命令')}</div>
          <div className={SECTION_HINT_CLASS}>
            {t('将自动拒绝的命令前缀,无需用户批准;与许可命令冲突时,最长前缀匹配优先.')}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <input
              id="ai-auto-approve-denied"
              name="ai-auto-approve-denied"
              autoComplete="off"
              value={deniedCommandInput}
              onChange={(event) => setDeniedCommandInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAddDeniedCommand();
                }
              }}
              placeholder={t("输入要拒绝的命令前缀(例如 'rm -rf')")}
              className={COMMAND_INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => void handleAddDeniedCommand()}
              className={ADD_BUTTON_CLASS}>
              {t('添加')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 min-w-0 overflow-hidden">
            {normalizedSettings.deniedCommands.map((command) => (
              <CommandChip key={command} text={command} onRemove={() => void handleRemoveDeniedCommand(command)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
