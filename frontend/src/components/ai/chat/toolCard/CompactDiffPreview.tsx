import { useMemo } from 'react';
import type { I18nKey } from '../../../../i18n.ts';
import { cn } from '../../../../utils/cn.ts';
import {
  buildCompactDiffRows,
  resolveCompactDiffRowPalette,
} from './compactDiffHelpers.ts';

export interface CompactDiffPreviewProps {
  reviewBlocks?: unknown;
  rawDiff?: string;
  loading?: boolean;
  t: (key: I18nKey, vars?: Record<string, unknown>) => string;
  lang: string;
  maxHeight?: number;
}

export default function CompactDiffPreview({ reviewBlocks = [], rawDiff = '', loading = false, t, lang, maxHeight = 300 }: CompactDiffPreviewProps) {
  const normalizedRawDiff = typeof rawDiff === 'string' ? rawDiff.trim() : '';
  const rows = useMemo(() => buildCompactDiffRows(normalizedRawDiff, reviewBlocks, t), [normalizedRawDiff, reviewBlocks, t, lang]);
  if (loading) {
    return (
      <div className="rounded-lg border border-line-subtle bg-canvas px-3 py-2.5 text-sm text-secondary">
        {t('加载中...')}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line-subtle bg-canvas px-3 py-2.5 text-sm text-secondary">
        {t('暂无可预览差异')}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line-subtle bg-canvas">
      <div className="overflow-auto overscroll-contain font-mono text-xs leading-[18px]" style={{ maxHeight }}>
        {rows.map((row, index) => {
          if (row.type === 'hidden') {
            return (
              <div
                key={row.key}
                className="border-y border-y-line-subtle bg-[rgba(var(--accent-rgb),0.04)] px-3 py-1.5 text-center tabular-nums text-tertiary">
                {`··· ${row.count} ···`}
              </div>
            );
          }
          const palette = resolveCompactDiffRowPalette(row);
          if (row.type === 'file') {
            return (
              <div
                key={row.key}
                style={{ background: palette.background, color: palette.color }}
                className={cn('break-all px-2.5 py-1.5 font-bold', index === 0 ? '' : 'border-t border-t-[rgba(255,255,255,0.02)]')}>
                {row.text}
              </div>
            );
          }
          const lineNumber = row.type === 'add'
            ? row.newLineNumber
            : row.oldLineNumber ?? row.newLineNumber;
          const sign = row.type === 'add' ? '+' : row.type === 'remove' ? '-' : '';
          return (
            <div
              key={row.key}
              style={{ background: palette.background }}
              className={cn('grid min-w-0 grid-cols-[48px_18px_minmax(0,1fr)]', index === 0 ? '' : 'border-t border-t-[rgba(255,255,255,0.02)]')}>
              <div
                className="select-none border-r border-r-line-subtle px-2 text-right tabular-nums text-tertiary">
                {lineNumber ?? ''}
              </div>
              <div
                style={{ color: palette.color }}
                className="select-none border-r border-r-line-subtle text-center tabular-nums">
                {sign}
              </div>
              <div
                style={{ color: palette.color }}
                className="min-w-0 whitespace-pre-wrap px-2.5 [overflow-wrap:anywhere] [word-break:break-word]">
                {row.text || ' '}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
