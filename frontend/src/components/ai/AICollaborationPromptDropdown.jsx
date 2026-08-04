import { Check, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../i18n.js'

function normalizePresets(values) {
  if (!Array.isArray(values)) {
    return []
  }
  const seen = new Set()
  const normalized = []
  values.forEach((value, index) => {
    const text = typeof value?.text === 'string' ? value.text.replace(/\r\n/g, '\n').trim() : ''
    if (!text) {
      return
    }
    const rawId = typeof value?.id === 'string' ? value.id.trim() : ''
    const id = rawId || `collab-preset-${index + 1}`
    if (seen.has(id)) {
      return
    }
    const rawTitle = typeof value?.title === 'string' ? value.title.trim() : ''
    seen.add(id)
    normalized.push({ id, title: rawTitle || text, text })
  })
  return normalized
}

function createPresetId() {
  return `collab-preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function IconButton({ title, onClick, children, danger = false }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--surface-base)',
        color: danger ? 'var(--danger)' : 'var(--text-secondary)',
        transition: 'var(--transition)',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
      }}>
      {children}
    </button>
  )
}

export default function AICollaborationPromptDropdown({
  open = false,
  onOpenChange,
  extraPrompt = '',
  onExtraPromptChange,
  presets = [],
  onPresetsChange,
  anchorRef,
  disabled = false,
  scopeIsTask = false,
  dismissSignal = 0,
}) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [triggerRect, setTriggerRect] = useState(null)
  const [panelBounds, setPanelBounds] = useState(null)
  const [editingPresetId, setEditingPresetId] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftText, setDraftText] = useState('')
  const normalizedPresets = useMemo(() => normalizePresets(presets), [presets])
  const isEditing = Boolean(editingPresetId)

  useEffect(() => {
    if (!open) {
      setTriggerRect(null)
      setPanelBounds(null)
      return undefined
    }
    const measure = () => {
      const el = anchorRef?.current
      if (!el) {
        return
      }
      const rect = el.getBoundingClientRect()
      const root = el.closest('[data-ai-panel-root="true"]')
      const rootRect = root?.getBoundingClientRect()
      setTriggerRect(rect)
      if (rootRect && rootRect.width > 0) {
        setPanelBounds({ left: rootRect.left, width: rootRect.width })
      } else {
        setPanelBounds(null)
      }
    }
    measure()
    const handleResize = () => measure()
    const handlePointerDown = (event) => {
      const anchorEl = anchorRef?.current
      if (panelRef.current?.contains(event.target)) {
        return
      }
      if (anchorEl?.contains(event.target)) {
        return
      }
      onOpenChange?.(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [anchorRef, onOpenChange, open])

  useEffect(() => {
    onOpenChange?.(false)
  }, [dismissSignal])

  useEffect(() => {
    if (!open) {
      setEditingPresetId('')
      setDraftTitle('')
      setDraftText('')
    }
  }, [open])

  const persistPresets = (nextPresets) => {
    onPresetsChange?.(normalizePresets(nextPresets))
  }

  const handleStartCreate = () => {
    setEditingPresetId('new')
    setDraftTitle('')
    setDraftText('')
  }

  const handleStartEdit = (preset) => {
    setEditingPresetId(preset.id)
    setDraftTitle(preset.title)
    setDraftText(preset.text)
  }

  const handleCancelEdit = () => {
    setEditingPresetId('')
    setDraftTitle('')
    setDraftText('')
  }

  const handleSubmitEdit = () => {
    const nextText = draftText.replace(/\r\n/g, '\n').trim()
    if (!nextText) {
      return
    }
    const nextTitle = draftTitle.trim() || nextText
    if (editingPresetId === 'new') {
      persistPresets([...normalizedPresets, { id: createPresetId(), title: nextTitle, text: nextText }])
    } else {
      persistPresets(normalizedPresets.map((preset) => (
        preset.id === editingPresetId ? { ...preset, title: nextTitle, text: nextText } : preset
      )))
    }
    handleCancelEdit()
  }

  const handleDeletePreset = (presetId) => {
    persistPresets(normalizedPresets.filter((preset) => preset.id !== presetId))
    if (editingPresetId === presetId) {
      handleCancelEdit()
    }
  }

  const handleApplyPreset = (preset) => {
    const currentValue = typeof extraPrompt === 'string' ? extraPrompt : ''
    const nextValue = currentValue.trim()
      ? `${currentValue.replace(/\s+$/u, '')}\n${preset.text}`
      : preset.text
    onExtraPromptChange?.(nextValue)
  }

  if (!open || !triggerRect || disabled) {
    return null
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        ...(panelBounds ? { left: panelBounds.left } : { left: triggerRect.left }),
        bottom: window.innerHeight - triggerRect.top + 8,
        width: panelBounds?.width ?? 320,
        maxWidth: panelBounds?.width ? `${panelBounds.width}px` : 'min(320px, calc(100vw - 32px))',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface-overlay)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        zIndex: 10000,
      }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t('助理协同')}</div>
          <IconButton title={t('关闭')} onClick={() => onOpenChange?.(false)}>
            <X size={12} />
          </IconButton>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {t('开启后,主助手想要问你问题或想要结束或完成任务时,将先由助理协助为您做出进一步的决定.')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {t('你可以在下面写几句要求,告诉助理替你协助时要注意什么.')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {scopeIsTask ? t('下面的要求只对当前这个任务生效') : t('下面的要求会作为以后新建任务的默认值')}
        </div>
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 10, overflowX: 'hidden' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{t('你的要求')}</div>
          <textarea
            id="ai-collab-extra-prompt"
            name="ai-collab-extra-prompt"
            value={typeof extraPrompt === 'string' ? extraPrompt : ''}
            onChange={(event) => onExtraPromptChange?.(event.target.value)}
            placeholder={t('例如: 能自己判断的就别问我,遇到删文件这种事一定要先问我')}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 84,
              resize: 'vertical',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              boxSizing: 'border-box',
              outline: 'none',
              fontSize: 12,
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-base)', display: 'grid', gap: 10, overflowX: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>{t('常用要求')}</div>
            <IconButton title={t('新增一条')} onClick={handleStartCreate}>
              <Plus size={12} />
            </IconButton>
          </div>
          {isEditing ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                id="ai-collab-draft-title"
                name="ai-collab-draft-title"
                autoComplete="off"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={t('起个短名字,留空就用下面的内容')}
                style={{
                  width: '100%',
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: 12,
                }}
              />
              <textarea
                id="ai-collab-draft-text"
                name="ai-collab-draft-text"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder={t('这条要求的具体内容')}
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: 64,
                  resize: 'vertical',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSubmitEdit}
                  disabled={!draftText.trim()}
                  style={{
                    flex: 1,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--accent-border)',
                    background: 'rgba(var(--accent-rgb), 0.14)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'var(--transition)',
                    opacity: draftText.trim() ? 1 : 0.45,
                    cursor: draftText.trim() ? 'pointer' : 'not-allowed',
                  }}>
                  {t('保存')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    flex: 1,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'var(--transition)',
                    cursor: 'pointer',
                  }}>
                  {t('取消')}
                </button>
              </div>
            </div>
          ) : null}
          {normalizedPresets.length === 0 && !isEditing ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              {t('还没有保存过要求,点右上角加号新建一条')}
            </div>
          ) : null}
          {normalizedPresets.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
              {normalizedPresets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                  }}>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    title={preset.text}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0,
                    }}>
                    <Check size={12} color="var(--accent)" />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.title}</span>
                  </button>
                  <IconButton title={t('编辑')} onClick={() => handleStartEdit(preset)}>
                    <Pencil size={11} />
                  </IconButton>
                  <IconButton title={t('删除')} danger={true} onClick={() => handleDeletePreset(preset.id)}>
                    <X size={11} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}