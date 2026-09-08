import type React from 'react';
import { useTranslation } from '../../../i18n.ts';
import type { AISystemPromptPreset } from '../aiGlobalSettingsBridge.ts';
import { normalizeOptionalNumber, type ProviderDraft } from './quickEditTypes.ts';
import QuickEditSystemPromptSection from './QuickEditSystemPromptSection.tsx';
import { StyledCheckbox } from './QuickEditWidgets.tsx';

export interface QuickEditAdvancedTabProps {
  active: boolean;
  draft: ProviderDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProviderDraft>>;
  providerDefinition?: { value: string };
  systemPromptPresets: AISystemPromptPreset[];
  systemPromptPresetsSaving: boolean;
  systemPromptPresetsError: string;
  onSystemPromptPresetsChange: (presets: AISystemPromptPreset[]) => Promise<void>;
}

export default function QuickEditAdvancedTab({
  active,
  draft,
  setDraft,
  providerDefinition,
  systemPromptPresets,
  systemPromptPresetsSaving,
  systemPromptPresetsError,
  onSystemPromptPresetsChange,
}: QuickEditAdvancedTabProps) {
  const { t } = useTranslation();
  const isResponsesProvider = (providerDefinition?.value || draft.provider) === 'Responses';
  const customHeaders = Array.isArray(draft.customHeaders) ? draft.customHeaders : [];
  const updateCustomHeader = (index: number, field: 'name' | 'value', value: string) => {
    setDraft((previous) => ({
      ...previous,
      customHeaders: previous.customHeaders.map((header, headerIndex) => (
        headerIndex === index ? { ...header, [field]: value } : header
      )),
    }));
  };

  return (
    <div className={`${active ? 'grid' : 'hidden'} gap-1.5 py-0.5`}>
      <div className="grid gap-1 py-2 px-2.5 border border-line rounded-[var(--radius-md)] bg-overlay">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="ai-provider-temperature" className="text-sm font-semibold text-primary">Temperature</label>
          <StyledCheckbox
            checked={draft.modelTemperature !== null}
            onChange={(checked) => setDraft((prev) => ({
              ...prev,
              modelTemperature: checked ? (prev.modelTemperature ?? 0) : null,
            }))}>
            {t('启用自定义温度')}
          </StyledCheckbox>
        </div>
        {draft.modelTemperature !== null ? (
          <input
            id="ai-provider-temperature"
            name="ai-provider-temperature"
            autoComplete="off"
            type="number"
            inputMode="decimal"
            step="any"
            value={draft.modelTemperature}
            onChange={(event) => setDraft((prev) => ({
              ...prev,
              modelTemperature: normalizeOptionalNumber(event.target.value),
            }))}
            className="h-[34px] w-full rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 box-border outline-none"
          />
        ) : (
          <div className="text-xs leading-[1.25] text-tertiary">{t('关闭后不发送该参数')}</div>
        )}
      </div>
      <div className="grid gap-1 py-2 px-2.5 border border-line rounded-[var(--radius-md)] bg-overlay">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="ai-provider-top-p" className="text-sm font-semibold text-primary">{t('Top P')}</label>
          <StyledCheckbox
            checked={draft.modelTopP !== null}
            onChange={(checked) => setDraft((prev) => ({
              ...prev,
              modelTopP: checked ? (prev.modelTopP ?? 1) : null,
            }))}>
            {t('启用自定义 Top P')}
          </StyledCheckbox>
        </div>
        {draft.modelTopP !== null ? (
          <input
            id="ai-provider-top-p"
            name="ai-provider-top-p"
            autoComplete="off"
            type="number"
            inputMode="decimal"
            step="any"
            value={draft.modelTopP}
            onChange={(event) => setDraft((prev) => ({
              ...prev,
              modelTopP: normalizeOptionalNumber(event.target.value),
            }))}
            className="h-[34px] w-full rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 box-border outline-none"
          />
        ) : (
          <div className="text-xs leading-[1.25] text-tertiary">{t('关闭后不发送该参数')}</div>
        )}
      </div>
      <div className="grid gap-2 py-2 px-2.5 border border-line rounded-[var(--radius-md)] bg-overlay">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-primary">{t('自定义请求头')}</div>
          <button
            type="button"
            onClick={() => setDraft((previous) => ({
              ...previous,
              customHeaders: [...previous.customHeaders, { name: '', value: '' }],
            }))}
            className="h-7 px-2 inline-flex items-center rounded-[var(--radius-sm)] border border-line bg-canvas text-secondary text-xs font-medium hover:bg-hover hover:text-primary transition-colors duration-[120ms]">
            + {t('添加请求头')}
          </button>
        </div>
        <div className="text-xs leading-[1.35] text-tertiary">
          {t('会追加到该供应商的模型刷新、对话和联网请求。名称非空即会发送，值可以留空。')}
        </div>
        {customHeaders.length > 0 ? (
          <div className="grid gap-1.5">
            {customHeaders.map((header, index) => (
              <div key={`${header.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] gap-1.5 items-center">
                <input
                  aria-label={t('请求头名称')}
                  autoComplete="off"
                  value={header.name}
                  placeholder="X-Custom-Header"
                  onChange={(event) => updateCustomHeader(index, 'name', event.target.value)}
                  className="h-[32px] min-w-0 rounded-[var(--radius-sm)] border border-line bg-sunken text-primary text-sm px-2 box-border outline-none"
                />
                <input
                  aria-label={t('请求头值')}
                  autoComplete="off"
                  value={header.value}
                  placeholder={t('请求头值')}
                  onChange={(event) => updateCustomHeader(index, 'value', event.target.value)}
                  className="h-[32px] min-w-0 rounded-[var(--radius-sm)] border border-line bg-sunken text-primary text-sm px-2 box-border outline-none"
                />
                <button
                  type="button"
                  aria-label={t('删除请求头')}
                  title={t('删除请求头')}
                  onClick={() => setDraft((previous) => ({
                    ...previous,
                    customHeaders: previous.customHeaders.filter((_, headerIndex) => headerIndex !== index),
                  }))}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-transparent bg-transparent text-tertiary hover:bg-danger/15 hover:text-danger transition-colors duration-[120ms]">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <QuickEditSystemPromptSection
        draft={draft}
        setDraft={setDraft}
        presets={systemPromptPresets}
        saving={systemPromptPresetsSaving}
        saveError={systemPromptPresetsError}
        onPresetsChange={onSystemPromptPresetsChange}
      />
      {isResponsesProvider ? (
        <div className="grid gap-1 py-2 px-2.5 border border-line rounded-[var(--radius-md)] bg-overlay">
          <StyledCheckbox
            checked={draft.openAiResponsesFinishOnCompletedEvent === true}
            onChange={(checked) => setDraft((prev) => ({
              ...prev,
              openAiResponsesFinishOnCompletedEvent: checked,
            }))}>
            <span className="text-sm font-semibold text-primary">{t('不等待[Done]流')}</span>
          </StyledCheckbox>
          <div className="text-xs leading-[1.25] text-tertiary">
            {t('部分上游端点在发出 response.completed 终态事件后既不下发 [DONE] 哨兵帧, 也不关闭 SSE 连接, 导致响应流在末尾空转直到读取超时. 开启后以终态事件作为流结束判据, 本轮已接收的正文, 推理与用量指标仍会完整交给后续处理, 不会丢弃.')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
