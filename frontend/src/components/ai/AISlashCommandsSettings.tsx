import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation, t as translate } from '../../i18n.ts'
import { normalizeAISlashCommands, normalizeSlashCommandName } from './aiSlashCommands.ts'
import { handleInputDragSelectAll } from './inputDragSelect.ts'

/** 斜杠命令草稿（id 仅为本地编辑用，保存时由 normalizeAISlashCommands 重建） */
interface SlashCommandDraft {
  id: string
  name: string
  prompt: string
}

function buildDraftCommands(commands: unknown): SlashCommandDraft[] {
  return normalizeAISlashCommands(commands).map((command: { name?: unknown; prompt?: unknown }, index: number): SlashCommandDraft => ({
    // normalizeAISlashCommands 已保证 name/prompt 为字符串，.js 推断为 unknown 此处断言
    id: `slash-${index}-${command.name}`,
    name: command.name as string,
    prompt: command.prompt as string,
  }))
}

function createUniqueSlashCommandName(commands: SlashCommandDraft[]) {
  const existingNames = new Set(
    commands
      .map((command) => normalizeSlashCommandName(command?.name).toLowerCase())
      .filter(Boolean),
  )
  let counter = 1
  let candidate = 'command'
  while (existingNames.has(candidate)) {
    candidate = `command-${counter}`
    counter += 1
  }
  return candidate
}

function normalizeDraftCommands(commands: unknown) {
  return normalizeAISlashCommands(
    (Array.isArray(commands) ? commands : []).map((command: { name?: unknown; prompt?: unknown }) => ({
      name: command?.name,
      prompt: command?.prompt,
    })),
  )
}

function summarizePrompt(prompt: unknown) {
  const normalized = String(prompt || '').trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return translate('未填写提示词内容')
  }
  return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized
}

interface SlashCommandListItemProps {
  command: SlashCommandDraft
  onEdit: () => void
  onDelete: () => void
}

function SlashCommandListItem({ command, onEdit, onDelete }: SlashCommandListItemProps) {
  return (
    <div className="grid gap-1 px-4 py-3.5 border-b border-line-subtle min-w-0">
      <div className="flex items-center justify-between gap-2.5 min-w-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold text-primary">{command.name}</div>
        <div className="shrink-0 inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent text-secondary cursor-pointer">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent text-secondary cursor-pointer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="text-sm text-secondary leading-[1.6]">{summarizePrompt(command.prompt)}</div>
    </div>
  )
}

interface AISlashCommandsSettingsProps {
  slashCommands: unknown
  onSaveGlobalAISettings: (settings: { slashCommands: unknown }) => Promise<void> | void
}

