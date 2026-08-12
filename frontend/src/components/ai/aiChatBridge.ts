// 桥接模块（自 .js 收编后类型化）：AI 对话会话操作转发（wails 桥）
import { t } from '../../i18n.ts'

/** wails 桥接形状（AIBindings/App 的并集，运行时按存在性守卫） */
interface AIChatBridgeShape {
  StartAIChat?: (requestId: string, payload: string) => Promise<unknown>
  CancelAIChat?: (requestId: string) => Promise<unknown>
  ApproveAIChatTools?: (requestId: string) => Promise<unknown>
  RejectAIChatTools?: (requestId: string) => Promise<unknown>
  RejectAIChatToolsForQueuedSubmission?: (requestId: string) => Promise<unknown>
  ResolveAIChatFollowup?: (requestId: string, answer: string, images: string) => Promise<unknown>
  StartAIChatCollaboration?: (requestId: string) => Promise<unknown>
  DisableAIChatCollaboration?: (requestId: string) => Promise<unknown>
  SetAIChatSkipNextAutomaticRequest?: (requestId: string, enabled: boolean) => Promise<unknown>
  ContinueAIChatTool?: (requestId: string) => Promise<unknown>
  TerminateAIChatTool?: (requestId: string) => Promise<unknown>
  PreviewAIChatToolRestore?: (reviewId: string, sessionId: string) => Promise<unknown>
  PreviewAIChatToolDiff?: (reviewId: string, sessionId: string) => Promise<unknown>
  RestoreAIChatTool?: (reviewId: string, sessionId: string) => Promise<unknown>
  ListAIChatCommandTerminalCandidates?: (requestId: string) => Promise<unknown>
  AssignAIChatToolTerminal?: (requestId: string, targetSessionId: string) => Promise<unknown>
}

function getAppBridge(): AIChatBridgeShape | null {
  return (window?.go?.wailsapp?.AIBindings || window?.go?.wailsapp?.App) as AIChatBridgeShape | null
}

export async function startAIChat(requestId: string, payload: unknown): Promise<string> {
  const bridge = getAppBridge()
  if (!bridge?.StartAIChat) {
    throw new Error(t('AI 对话能力未就绪'))
  }
  await bridge.StartAIChat(requestId, JSON.stringify(payload))
  return requestId
}

export async function cancelAIChat(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.CancelAIChat) {
    return
  }
  await bridge.CancelAIChat(requestId)
}

export async function approveAIChatTools(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.ApproveAIChatTools) {
    throw new Error(t('工具批准能力未就绪'))
  }
  await bridge.ApproveAIChatTools(requestId)
}

export async function rejectAIChatTools(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.RejectAIChatTools) {
    throw new Error(t('工具拒绝能力未就绪'))
  }
  await bridge.RejectAIChatTools(requestId)
}

export async function rejectAIChatToolsForQueuedSubmission(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.RejectAIChatToolsForQueuedSubmission) {
    throw new Error(t('队列打断工具能力未就绪'))
  }
  await bridge.RejectAIChatToolsForQueuedSubmission(requestId)
}

export async function resolveAIChatFollowup(requestId: string, answer: unknown, images: unknown[] = []): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.ResolveAIChatFollowup) {
    throw new Error(t('追问回复能力未就绪'))
  }
  const normalizedAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer || {})
  const normalizedImages = Array.isArray(images)
    ? images.filter((item) => typeof item === 'string' && item.trim())
    : []
  await bridge.ResolveAIChatFollowup(requestId, normalizedAnswer, JSON.stringify(normalizedImages))
}

export async function startAIChatCollaboration(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.StartAIChatCollaboration) {
    return
  }
  await bridge.StartAIChatCollaboration(requestId)
}

export async function disableAIChatCollaboration(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.DisableAIChatCollaboration) {
    return
  }
  await bridge.DisableAIChatCollaboration(requestId)
}

export async function setAIChatSkipNextAutomaticRequest(requestId: string, enabled: unknown): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.SetAIChatSkipNextAutomaticRequest) {
    throw new Error(t('跳过下一次自动请求能力未就绪'))
  }
  await bridge.SetAIChatSkipNextAutomaticRequest(requestId, Boolean(enabled))
}

export async function continueAIChatTool(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.ContinueAIChatTool) {
    throw new Error(t('工具继续能力未就绪'))
  }
  await bridge.ContinueAIChatTool(requestId)
}

export async function terminateAIChatTool(requestId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.TerminateAIChatTool) {
    throw new Error(t('工具终止能力未就绪'))
  }
  await bridge.TerminateAIChatTool(requestId)
}

export async function previewAIChatToolRestore(reviewId: string, sessionId: string): Promise<unknown> {
  const bridge = getAppBridge()
  if (!bridge?.PreviewAIChatToolRestore) {
    throw new Error(t('还原预览能力未就绪'))
  }
  return bridge.PreviewAIChatToolRestore(reviewId, sessionId)
}

export async function previewAIChatToolDiff(reviewId: string, sessionId: string): Promise<unknown> {
  const bridge = getAppBridge()
  if (!bridge?.PreviewAIChatToolDiff) {
    throw new Error(t('差异预览能力未就绪'))
  }
  return bridge.PreviewAIChatToolDiff(reviewId, sessionId)
}

export async function restoreAIChatTool(reviewId: string, sessionId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.RestoreAIChatTool) {
    throw new Error(t('还原能力未就绪'))
  }
  await bridge.RestoreAIChatTool(reviewId, sessionId)
}

/** AI 命令终端候选（ListAIChatCommandTerminalCandidates 返回项） */
export interface AIChatTerminalCandidate {
  sessionId: string
  current?: boolean
  [key: string]: unknown
}

export async function listAIChatCommandTerminalCandidates(requestId: string): Promise<AIChatTerminalCandidate[]> {
  const bridge = getAppBridge()
  if (!bridge?.ListAIChatCommandTerminalCandidates) {
    throw new Error(t('终端候选能力未就绪'))
  }
  const result = await bridge.ListAIChatCommandTerminalCandidates(requestId)
  return Array.isArray(result) ? result as AIChatTerminalCandidate[] : []
}

export async function assignAIChatToolTerminal(requestId: string, targetSessionId: string): Promise<void> {
  const bridge = getAppBridge()
  if (!bridge?.AssignAIChatToolTerminal) {
    throw new Error(t('终端指派能力未就绪'))
  }
  await bridge.AssignAIChatToolTerminal(requestId, targetSessionId)
}
