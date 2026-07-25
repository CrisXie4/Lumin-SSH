import AIChatCommandCard from './AIChatCommandCard.jsx'
import AIChatCompletionCard from './AIChatCompletionCard.jsx'
import AIChatFollowUpCard from './AIChatFollowUpCard.jsx'
import AIChatMCPCard from './AIChatMCPCard.jsx'
import AIChatToolCard from './AIChatToolCard.jsx'

function renderToolItem(item, options) {
  const { isLastAssistantTurn = false, hasSubsequentAssistantMessage = false, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked = false } = options || {}
  switch (item.kind) {
    case 'tool':
      return <AIChatToolCard key={item.id} restoreArtifactPath={typeof item?.extra?.restoreArtifactPath === 'string' ? item.extra.restoreArtifactPath : ''} copyContent={typeof item?.extra?.copyContent === 'string' ? item.extra.copyContent : ''} actionLabel={item.actionLabel} title={item.title} summary={item.summary} code={item.code} result={item.result} status={item.status} remainingFileEdits={item.remainingFileEdits} extra={item.extra} isLast={isLastAssistantTurn} hasSubsequentAssistantMessage={hasSubsequentAssistantMessage} onPreviewRestore={onPreviewRestore} onPreviewDiffFetch={onPreviewDiffFetch} onApplyRestore={onApplyRestore} />
    case 'completion':
      return <AIChatCompletionCard key={item.id} title={item.title} summary={item.summary} result={item.result} status={item.status} />
    case 'command':
      return <AIChatCommandCard key={item.id} purpose={item.purpose} command={item.command} output={item.output} status={item.status} extra={item.extra} />
    case 'mcp':
      return <AIChatMCPCard key={item.id} serverName={item.serverName} toolName={item.toolName} args={item.args} response={item.response} extra={item.extra} isLast={isLastAssistantTurn} hasSubsequentAssistantMessage={hasSubsequentAssistantMessage} />
    case 'followup':
      return (
        <div key={item.id} style={{ pointerEvents: followupInteractionLocked ? 'none' : 'auto', opacity: followupInteractionLocked ? 0.6 : 1 }}>
          <AIChatFollowUpCard question={item.question} questions={item.questions || []} suggestions={item.suggestions || []} requestId={item.requestId} onSelectSuggestion={onSendUserMessage} />
        </div>
      )
    default:
      return null
  }
}

export default function AIChatToolSessionPane({ items = [], isLastAssistantTurn = false, hasSubsequentAssistantMessage = false, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => renderToolItem(item, { isLastAssistantTurn, hasSubsequentAssistantMessage, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked }))}
    </div>
  )
}