export default function AISlashCommandsSettings({ slashCommands, onSaveGlobalAISettings }: AISlashCommandsSettingsProps) {
  const { t, lang } = useTranslation()
  const normalizedIncomingCommands = useMemo(() => normalizeAISlashCommands(slashCommands), [slashCommands])
  const sentenceEnd = lang === 'zh-CN' ? '。' : '.'
  const [draftCommands, setDraftCommands] = useState<SlashCommandDraft[]>(() => buildDraftCommands(normalizedIncomingCommands))
  const [editingCommandId, setEditingCommandId] = useState('')

  useEffect(() => {
    const nextDraftCommands = buildDraftCommands(normalizedIncomingCommands)
    setDraftCommands(nextDraftCommands)
    setEditingCommandId((currentId) => {
      if (!nextDraftCommands.some((command) => command.id === currentId)) {
        return ''
      }
      return currentId
    })
  }, [normalizedIncomingCommands])

  const normalizedDraftCommands = useMemo(() => normalizeDraftCommands(draftCommands), [draftCommands])
  const hasPendingChanges = useMemo(
    () => JSON.stringify(normalizedDraftCommands) !== JSON.stringify(normalizedIncomingCommands),
    [normalizedDraftCommands, normalizedIncomingCommands],
  )
  const editingCommand = draftCommands.find((command) => command.id === editingCommandId) || null

  const handleAddCommand = () => {
    const nextCommand: SlashCommandDraft = {
      id: `slash-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: createUniqueSlashCommandName(draftCommands),
      prompt: '',
    }
    setDraftCommands((previous) => [...previous, nextCommand])
    setEditingCommandId(nextCommand.id)
  }

  const handleRemoveCommand = async (commandId: string) => {
    let nextDraftCommands: SlashCommandDraft[] = []
    setDraftCommands((previous) => {
      nextDraftCommands = previous.filter((command) => command.id !== commandId)
      return nextDraftCommands
    })
    setEditingCommandId((currentId) => (currentId === commandId ? '' : currentId))
    if (typeof onSaveGlobalAISettings !== 'function') {
      return
    }
    await onSaveGlobalAISettings({
      slashCommands: normalizeDraftCommands(nextDraftCommands),
    })
  }

  const handlePatchEditingCommand = (patch: Partial<SlashCommandDraft>) => {
    if (!editingCommandId) {
      return
    }
    setDraftCommands((previous) => previous.map((command) => {
      if (command.id !== editingCommandId) {
        return command
      }
      return {
        ...command,
        ...patch,
      }
    }))
  }

  const handleSaveCommands = async () => {
    if (typeof onSaveGlobalAISettings !== 'function') {
      return
    }
    await onSaveGlobalAISettings({
      slashCommands: normalizeDraftCommands(draftCommands),
    })
    setEditingCommandId('')
  }

  return (
    <div className="grid gap-0">
      <div className="grid gap-1">
        <div className="text-[18px] font-bold text-primary leading-[1.3]">{t('斜杠命令')}</div>
        <div className="text-sm text-tertiary leading-[1.6]">
          {t('输入框与用户消息只显示')} <code>{t('斜杠命令占位符')}</code>{t('真正发送给 AI 时,会在后台注入命令完整提示词内容.')}
        </div>
      </div>
      <div className="grid gap-0">
        <button
          type="button"
          onClick={handleAddCommand}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-canvas text-primary text-lg font-bold cursor-pointer">
          <Plus size={16} />
          <span>{t('新增命令')}</span>
        </button>
        <div className="rounded-xl border border-line bg-canvas overflow-hidden">
          {draftCommands.length === 0 ? (
            <div className="p-4 text-tertiary text-base leading-[1.7]">
              {t('当前还没有斜杠命令.新增后即可在输入框中通过')} <code>{t('斜杠命令占位符')}</code> {t('进行选择.')}
            </div>
          ) : (
            draftCommands.map((command) => (
              <SlashCommandListItem
                key={command.id}
                command={command}
                onEdit={() => setEditingCommandId(command.id)}
                onDelete={() => handleRemoveCommand(command.id)}
              />
            ))
          )}
        </div>
      </div>
      {editingCommand ? (
        <div className="grid grid-rows-[auto_auto_1fr_auto] gap-3 min-h-[420px] p-3.5 rounded-xl border border-line bg-canvas">
          <div className="text-base font-bold text-primary">
            {`${t('编辑')} /${normalizeSlashCommandName(editingCommand.name) || t('未命名命令')}`}
          </div>
          <div className="grid gap-1.5">
            <label className="text-secondary text-sm font-semibold" htmlFor="ai-slash-command-name">{t('命令名')}</label>
            <input
              id="ai-slash-command-name"
              name="ai-slash-command-name"
              autoComplete="off"
              type="text"
              value={editingCommand.name}
              onChange={(event) => handlePatchEditingCommand({ name: event.target.value })}
              onMouseLeave={handleInputDragSelectAll}
              placeholder={t('例如 summarize')}
              className="w-full h-9 px-3 rounded-lg border border-line bg-overlay text-primary text-base outline-none"
            />
            <div className="text-tertiary text-xs leading-[1.5]">
              {t('仅允许字母,数字,点,下划线和中横线.输入时显示为')} <code>{t('斜杠命令占位符')}</code>{sentenceEnd}
            </div>
          </div>
          <div className="grid gap-1.5 min-h-0">
            <label className="text-secondary text-sm font-semibold" htmlFor="slash-command-prompt">{t('提示词内容')}</label>
            <textarea
              id="slash-command-prompt"
              name="slash-command-prompt"
              value={editingCommand.prompt}
              onChange={(event) => handlePatchEditingCommand({ prompt: event.target.value })}
              placeholder={t('填写实际注入给 AI 的提示词内容')}
              className="w-full min-h-0 h-full resize-none p-3 rounded-lg border border-line bg-overlay text-primary text-base leading-[1.6] outline-none whitespace-pre-wrap"
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-tertiary text-xs leading-[1.5]">
              {t('保存时会忽略名称非法,名称重复或提示词为空的条目.')}
            </div>
            <button
              type="button"
              onClick={() => void handleSaveCommands()}
              disabled={!hasPendingChanges}
              className={`h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-accent-border text-base font-bold transition-colors duration-[80ms] ${
                hasPendingChanges
                  ? 'bg-[rgba(var(--accent-rgb),0.12)] text-accent cursor-pointer'
                  : 'bg-overlay text-muted cursor-not-allowed'
              }`}>
              <Save size={14} />
              <span>{t('保存修改')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
