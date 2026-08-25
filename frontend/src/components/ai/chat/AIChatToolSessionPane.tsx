import AIChatCommandCard from './AIChatCommandCard.tsx'
import AIChatCompletionCard from './AIChatCompletionCard.tsx'
import AIChatFollowUpCard from './AIChatFollowUpCard.tsx'
import AIChatMCPCard from './AIChatMCPCard.tsx'
import AIChatToolCard from './AIChatToolCard.tsx'
import { cn } from '../../../utils/cn.ts'

/** 会话工具条目（来自 .tsx 父级；kind 区分卡片类型，各卡片按需取用字段） */
export interface AIChatToolSessionItem {
  kind: string;
  id: string;
  extra?: Record<string, unknown>;
  actionLabel?: string;
  title?: string;
  summary?: string;
  code?: string;
  result?: string;
  status?: string;
  remainingFileEdits?: number;
  purpose?: string;
  command?: string;
  output?: string;
  serverName?: string;
  toolName?: string;
  args?: string;
  response?: string;
  question?: string;
  questions?: string[];
  suggestions?: string[];
  requestId?: string;
}

interface AIChatToolSessionOptions {
  isLastAssistantTurn?: boolean;
  hasSubsequentAssistantMessage?: boolean;
  onSendUserMessage?: (text: string) => void;
  onPreviewRestore?: (artifactPath: string, targetTerminalId: string) => void;
  onPreviewDiffFetch?: (artifactPath: string, targetTerminalId: string) => void;
  onApplyRestore?: (artifactPath: string, targetTerminalId: string) => void;
  followupInteractionLocked?: boolean;
}

interface AIChatToolSessionPaneProps extends AIChatToolSessionOptions {
  items?: AIChatToolSessionItem[];
}

function renderToolItem(item: AIChatToolSessionItem, options: AIChatToolSessionOptions) {
  const { isLastAssistantTurn = false, hasSubsequentAssistantMessage = false, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked = false } = options
  switch (item.kind) {
    case 'tool':
      return <AIChatToolCard key={item.id} restoreArtifactPath={typeof item?.extra?.restoreArtifactPath === 'string' ? item.extra.restoreArtifactPath : ''} copyContent={typeof item?.extra?.copyContent === 'string' ? item.extra.copyContent : ''} actionLabel={item.actionLabel} title={item.title} summary={item.summary} code={item.code} result={item.result} status={item.status} remainingFileEdits={item.remainingFileEdits} extra={item.extra} isLast={isLastAssistantTurn} hasSubsequentAssistantMessage={hasSubsequentAssistantMessage} onPreviewRestore={onPreviewRestore as (path: string, targetTerminalId?: string) => void} onPreviewDiffFetch={onPreviewDiffFetch as (path: string, targetTerminalId?: string) => Promise<unknown>} onApplyRestore={onApplyRestore as (path: string, targetTerminalId?: string) => boolean | Promise<boolean | null | undefined>} />
    case 'completion':
      return <AIChatCompletionCard key={item.id} title={item.title} summary={item.summary} result={item.result} status={item.status} />
    case 'command':
      return <AIChatCommandCard key={item.id} purpose={item.purpose} command={item.command} output={item.output} status={item.status} extra={item.extra} />
    case 'mcp':
      return <AIChatMCPCard key={item.id} serverName={item.serverName} toolName={item.toolName} args={item.args} response={item.response} extra={item.extra} isLast={isLastAssistantTurn} hasSubsequentAssistantMessage={hasSubsequentAssistantMessage} />
    case 'followup':
      return (
        <div key={item.id} className={cn(followupInteractionLocked ? 'pointer-events-none opacity-60' : 'pointer-events-auto opacity-100')}>
          <AIChatFollowUpCard question={item.question} questions={item.questions || []} suggestions={item.suggestions || []} requestId={item.requestId} onSelectSuggestion={onSendUserMessage as (payload: unknown) => unknown} />
        </div>
      )
    default:
      return null
  }
}

export default function AIChatToolSessionPane({ items = [], isLastAssistantTurn = false, hasSubsequentAssistantMessage = false, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked = false }: AIChatToolSessionPaneProps) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2.5">
      {items.map((item) => renderToolItem(item, { isLastAssistantTurn, hasSubsequentAssistantMessage, onSendUserMessage, onPreviewRestore, onPreviewDiffFetch, onApplyRestore, followupInteractionLocked }))}
    </div>
  )
}
