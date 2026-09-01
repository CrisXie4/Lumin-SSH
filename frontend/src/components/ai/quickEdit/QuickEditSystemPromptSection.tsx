import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useTranslation } from '../../../i18n.ts';
import type { AISystemPromptPreset } from '../aiGlobalSettingsBridge.ts';
import type { ProviderDraft } from './quickEditTypes.ts';

export interface QuickEditSystemPromptSectionProps {
  draft: ProviderDraft;
  setDraft: Dispatch<SetStateAction<ProviderDraft>>;
  presets: AISystemPromptPreset[];
  saving: boolean;
  saveError: string;
  onPresetsChange: (presets: AISystemPromptPreset[]) => Promise<void>;
}

const PRESET_ROW_HEIGHT = 34;
const PRESET_LIST_MAX_HEIGHT = 128;

function createPresetID() {
  return `system-prompt-preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export default function QuickEditSystemPromptSection({
  draft,
  setDraft,
  presets,
  saving,
  saveError,
  onPresetsChange,
}: QuickEditSystemPromptSectionProps) {
  const { t } = useTranslation();
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingPresetID, setEditingPresetID] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');

  const selectedPreset = presets.find((preset) => preset.id === draft.systemPromptPresetId) || null;
  const presetListItems = useMemo<Array<AISystemPromptPreset | null>>(() => [null, ...presets], [presets]);
  const presetListHeight = Math.min(presetListItems.length * PRESET_ROW_HEIGHT, PRESET_LIST_MAX_HEIGHT);
  const managedPresetListHeight = Math.min(presets.length * PRESET_ROW_HEIGHT, PRESET_LIST_MAX_HEIGHT);
  const isEditingPreset = editingPresetID !== '';

  const resetPresetEditor = () => {
    setEditingPresetID('');
    setDraftTitle('');
    setDraftText('');
  };

  const persistPresets = async (nextPresets: AISystemPromptPreset[]) => {
    try {
      await onPresetsChange(nextPresets);
      return true;
    } catch {
      return false;
    }
  };

  const handleSelectPreset = (presetID: string) => {
    const preset = presets.find((item) => item.id === presetID);
    setDraft((prev) => ({
      ...prev,
      systemPromptPresetId: preset?.id || '',
      systemPromptAppend: preset?.text || prev.systemPromptAppend,
    }));
  };

  const handleStartCreate = () => {
    setManagerOpen(true);
    setEditingPresetID('new');
    setDraftTitle('');
    setDraftText('');
  };

  const handleStartEdit = (preset: AISystemPromptPreset) => {
    setManagerOpen(true);
    setEditingPresetID(preset.id);
    setDraftTitle(preset.title);
    setDraftText(preset.text);
  };

  const handleSavePreset = async () => {
    const text = draftText.replace(/\r\n/g, '\n').trim();
    if (!text || saving) {
      return;
    }
    const title = draftTitle.trim() || text;
    const nextPresets = editingPresetID === 'new'
      ? [...presets, { id: createPresetID(), title, text }]
      : presets.map((preset) => (preset.id === editingPresetID ? { ...preset, title, text } : preset));
    if (await persistPresets(nextPresets)) {
      resetPresetEditor();
    }
  };

  const handleDeletePreset = async (preset: AISystemPromptPreset) => {
    if (saving || !(await persistPresets(presets.filter((item) => item.id !== preset.id)))) {
      return;
    }
    if (draft.systemPromptPresetId === preset.id) {
      setDraft((prev) => ({ ...prev, systemPromptPresetId: '' }));
    }
    if (editingPresetID === preset.id) {
      resetPresetEditor();
    }
  };

  return (
    <div className="grid gap-2 py-2 px-2.5 border border-line rounded-[var(--radius-md)] bg-overlay">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="ai-provider-system-prompt-append" className="text-sm font-semibold text-primary">
          {t('追加系统提示词')}
        </label>
        <button
          type="button"
          onClick={() => setManagerOpen((open) => !open)}
          className="h-7 px-2 rounded-[var(--radius-sm)] border border-line bg-canvas text-secondary hover:bg-hover hover:text-primary text-xs font-semibold transition-colors duration-[120ms]">
          {managerOpen ? t('收起预设管理') : t('管理预设')}
        </button>
      </div>
      <div className="text-xs leading-[1.35] text-tertiary">
        {t('内容会追加在内置系统提示词之后,不会覆盖现有工具协议和安全规则.')}
      </div>
      <textarea
        id="ai-provider-system-prompt-append"
        name="ai-provider-system-prompt-append"
        value={draft.systemPromptAppend}
        onChange={(event) => setDraft((prev) => ({
          ...prev,
          systemPromptAppend: event.target.value,
          systemPromptPresetId: '',
        }))}
        placeholder={t('输入要追加给当前供应商的系统提示词')}
        spellCheck={false}
        className="w-full min-h-[128px] resize-y rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 py-2 box-border outline-none text-sm leading-[1.5] [font-family:inherit]"
      />
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-secondary">{t('预设')}</div>
          <button
            type="button"
            onClick={handleStartCreate}
            disabled={saving}
            className="h-8 px-2 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-line bg-canvas text-secondary hover:bg-hover hover:text-primary disabled:opacity-50 text-xs font-semibold transition-colors duration-[120ms]">
            <Plus size={13} />
            {t('新增预设')}
          </button>
        </div>
        <div
          className="overflow-hidden rounded-[var(--radius-sm)] bg-sunken outline outline-1 outline-[var(--border)]"
          style={{ height: `${presetListHeight}px` }}>
          <Virtuoso
            style={{ height: '100%' }}
            fixedItemHeight={PRESET_ROW_HEIGHT}
            data={presetListItems}
            itemContent={(_, preset) => (
              <button
                type="button"
                onClick={() => handleSelectPreset(preset?.id || '')}
                style={{ height: `${PRESET_ROW_HEIGHT}px` }}
                className={`flex w-full items-center gap-1.5 px-2 box-border text-left text-sm transition-colors duration-[120ms] ${
                  (preset?.id || '') === (selectedPreset?.id || '') ? 'bg-accent-dim text-accent font-semibold' : 'bg-overlay text-primary hover:bg-hover'
                }`}>
                {(preset?.id || '') === (selectedPreset?.id || '') ? <Check size={13} className="shrink-0" /> : null}
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{preset?.title || t('不使用预设')}</span>
              </button>
            )}
          />
        </div>
      </div>
      {managerOpen ? (
        <div className="grid gap-2 p-2.5 rounded-[var(--radius-sm)] border border-line bg-canvas">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-primary">{t('系统提示词预设')}</div>
            <button
              type="button"
              onClick={() => {
                setManagerOpen(false);
                resetPresetEditor();
              }}
              className="w-6 h-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-transparent bg-transparent text-secondary hover:bg-hover hover:text-primary">
              <X size={13} />
            </button>
          </div>
          {isEditingPreset ? (
            <div className="grid gap-2">
              <input
                id="ai-provider-system-prompt-preset-title"
                name="ai-provider-system-prompt-preset-title"
                autoComplete="off"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={t('预设名称,留空时使用提示词内容')}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 box-border outline-none text-sm"
              />
              <textarea
                id="ai-provider-system-prompt-preset-text"
                name="ai-provider-system-prompt-preset-text"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder={t('预设的系统提示词内容')}
                spellCheck={false}
                className="w-full min-h-[84px] resize-y rounded-[var(--radius-sm)] border border-line bg-sunken text-primary px-2.5 py-2 box-border outline-none text-sm leading-[1.5] [font-family:inherit]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={saving || !draftText.trim()}
                  className="flex-1 h-8 rounded-[var(--radius-sm)] border border-accent-border bg-accent-dim text-accent text-sm font-semibold disabled:opacity-50 transition-colors duration-[120ms]">
                  {t('保存预设')}
                </button>
                <button
                  type="button"
                  onClick={resetPresetEditor}
                  disabled={saving}
                  className="flex-1 h-8 rounded-[var(--radius-sm)] border border-line bg-transparent text-secondary hover:bg-hover disabled:opacity-50 text-sm font-semibold transition-colors duration-[120ms]">
                  {t('取消')}
                </button>
              </div>
            </div>
          ) : null}
          {presets.length === 0 && !isEditingPreset ? (
            <div className="text-xs leading-[1.35] text-tertiary">{t('还没有系统提示词预设,可从右上角新增一条')}</div>
          ) : null}
          {presets.length > 0 ? (
            <div
              className="overflow-hidden rounded-[var(--radius-sm)] bg-sunken outline outline-1 outline-[var(--border-subtle)]"
              style={{ height: `${managedPresetListHeight}px` }}>
              <Virtuoso
                style={{ height: '100%' }}
                fixedItemHeight={PRESET_ROW_HEIGHT}
                data={presets}
                itemContent={(_, preset) => (
                  <div className="flex min-w-0 items-center gap-1.5 bg-overlay box-border" style={{ height: `${PRESET_ROW_HEIGHT}px` }}>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`flex min-w-0 flex-1 h-full items-center gap-1.5 px-1.5 box-border text-left text-sm transition-colors duration-[120ms] ${
                        draft.systemPromptPresetId === preset.id ? 'bg-accent-dim text-accent font-semibold' : 'bg-transparent text-primary hover:bg-hover'
                      }`}>
                      {draft.systemPromptPresetId === preset.id ? <Check size={13} className="shrink-0" /> : null}
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{preset.title}</span>
                    </button>
                    <button
                      type="button"
                      title={t('编辑预设')}
                      onClick={() => handleStartEdit(preset)}
                      disabled={saving}
                      className="w-7 h-full shrink-0 inline-flex items-center justify-center border border-transparent bg-transparent text-secondary hover:bg-hover hover:text-primary disabled:opacity-50">
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title={t('删除预设')}
                      onClick={() => void handleDeletePreset(preset)}
                      disabled={saving}
                      className="w-7 h-full shrink-0 inline-flex items-center justify-center border border-transparent bg-transparent text-danger hover:bg-danger/15 disabled:opacity-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              />
            </div>
          ) : null}
          {saveError ? <div className="text-xs leading-[1.35] text-danger">{saveError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}