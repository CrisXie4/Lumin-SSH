import { Columns2, FileText, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Tiptop from '../Tiptop.jsx'
import { useTranslation } from '../../i18n.js'

function normalizeItems(items) {
  return Array.isArray(items)
    ? items
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `conversation-diff-item-${index}`,
        messageId: typeof item.messageId === 'string' ? item.messageId.trim() : '',
        artifactPath: typeof item.artifactPath === 'string' ? item.artifactPath.trim() : '',
        toolName: typeof item.toolName === 'string' ? item.toolName.trim() : '',
        title: typeof item.title === 'string' ? item.title.trim() : '',
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        status: typeof item.status === 'string' ? item.status.trim() : '',
        copyContent: typeof item.copyContent === 'string' ? item.copyContent : '',
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      }))
      .filter((item) => item.artifactPath)
    : []
}

function normalizeCompactDiffText(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : ''
}

function buildCompactDiffRows(rawDiff, maxVisibleLines = 24) {
  const lines = normalizeCompactDiffText(rawDiff).split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length <= maxVisibleLines) {
    return lines.map((text, index) => ({ type: 'line', text, key: `line-${index}` }))
  }
  const headCount = Math.min(16, Math.max(10, maxVisibleLines - 6))
  const tailCount = Math.max(5, maxVisibleLines - headCount)
  const hiddenCount = Math.max(lines.length - headCount - tailCount, 0)
  return [
    ...lines.slice(0, headCount).map((text, index) => ({ type: 'line', text, key: `head-${index}` })),
    ...(hiddenCount > 0 ? [{ type: 'hidden', count: hiddenCount, key: 'hidden' }] : []),
    ...lines.slice(lines.length - tailCount).map((text, index) => ({ type: 'line', text, key: `tail-${index}` })),
  ]
}

function resolveCompactDiffRowPalette(text) {
  if (typeof text !== 'string') {
    return { color: 'var(--text-secondary)', background: 'transparent' }
  }
  if (text.startsWith('@@')) {
    return { color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.08)' }
  }
  if (text.startsWith('+') && !text.startsWith('+++')) {
    return { color: 'var(--success)', background: 'rgba(var(--success-rgb), 0.10)' }
  }
  if (text.startsWith('-') && !text.startsWith('---')) {
    return { color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.10)' }
  }
  if (text.startsWith('diff --git') || text.startsWith('index ') || text.startsWith('---') || text.startsWith('+++')) {
    return { color: 'var(--text-secondary)', background: 'rgba(var(--accent-rgb), 0.05)' }
  }
  return { color: 'var(--text-primary)', background: 'transparent' }
}

