import type React from 'react';
import { useTranslation } from '../../../i18n.ts';
import { normalizeOptionalNumber, type ProviderDraft } from './quickEditTypes.ts';
import { StyledCheckbox } from './QuickEditWidgets.tsx';

export interface QuickEditAdvancedTabProps {
  active: boolean;
  draft: ProviderDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProviderDraft>>;
  providerDefinition?: { value: string };
}

export default function QuickEditAdvancedTab({
  active,
  draft,
  setDraft,
  providerDefinition,
}: QuickEditAdvancedTabProps) {
  const { t } = useTranslation();
  const isResponsesProvider = (providerDefinition?.value || draft.provider) === 'Responses';

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
