import type { I18nKey } from '../../../../i18n.ts';

export function normalizeCompactDiffText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';
}

export function splitCompactDiffLines(value: unknown) {
  const normalized = normalizeCompactDiffText(value);
  if (normalized === '') {
    return [];
  }
  return normalized.split('\n');
}

/** 对齐后的左右行对 */
export interface CompactAlignedPair {
  left: string | null;
  right: string | null;
  equal: boolean;
}

/** 紧凑差异预览行 */
export type CompactDiffRow =
  | { type: 'file'; text: string; key: string }
  | { type: 'meta'; text: string; key: string; oldLineNumber: null; newLineNumber: null }
  | { type: 'add' | 'remove' | 'context'; text: string; key: string; oldLineNumber: number | null; newLineNumber: number | null }
  | { type: 'hidden'; count: number; key: string };

function buildCompactSegmentPairs(leftLines: string[], rightLines: string[]): CompactAlignedPair[] {
  const maxProduct = 32000;
  if (leftLines.length * rightLines.length > maxProduct) {
    const maxLength = Math.max(leftLines.length, rightLines.length);
    return Array.from({ length: maxLength }, (_, index) => ({
      left: index < leftLines.length ? leftLines[index] : null,
      right: index < rightLines.length ? rightLines[index] : null,
      equal: false,
    }));
  }
  return buildCompactAlignedLinePairs(leftLines, rightLines);
}

function buildLargeCompactAlignedLinePairs(leftLines: string[], rightLines: string[]): CompactAlignedPair[] {
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();
  leftLines.forEach((line) => leftCounts.set(line, (leftCounts.get(line) || 0) + 1));
  rightLines.forEach((line) => rightCounts.set(line, (rightCounts.get(line) || 0) + 1));
  const rightUniqueIndexes = new Map<string, number>();
  rightLines.forEach((line, index) => {
    if (rightCounts.get(line) === 1) {
      rightUniqueIndexes.set(line, index);
    }
  });
  const anchors: Array<{ leftIndex: number; rightIndex: number }> = [];
  let lastRightIndex = -1;
  leftLines.forEach((line, leftIndex) => {
    if (leftCounts.get(line) !== 1) {
      return;
    }
    const rightIndex = rightUniqueIndexes.get(line);
    if (rightIndex == null || rightIndex <= lastRightIndex) {
      return;
    }
    anchors.push({ leftIndex, rightIndex });
    lastRightIndex = rightIndex;
  });
  if (anchors.length === 0) {
    return buildCompactSegmentPairs(leftLines, rightLines);
  }
  const pairs: CompactAlignedPair[] = [];
  let leftStart = 0;
  let rightStart = 0;
  anchors.forEach(({ leftIndex, rightIndex }) => {
    pairs.push(...buildCompactSegmentPairs(
      leftLines.slice(leftStart, leftIndex),
      rightLines.slice(rightStart, rightIndex),
    ));
    pairs.push({ left: leftLines[leftIndex], right: rightLines[rightIndex], equal: true });
    leftStart = leftIndex + 1;
    rightStart = rightIndex + 1;
  });
  pairs.push(...buildCompactSegmentPairs(leftLines.slice(leftStart), rightLines.slice(rightStart)));
  return pairs;
}

