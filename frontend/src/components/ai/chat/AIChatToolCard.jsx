import { ChevronDown, FileCode2, FileText, RotateCcw, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Tiptop from '../../Tiptop.jsx'
import { useTranslation } from '../../../i18n.js'
import AIChatMarkdown from './AIChatMarkdown.jsx'

function normalizeAIMessageStatus(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCompactDiffText(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : ''
}

function buildCompactDiffRows(rawDiff, maxVisibleLines = 18) {
  const lines = normalizeCompactDiffText(rawDiff).split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length <= maxVisibleLines) {
    return lines.map((text, index) => ({ type: 'line', text, key: `line-${index}` }))
  }
  const headCount = Math.min(12, Math.max(8, maxVisibleLines - 4))
  const tailCount = Math.max(4, maxVisibleLines - headCount)
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

function CompactDiffPreview({ rawDiff = '', loading = false, t }) {
  const normalizedRawDiff = typeof rawDiff === 'string' ? rawDiff.trim() : ''
  const rows = useMemo(() => buildCompactDiffRows(normalizedRawDiff), [normalizedRawDiff])
  if (loading) {
    return (
      <div style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', color: 'var(--text-secondary)', fontSize: 12 }}>
        {t('加载中...')}
      </div>
    )
  }
  if (!normalizedRawDiff) {
    return (
      <div style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', color: 'var(--text-secondary)', fontSize: 12 }}>
        {t('暂无可预览差异')}
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-base)', overflow: 'hidden' }}>
      <div style={{ maxHeight: 220, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px' }}>
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

export default function AIChatToolCard({ restoreArtifactPath = '', copyContent = '', actionLabel, title, summary, code, result = '', status, remainingFileEdits = 0, extra = {}, isLast = false, hasSubsequentAssistantMessage = false, onPreviewRestore, onPreviewDiffFetch, onApplyRestore }) {
  const { t } = useTranslation()
  const [isAutoExpanded, setIsAutoExpanded] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [restored, setRestored] = useState(false)
  const [inlineDiffReview, setInlineDiffReview] = useState(null)
  const [inlineDiffLoading, setInlineDiffLoading] = useState(false)

  useEffect(() => {
    if (isLast) {
      setIsAutoExpanded(true)
    }
  }, [isLast])

  useEffect(() => {
    if (hasSubsequentAssistantMessage) {
      setIsAutoExpanded(false)
    }
  }, [hasSubsequentAssistantMessage])

  useEffect(() => {
    if (!restored) {
      return undefined
    }
    const timer = window.setTimeout(() => setRestored(false), 1200)
    return () => window.clearTimeout(timer)
  }, [restored])

  const normalizedRestoreArtifactPath = typeof restoreArtifactPath === 'string' ? restoreArtifactPath.trim() : ''
  const showRevertTitleButton = ['apply_diff', 'write_to_file', 'search_replace', 'edit_file', 'apply_patch'].includes(String(actionLabel || '').trim())
  const showInlineDiffPreview = showRevertTitleButton && extra?.conversationDiffHasPreview === true && Boolean(normalizedRestoreArtifactPath) && typeof onPreviewDiffFetch === 'function'

  useEffect(() => {
    let cancelled = false
    if (!showInlineDiffPreview) {
      setInlineDiffReview(null)
      setInlineDiffLoading(false)
      return undefined
    }
    setInlineDiffLoading(true)
    onPreviewDiffFetch(normalizedRestoreArtifactPath)
      .then((review) => {
        if (cancelled) {
          return
        }
        setInlineDiffReview(review && typeof review === 'object' ? review : null)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setInlineDiffReview(null)
      })
      .finally(() => {
        if (!cancelled) {
          setInlineDiffLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [normalizedRestoreArtifactPath, onPreviewDiffFetch, showInlineDiffPreview])

  const normalizedStatus = useMemo(() => normalizeAIMessageStatus(status), [status])
  const expanded = isExpanded || ((isAutoExpanded && !hasSubsequentAssistantMessage) || ((normalizedStatus === '错误' || normalizedStatus === '已终止') && Boolean(result)))
  const statusPalette = useMemo(() => {
    switch (normalizedStatus) {
      case '待审阅':
      case '待批准':
        return {
          border: '1px solid rgba(var(--warning-rgb), 0.35)',
          background: 'rgba(var(--warning-rgb), 0.08)',
          color: 'var(--warning)',
        }
      case '执行中':
        return {
          border: '1px solid rgba(var(--accent-rgb), 0.35)',
          background: 'rgba(var(--accent-rgb), 0.08)',
          color: 'var(--accent)',
        }
      case '错误':
      case '已终止':
      case '已拒绝':
        return {
          border: '1px solid rgba(var(--danger-rgb), 0.35)',
          background: 'rgba(var(--danger-rgb), 0.08)',
          color: 'var(--danger)',
        }
      default:
        return {
          border: '1px solid rgba(var(--success-rgb), 0.35)',
          background: 'rgba(var(--success-rgb), 0.08)',
          color: 'var(--success)',
        }
    }
  }, [normalizedStatus])

  const normalizedRemainingFileEdits = Number.isFinite(Number(remainingFileEdits)) ? Math.max(0, Math.trunc(Number(remainingFileEdits))) : 0
  const showRemainingFileEdits = normalizedRemainingFileEdits > 0
  const normalizedCopyContent = typeof copyContent === 'string' ? copyContent.trim() : ''
  const copyCharacterCount = normalizedCopyContent ? normalizedCopyContent.length : 0
  const showCopyCharacterCount = copyCharacterCount > 0
  const resultTokenEstimateDisplay = typeof extra?.resultTokenEstimateDisplay === 'string' ? extra.resultTokenEstimateDisplay.trim() : ''
  const inlineDiffRaw = typeof inlineDiffReview?.rawDiff === 'string' ? inlineDiffReview.rawDiff : ''

  const handleToggleExpand = () => {
    setIsAutoExpanded(false)
    setIsExpanded((previous) => !previous)
  }

  const handlePreviewRestore = () => {
    if (!normalizedRestoreArtifactPath) {
      return
    }
    void onPreviewRestore?.(normalizedRestoreArtifactPath)
  }

  const handleApplyRestore = async () => {
    if (!normalizedRestoreArtifactPath) {
      return
    }
    const applied = await onApplyRestore?.(normalizedRestoreArtifactPath)
    if (applied === true) {
      setRestored(true)
    }
  }

  const handleCopyFullContent = async (event) => {
    event.stopPropagation()
    if (!normalizedCopyContent) {
      return
    }
    try {
      await navigator.clipboard.writeText(normalizedCopyContent)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
        <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <FileCode2 size={14} color="var(--text-secondary)" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t(title)}</span>
          {showCopyCharacterCount ? (
            <Tiptop text={copied ? t('已复制') : t('复制完整 diff/内容')} style={{ display: 'inline-flex' }}>
              <button
                type="button"
                onClick={handleCopyFullContent}
                style={{
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: copied ? '1px solid color-mix(in srgb, var(--success) 32%, var(--border))' : '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
                  background: copied ? 'color-mix(in srgb, var(--success) 10%, var(--surface-overlay))' : 'color-mix(in srgb, var(--accent) 8%, var(--surface-overlay))',
                  color: copied ? 'var(--success)' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}>
                <FileText size={11} color={copied ? 'currentColor' : 'var(--accent)'} />
                <span>{copied ? t('已复制') : String(copyCharacterCount)}</span>
              </button>
            </Tiptop>
          ) : null}
          {showRevertTitleButton ? (
            <Tiptop text={restored ? t('已还原') : t('左键预览/右键还原')} style={{ display: 'inline-flex' }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handlePreviewRestore()
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void handleApplyRestore()
                }}
                style={{
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: restored ? '1px solid color-mix(in srgb, var(--success) 32%, var(--border))' : '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
                  background: restored ? 'color-mix(in srgb, var(--success) 10%, var(--surface-overlay))' : 'color-mix(in srgb, var(--accent) 8%, var(--surface-overlay))',
                  color: restored ? 'var(--success)' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}>
                <RotateCcw size={11} color={restored ? 'currentColor' : 'var(--accent)'} />
                <span>{restored ? t('已还原') : t('还原')}</span>
              </button>
            </Tiptop>
          ) : null}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {status ? (
            <div style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', ...statusPalette }}>
              {t(normalizedStatus)}
            </div>
          ) : null}
          {resultTokenEstimateDisplay ? (
            <div style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))', background: 'color-mix(in srgb, var(--accent) 8%, var(--surface-overlay))', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {resultTokenEstimateDisplay}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleToggleExpand}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}>
            <ChevronDown
              size={14}
              color="var(--text-tertiary)"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms ease',
              }}
            />
          </button>
        </div>
      </div>
      <div style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
        <div
          style={{
            padding: '10px 12px',
            borderBottom: expanded || showInlineDiffPreview ? '1px solid var(--border-subtle)' : 'none',
            background: 'var(--surface-overlay)',
            display: 'grid',
            gap: 4,
          }}>
          {showRemainingFileEdits ? (
            <div
              style={{
                display: 'inline-flex',
                width: '100%',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                padding: '4px 8px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
                background: 'color-mix(in srgb, var(--accent) 8%, var(--surface-overlay))',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 700,
              }}>
              <SquarePen size={12} color="var(--accent)" />
              <span>{t('预计剩余 {count} 个编辑文件').replace('{count}', String(normalizedRemainingFileEdits))}</span>
            </div>
          ) : (
            <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>{actionLabel}</div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-all' }}>
            <AIChatMarkdown text={summary} enableQuoteContextMenu={true} />
          </div>
        </div>
        {showInlineDiffPreview ? (
          <div style={{ padding: '12px' }}>
            <CompactDiffPreview rawDiff={inlineDiffRaw} loading={inlineDiffLoading} t={t} />
          </div>
        ) : null}
        {expanded ? (
          <div style={{ display: 'grid', gap: 10, padding: '12px', borderTop: showInlineDiffPreview ? '1px solid var(--border-subtle)' : 'none' }}>
            <pre style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.65, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflowY: 'auto', overflowX: 'auto' }}>{code}</pre>
            {result ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('result')}</div>
                <pre style={{ margin: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-base)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.65, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflowY: 'auto', overflowX: 'auto' }}>{t(result)}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}