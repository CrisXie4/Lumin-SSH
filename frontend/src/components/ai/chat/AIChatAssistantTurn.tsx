import AIChatMessageActionBar from './AIChatMessageActionBar.tsx'
import AIChatAssistantBodyPane from './AIChatAssistantBodyPane.tsx'
import AIChatErrorBlock from './AIChatErrorBlock.tsx'
import AIChatReasoningBlock from './AIChatReasoningBlock.tsx'
import AIChatRequestStatusRow from './AIChatRequestStatusRow.tsx'
import AIChatToolSessionPane, { type AIChatToolSessionItem } from './AIChatToolSessionPane.tsx'
import { cn } from '../../../utils/cn.ts'

const assistantTitleKey = 'AI'

interface AIChatAssistantTurnProps {
  assistant?: {
    id?: string;
    title?: string;
    time?: string;
    text?: string;
    streaming?: boolean;
    extra?: Record<string, unknown>;
  };
  reasoning?: Array<{ id: string; text?: string; duration?: string }>;
  tools?: AIChatToolSessionItem[];
  isLastAssistantTurn?: boolean;
  hasSubsequentAssistantMessage?: boolean;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  onSendUserMessage?: (text: string) => void;
  onPreviewRestore?: (artifactPath: string, targetTerminalId: string) => void;
  onPreviewDiffFetch?: (artifactPath: string, targetTerminalId: string) => void;
  onApplyRestore?: (artifactPath: string, targetTerminalId: string) => void;
  onRestoreToHere?: (artifactPath: string, targetTerminalId: string) => void;
  onReapplyRestore?: (artifactPath: string, targetTerminalId: string) => void;
  followupInteractionLocked?: boolean;
  messageActionBarAtBottom?: boolean;
  perfMetricsText?: string;
}

export default function AIChatAssistantTurn({ assistant, reasoning = [], tools = [], isLastAssistantTurn = false, hasSubsequentAssistantMessage = false, onDelete, onRetry, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, onRestoreToHere, onReapplyRestore, followupInteractionLocked = false, messageActionBarAtBottom = false, perfMetricsText = '' }: AIChatAssistantTurnProps) {
  const title = assistant?.title || assistantTitleKey
  const time = assistant?.time || ''
  const assistantText = typeof assistant?.text === 'string' ? assistant.text.trim() : ''
  const assistantId = typeof assistant?.id === 'string' ? assistant.id : ''
  const hasReasoning = reasoning.length > 0
  const hasBody = Boolean(assistantText)
  const assistantErrorText = typeof assistant?.extra?.errorText === 'string' ? assistant.extra.errorText.trim() : ''
  const hasError = Boolean(assistantErrorText)
  const hasTools = tools.length > 0
  const completionItem = tools.find((item) => item?.kind === 'completion') || null
  const completionSummary = typeof completionItem?.summary === 'string' ? completionItem.summary.trim() : ''
  const completionResult = typeof completionItem?.result === 'string' ? completionItem.result.trim() : ''
  const completionCopyText = [completionSummary, completionResult].filter(Boolean).join('\n\n')
  const hasSectionBeforeReasoning = hasError
  const hasSectionBeforeBody = hasError || hasReasoning
  const hasSectionBeforeTools = hasError || hasReasoning || hasBody
  const hasSectionBeforeActionBar = hasError || hasReasoning || hasBody || hasTools
  const handleCopyText = () => {
    const nextText = completionCopyText || assistantText
    if (!nextText) {
      return
    }
    navigator.clipboard.writeText(nextText).catch(() => {})
  }
  const messageActions = [
    { key: 'retry', onClick: () => onRetry?.(assistantId) },
    { key: 'copy', onClick: handleCopyText },
    { key: 'delete', onClick: () => onDelete?.(assistantId) },
  ]
  const handleCopyPerfMetrics = perfMetricsText
    ? () => navigator.clipboard.writeText(perfMetricsText).catch(() => {})
    : undefined

  const renderActionBar = (showStatus: boolean) => (
    <AIChatMessageActionBar
      variant="assistant"
      title={title}
      time={time}
      actions={messageActions}
      status={showStatus ? <AIChatRequestStatusRow assistant={assistant} reasoning={reasoning} /> : null}
      onTitleIconClick={handleCopyPerfMetrics}
      titleIconClickTitle="复制本次发送耗时"
    />
  )

  return (
    <div className={cn('grid w-full', messageActionBarAtBottom ? 'gap-0' : 'gap-1.5')}>
      <div className={messageActionBarAtBottom ? 'hidden' : 'block'}>
        {renderActionBar(true)}
      </div>
      <div className={cn(
        'grid w-full gap-0 rounded-[var(--radius-md)] border border-line bg-overlay shadow-[inset_0_1px_0_var(--border-light)]',
        messageActionBarAtBottom ? 'px-3 pt-2.5' : 'px-3 py-2.5',
      )}>
        {hasError ? <AIChatErrorBlock text={assistantErrorText} /> : null}
        {hasReasoning ? (
          <div
            className={cn(
              'grid gap-2',
              hasSectionBeforeReasoning && 'border-t border-t-line-subtle pt-2.5',
              (hasBody || hasTools) && 'border-b border-b-line-subtle pb-2.5',
            )}
          >
            {reasoning.map((item, index) => (
              <AIChatReasoningBlock
                key={item.id}
                text={item.text}
                duration={item.duration}
                isStreaming={Boolean(assistant?.streaming) && index === reasoning.length - 1}
                isLast={isLastAssistantTurn && index === reasoning.length - 1}
              />
            ))}
          </div>
        ) : null}
        {hasBody ? (
          <div className={cn(hasSectionBeforeBody && !hasReasoning && 'border-t border-t-line-subtle pt-2.5')}>
            <AIChatAssistantBodyPane text={assistantText} isStreaming={Boolean(assistant?.streaming)} />
          </div>
        ) : null}
        {hasTools ? (
          <div className={cn(hasSectionBeforeTools && 'border-t border-t-line-subtle pt-2.5')}>
            <AIChatToolSessionPane items={tools} isLastAssistantTurn={isLastAssistantTurn} hasSubsequentAssistantMessage={hasSubsequentAssistantMessage} onSendUserMessage={onSendUserMessage} onPreviewRestore={onPreviewRestore} onPreviewDiffFetch={onPreviewDiffFetch} onApplyRestore={onApplyRestore} onRestoreToHere={onRestoreToHere} onReapplyRestore={onReapplyRestore} followupInteractionLocked={followupInteractionLocked} />
          </div>
        ) : null}
        <div className={cn(
          hasSectionBeforeActionBar && 'border-t border-t-line-subtle',
          messageActionBarAtBottom ? '-mx-3 block px-3' : 'hidden',
        )}>
          {renderActionBar(true)}
        </div>
      </div>
    </div>
  )
}