export function buildCompactAlignedLinePairs(leftLines: string[], rightLines: string[]): CompactAlignedPair[] {
  const maxProduct = 32000;
  if (leftLines.length * rightLines.length > maxProduct) {
    return buildLargeCompactAlignedLinePairs(leftLines, rightLines);
  }
  const dp = Array.from({ length: leftLines.length + 1 }, () => new Array(rightLines.length + 1).fill(0));
  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        dp[leftIndex][rightIndex] = dp[leftIndex + 1][rightIndex + 1] + 1;
      } else {
        dp[leftIndex][rightIndex] = Math.max(dp[leftIndex + 1][rightIndex], dp[leftIndex][rightIndex + 1]);
      }
    }
  }
  const rawPairs = [];
  let leftCursor = 0;
  let rightCursor = 0;
  while (leftCursor < leftLines.length && rightCursor < rightLines.length) {
    if (leftLines[leftCursor] === rightLines[rightCursor]) {
      rawPairs.push({ left: leftLines[leftCursor], right: rightLines[rightCursor], equal: true });
      leftCursor += 1;
      rightCursor += 1;
      continue;
    }
    if (dp[leftCursor + 1][rightCursor] >= dp[leftCursor][rightCursor + 1]) {
      rawPairs.push({ left: leftLines[leftCursor], right: null, equal: false });
      leftCursor += 1;
    } else {
      rawPairs.push({ left: null, right: rightLines[rightCursor], equal: false });
      rightCursor += 1;
    }
  }
  while (leftCursor < leftLines.length) {
    rawPairs.push({ left: leftLines[leftCursor], right: null, equal: false });
    leftCursor += 1;
  }
  while (rightCursor < rightLines.length) {
    rawPairs.push({ left: null, right: rightLines[rightCursor], equal: false });
    rightCursor += 1;
  }
  const alignedPairs = [];
  let pairCursor = 0;
  while (pairCursor < rawPairs.length) {
    if (rawPairs[pairCursor].equal) {
      alignedPairs.push(rawPairs[pairCursor]);
      pairCursor += 1;
      continue;
    }
    const removed = [];
    const added = [];
    while (pairCursor < rawPairs.length && !rawPairs[pairCursor].equal) {
      if (rawPairs[pairCursor].left !== null) {
        removed.push(rawPairs[pairCursor].left);
      }
      if (rawPairs[pairCursor].right !== null) {
        added.push(rawPairs[pairCursor].right);
      }
      pairCursor += 1;
    }
    const maxLength = Math.max(removed.length, added.length);
    for (let index = 0; index < maxLength; index += 1) {
      alignedPairs.push({
        left: index < removed.length ? removed[index] : null,
        right: index < added.length ? added[index] : null,
        equal: false,
      });
    }
  }
  return alignedPairs;
}

export function buildCompactVisibleRanges(rows: Array<{ equal: boolean }>, contextLines = 4): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  rows.forEach((row, index) => {
    if (row.equal) {
      return;
    }
    const start = Math.max(0, index - contextLines);
    const end = Math.min(rows.length - 1, index + contextLines);
    const previousRange = ranges[ranges.length - 1];
    if (previousRange && start <= previousRange.end + 1) {
      previousRange.end = Math.max(previousRange.end, end);
      return;
    }
    ranges.push({ start, end });
  });
  return ranges;
}

