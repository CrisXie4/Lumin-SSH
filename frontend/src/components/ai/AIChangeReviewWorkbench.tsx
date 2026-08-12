import { ArrowDown, ArrowUp } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation, type I18nKey } from '../../i18n.ts'
import { DiffEditorPair, type DiffNavigateTarget } from './AIDiffViewerPair.tsx'

interface AIChangeReviewWorkbenchProps {
  review: {
    reviewId: string;
    path?: string;
    toolName?: string;
    pathParams?: unknown;
    blocks?: unknown[];
  } | null;
  queueLength?: number;
  previewOnly?: boolean;
  onClose?: (() => void) | null;
}

export default function AIChangeReviewWorkbench({ review, queueLength = 1, previewOnly = false, onClose = null }: AIChangeReviewWorkbenchProps) {
  const { t } = useTranslation()

  if (!review) {
    return null
  }

  const blocks = Array.isArray(review.blocks) ? review.blocks : []
  const path = typeof review.path === 'string' ? review.path : ''
  const pathParams = review?.pathParams && typeof review.pathParams === 'object' ? review.pathParams as Record<string, unknown> : undefined
  const toolName = typeof review.toolName === 'string' ? review.toolName : ''
  const reviewId = typeof review.reviewId === 'string' && review.reviewId.trim() ? review.reviewId.trim() : 'change-review'
  const showBlockBadge = blocks.length > 1
  const diffNavigationRef = useRef<((target: DiffNavigateTarget) => void) | null>(null)
  const handlePrimaryDiffNavigateReady = (navigate: ((target: DiffNavigateTarget) => void) | null) => {
    diffNavigationRef.current = typeof navigate === 'function' ? navigate : null
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
          gridTemplateRows: '44px minmax(0, 1fr)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-overlay)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}>
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-raised)',
          }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {toolName ? (
              <div
                style={{
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  borderRadius: 6,
                  background: 'var(--surface-base)',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                {toolName}
              </div>
            ) : null}
            <div
              style={{
                minWidth: 0,
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {/* path 为动态 key（可能不在翻译表），t() 内部有兜底 */}
              {path ? t(path as I18nKey, pathParams) : t('修改')}
            </div>
            {!previewOnly && queueLength > 1 ? (
              <div
                style={{
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  borderRadius: 6,
                  background: 'rgba(var(--warning-rgb), 0.12)',
                  color: 'var(--warning)',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                {`${t('队列')} ${queueLength}`}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => diffNavigationRef.current?.('previous')}
              title={t('上一个')}
              aria-label={t('上一个')}
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-base)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => diffNavigationRef.current?.('next')}
              title={t('下一个')}
              aria-label={t('下一个')}
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-base)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              <ArrowDown size={14} />
            </button>
            {previewOnly && typeof onClose === 'function' ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('关闭')}
                style={{
                  width: 28,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-base)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>
                ×
              </button>
            ) : null}
          </div>
        </div>
        <div
          style={{
            minHeight: 0,
            padding: 8,
            overflow: 'auto',
            display: 'grid',
            gap: 8,
            gridTemplateRows: blocks.length <= 1 ? '1fr' : `repeat(${blocks.length}, minmax(320px, 1fr))`,
            background: 'var(--surface-base)',
          }}>
          {blocks.length > 0 ? blocks.map((block, index) => (
            <DiffEditorPair
              onNavigateReady={index === 0 ? handlePrimaryDiffNavigateReady : null}
              key={`review-block-${reviewId}-${index}`}
              block={block}
              index={index}
              path={path}
              reviewId={reviewId}
              showBlockBadge={showBlockBadge}
              t={t}
            />
          )) : (
            <div
              style={{
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-base)',
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}>
              {t('暂无可预览差异')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