function CompactDiffPreview({ rawDiff = '', loading = false, t, maxHeight = 340 }) {
  const normalizedRawDiff = typeof rawDiff === 'string' ? rawDiff.trim() : ''
  const rows = useMemo(() => buildCompactDiffRows(normalizedRawDiff), [normalizedRawDiff])
  if (loading) {
    return (
      <div style={{ minHeight: maxHeight, padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <LoaderCircle size={14} className="spin" />
        <span>{t('加载中...')}</span>
      </div>
    )
  }
  if (!normalizedRawDiff) {
    return (
      <div style={{ minHeight: maxHeight, padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {t('暂无可预览差异')}
      </div>
    )
  }
  return (
    <div style={{ minHeight: maxHeight, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', overflow: 'hidden' }}>
      <div style={{ maxHeight, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px' }}>
        {rows.map((row, index) => {
          if (row.type === 'hidden') {
            return (
              <div
                key={row.key}
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-tertiary)',
                  background: 'rgba(var(--accent-rgb), 0.04)',
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                {`··· ${row.count} ···`}
              </div>
            )
          }
          const palette = resolveCompactDiffRowPalette(row.text)
          return (
            <div
              key={row.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(0, 1fr)',
                minWidth: 0,
                background: palette.background,
                borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.02)',
              }}>
              <div
                style={{
                  padding: '0 8px 0 10px',
                  color: 'var(--text-tertiary)',
                  textAlign: 'right',
                  borderRight: '1px solid var(--border-subtle)',
                  userSelect: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                {index + 1}
              </div>
              <div
                style={{
                  padding: '0 10px',
                  color: palette.color,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  minWidth: 0,
                }}>
                {row.text || ' '}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AIConversationDiffOverlay({
  sessionLabel = '',
  items = [],
  reviewByArtifactPath = {},
  loadingByArtifactPath = {},
  selectedMessageId = '',
  onSelectItem,
  onPreviewRestore,
  onApplyRestore,
  onClose,
}) {
  const { t } = useTranslation()
  const [copiedItemId, setCopiedItemId] = useState('')
  const [actionSucceeded, setActionSucceeded] = useState({ itemId: '', kind: '' })
  const normalizedItems = useMemo(() => normalizeItems(items), [items])
  const activeItem = useMemo(() => (
    normalizedItems.find((item) => item.messageId === selectedMessageId)
    || normalizedItems[0]
    || null
  ), [normalizedItems, selectedMessageId])

  useEffect(() => {
    if (!copiedItemId) {
      return undefined
    }
    const timer = window.setTimeout(() => setCopiedItemId(''), 1200)
    return () => window.clearTimeout(timer)
  }, [copiedItemId])

  useEffect(() => {
    if (!actionSucceeded.itemId) {
      return undefined
    }
    const timer = window.setTimeout(() => setActionSucceeded({ itemId: '', kind: '' }), 1200)
    return () => window.clearTimeout(timer)
  }, [actionSucceeded])

  const handleCopyItemContent = async (item) => {
    const itemId = typeof item?.id === 'string' ? item.id : ''
    const review = item?.artifactPath && reviewByArtifactPath && typeof reviewByArtifactPath === 'object'
      ? reviewByArtifactPath[item.artifactPath] || null
      : null
    const copyContent = typeof item?.copyContent === 'string' && item.copyContent.trim()
      ? item.copyContent.trim()
      : typeof review?.rawDiff === 'string' && review.rawDiff.trim()
        ? review.rawDiff.trim()
        : ''
    if (!itemId || !copyContent) {
      return
    }
    try {
      await navigator.clipboard.writeText(copyContent)
      setCopiedItemId(itemId)
    } catch {}
  }

  const handlePreviewItemRestore = async (item) => {
    const artifactPath = typeof item?.artifactPath === 'string' ? item.artifactPath.trim() : ''
    const itemId = typeof item?.id === 'string' ? item.id : ''
    if (!artifactPath) {
      return
    }
    const applied = await onPreviewRestore?.(artifactPath)
    if (applied === true && itemId) {
      setActionSucceeded({ itemId, kind: 'apply' })
    }
  }

  const handleApplyItemRestore = async (event, item) => {
    const artifactPath = typeof item?.artifactPath === 'string' ? item.artifactPath.trim() : ''
    const itemId = typeof item?.id === 'string' ? item.id : ''
    if (!artifactPath) {
      return
    }
    event.preventDefault()
    const applied = await onApplyRestore?.(artifactPath)
    if (applied === true && itemId) {
      setActionSucceeded({ itemId, kind: 'restore' })
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 6,
        background: 'rgba(0, 0, 0, 0.18)',
        backdropFilter: 'blur(4px)',
      }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateRows: '64px minmax(0, 1fr)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--surface-overlay)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-raised)',
          }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                background: 'rgba(var(--accent-rgb), 0.14)',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
              <Columns2 size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{t('当前对话文件变更')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sessionLabel ? t('会话 · {label}', { label: sessionLabel }) : t('当前对话文件变更')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('关闭')}
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}>
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            minHeight: 0,
            overflow: 'auto',
            padding: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: 14,
            alignContent: 'start',
          }}>
          {normalizedItems.map((item) => {
            const isActive = activeItem?.id === item.id
            const isCopied = copiedItemId === item.id
            const isActionSucceeded = actionSucceeded.itemId === item.id
            const itemActionKind = isActionSucceeded ? actionSucceeded.kind : ''
            const itemTitle = item.title || item.toolName || item.id
            const itemSummary = item.summary && item.summary !== itemTitle ? item.summary : ''
            const review = item.artifactPath && reviewByArtifactPath && typeof reviewByArtifactPath === 'object'
              ? reviewByArtifactPath[item.artifactPath] || null
              : null
            const currentRawDiff = typeof review?.rawDiff === 'string' ? review.rawDiff : ''
            const currentLoading = item.artifactPath && loadingByArtifactPath && typeof loadingByArtifactPath === 'object'
              ? loadingByArtifactPath[item.artifactPath] === true
              : false
            const itemCopyCharacterCount = typeof item.copyContent === 'string' && item.copyContent.trim()
              ? item.copyContent.trim().length
              : currentRawDiff.trim()
                ? currentRawDiff.trim().length
                : 0
            return (
              <div
                key={item.id}
                style={{
                  width: '100%',
                  minHeight: 520,
                  padding: 14,
                  borderRadius: 14,
                  border: isActive ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  background: isActive ? 'rgba(var(--accent-rgb), 0.10)' : 'var(--surface-base)',
                  color: 'inherit',
                  display: 'grid',
                  gridTemplateRows: 'auto auto 1fr',
                  gap: 12,
                  minWidth: 0,
                }}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 8,
                    padding: 0,
                    minWidth: 0,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isActive ? 'rgba(var(--accent-rgb), 0.18)' : 'rgba(255,255,255,0.06)',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        flexShrink: 0,
                      }}>
                      <FileText size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', wordBreak: 'break-all', overflowWrap: 'anywhere', lineHeight: 1.45 }}>
                        {item.order}. {itemTitle}
                      </div>
                    </div>
                  </div>
                  {itemSummary ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {itemSummary}
                    </div>
                  ) : null}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(var(--accent-rgb), 0.20)',
                      background: 'rgba(var(--accent-rgb), 0.06)',
                      color: 'var(--text-tertiary)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                    {item.toolName || (item.status ? t(item.status) : t('已完成'))}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {itemCopyCharacterCount > 0 ? (
                      <Tiptop text={isCopied ? t('已复制') : t('复制完整 diff/内容')} style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyItemContent(item)}
                          style={{
                            height: 24,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '0 8px',
                            borderRadius: 999,
                            border: isCopied ? '1px solid rgba(var(--success-rgb), 0.28)' : '1px solid rgba(var(--accent-rgb), 0.24)',
                            background: isCopied ? 'rgba(var(--success-rgb), 0.10)' : 'rgba(var(--accent-rgb), 0.08)',
                            color: isCopied ? 'var(--success)' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}>
                          <FileText size={11} color={isCopied ? 'currentColor' : 'var(--accent)'} />
                          <span>{isCopied ? t('已复制') : String(itemCopyCharacterCount)}</span>
                        </button>
                      </Tiptop>
                    ) : null}
                    {item.artifactPath ? (
                      <Tiptop text={isActionSucceeded ? (itemActionKind === 'restore' ? t('已还原') : t('已应用')) : t('左键应用/右键还原')} style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          onClick={() => {
                            void handlePreviewItemRestore(item)
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onContextMenu={(event) => {
                            void handleApplyItemRestore(event, item)
                          }}
                          style={{
                            height: 24,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '0 8px',
                            borderRadius: 999,
                            border: isActionSucceeded ? '1px solid rgba(var(--success-rgb), 0.28)' : '1px solid rgba(var(--accent-rgb), 0.24)',
                            background: isActionSucceeded ? 'rgba(var(--success-rgb), 0.10)' : 'rgba(var(--accent-rgb), 0.08)',
                            color: isActionSucceeded ? 'var(--success)' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}>
                          <RotateCcw size={11} color={isActionSucceeded ? 'currentColor' : 'var(--accent)'} />
                          <span>{isActionSucceeded ? (itemActionKind === 'restore' ? t('已还原') : t('已应用')) : t('应用')}</span>
                        </button>
                      </Tiptop>
                    ) : null}
                  </div>
                </div>
                <CompactDiffPreview rawDiff={currentRawDiff} loading={currentLoading} t={t} maxHeight={360} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}