export function buildCompactDiffRowsFromBlocks(blocks: unknown, t: (key: I18nKey, vars?: Record<string, unknown>) => string): CompactDiffRow[] {
  const rows: CompactDiffRow[] = [];
  const normalizedBlocks = Array.isArray(blocks) ? blocks.filter((block) => block && typeof block === 'object') : [];
  normalizedBlocks.forEach((block, blockIndex) => {
    const rawBlock = block as Record<string, unknown>;
    const beforeLines = splitCompactDiffLines(rawBlock.before);
    const afterLines = splitCompactDiffLines(rawBlock.after);
    const alignedPairs = buildCompactAlignedLinePairs(beforeLines, afterLines);
    let oldLineNumber = 1;
    let newLineNumber = 1;
    const pairRows = alignedPairs.map((pair) => {
      const nextRow = {
        equal: pair.equal,
        leftText: pair.left,
        rightText: pair.right,
        oldLineNumber: pair.left !== null ? oldLineNumber : null,
        newLineNumber: pair.right !== null ? newLineNumber : null,
      };
      if (pair.left !== null) {
        oldLineNumber += 1;
      }
      if (pair.right !== null) {
        newLineNumber += 1;
      }
      return nextRow;
    });
    const visibleRanges = buildCompactVisibleRanges(pairRows);
    if (visibleRanges.length === 0) {
      return;
    }
    const labelKey = typeof rawBlock.label === 'string' && rawBlock.label.trim() ? rawBlock.label.trim() : '文件 #{count}';
    const labelParams = rawBlock?.labelParams && typeof rawBlock.labelParams === 'object'
      ? rawBlock.labelParams as Record<string, unknown>
      : { count: blockIndex + 1 };
    rows.push({
      type: 'file',
      text: t(labelKey as I18nKey, labelParams),
      key: `file-${blockIndex}`,
    });
    let previousEnd = -1;
    visibleRanges.forEach((range, rangeIndex) => {
      if (range.start > previousEnd + 1) {
        rows.push({
          type: 'hidden',
          count: range.start - previousEnd - 1,
          key: `hidden-${blockIndex}-${rangeIndex}`,
        });
      }
      let pairIndex = range.start;
      while (pairIndex <= range.end) {
        const pairRow = pairRows[pairIndex];
        if (pairRow.equal) {
          rows.push({
            type: 'context',
            oldLineNumber: pairRow.oldLineNumber,
            newLineNumber: pairRow.newLineNumber,
            text: pairRow.leftText ?? pairRow.rightText ?? '',
            key: `context-${blockIndex}-${pairIndex}`,
          });
          pairIndex += 1;
          continue;
        }
        const removedRows: CompactDiffRow[] = [];
        const addedRows: CompactDiffRow[] = [];
        while (pairIndex <= range.end && !pairRows[pairIndex].equal) {
          const changedRow = pairRows[pairIndex];
          if (changedRow.leftText !== null) {
            removedRows.push({
              type: 'remove',
              oldLineNumber: changedRow.oldLineNumber,
              newLineNumber: null,
              text: changedRow.leftText,
              key: `remove-${blockIndex}-${pairIndex}`,
            });
          }
          if (changedRow.rightText !== null) {
            addedRows.push({
              type: 'add',
              oldLineNumber: null,
              newLineNumber: changedRow.newLineNumber,
              text: changedRow.rightText,
              key: `add-${blockIndex}-${pairIndex}`,
            });
          }
          pairIndex += 1;
        }
        rows.push(...removedRows, ...addedRows);
      }
      previousEnd = range.end;
    });
    if (previousEnd < pairRows.length - 1) {
      rows.push({
        type: 'hidden',
        count: pairRows.length - previousEnd - 1,
        key: `hidden-tail-${blockIndex}`,
      });
    }
  });
  return rows;
}

export function buildCompactDiffRowsFromRawDiff(rawDiff: string): CompactDiffRow[] {
  const lines = normalizeCompactDiffText(rawDiff).split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((text, index): CompactDiffRow => {
    if (text.startsWith('diff --git')) {
      return { type: 'file', text, key: `raw-file-${index}` };
    }
    if (text.startsWith('@@') || text.startsWith('index ') || text.startsWith('---') || text.startsWith('+++')) {
      return { type: 'meta', oldLineNumber: null, newLineNumber: null, text, key: `raw-meta-${index}` };
    }
    if (text.startsWith('+') && !text.startsWith('+++')) {
      return { type: 'add', oldLineNumber: null, newLineNumber: null, text: text.slice(1), key: `raw-add-${index}` };
    }
    if (text.startsWith('-') && !text.startsWith('---')) {
      return { type: 'remove', oldLineNumber: null, newLineNumber: null, text: text.slice(1), key: `raw-remove-${index}` };
    }
    return {
      type: 'context',
      oldLineNumber: null,
      newLineNumber: null,
      text: text.startsWith(' ') ? text.slice(1) : text,
      key: `raw-context-${index}`,
    };
  });
}

export function buildCompactDiffRows(rawDiff: string, reviewBlocks: unknown, t: (key: I18nKey, vars?: Record<string, unknown>) => string): CompactDiffRow[] {
  const blockRows = buildCompactDiffRowsFromBlocks(reviewBlocks, t);
  if (blockRows.length > 0) {
    return blockRows;
  }
  return buildCompactDiffRowsFromRawDiff(rawDiff);
}

export function resolveCompactDiffRowPalette(row: CompactDiffRow) {
  switch (row?.type) {
    case 'file':
      return { color: 'var(--text-primary)', background: 'rgba(var(--accent-rgb), 0.08)' };
    case 'meta':
      return { color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.08)' };
    case 'add':
      return { color: 'var(--success)', background: 'rgba(var(--success-rgb), 0.10)' };
    case 'remove':
      return { color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.10)' };
    default:
      return { color: 'var(--text-primary)', background: 'transparent' };
  }
}
