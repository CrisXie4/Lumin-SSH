import { normalizeAIConversationSnapshot, publishAIConversationUpsert } from './aiConversationBridge.js'

function getAppBridge() {
  return window?.go?.wailsapp?.AIBindings || window?.go?.wailsapp?.App
}

export function normalizeAIConversationBackup(backup) {
  return {
    id: typeof backup?.id === 'string' ? backup.id.trim() : '',
    ts: typeof backup?.ts === 'number' ? backup.ts : 0,
    message: typeof backup?.message === 'string' ? backup.message : '',
    messageRole: typeof backup?.messageRole === 'string' ? backup.messageRole : '',
    type: typeof backup?.type === 'string' ? backup.type : 'auto',
  }
}

export function normalizeAIConversationBackupHistoryEntry(entry) {
  return {
    role: typeof entry?.role === 'string' ? entry.role : '',
    content: typeof entry?.content === 'string' || Array.isArray(entry?.content) ? entry.content : '',
    ts: typeof entry?.ts === 'number' ? entry.ts : 0,
    messageId: typeof entry?.messageId === 'string' ? entry.messageId : '',
    uiMessageIds: Array.isArray(entry?.uiMessageIds) ? entry.uiMessageIds.filter((item) => typeof item === 'string') : [],
    images: Array.isArray(entry?.images) ? entry.images.filter((item) => typeof item === 'string') : [],
  }
}

export async function listAIConversationBackups(conversationId) {
  const bridge = getAppBridge()
  if (!bridge?.ListAIConversationBackups) {
    return []
  }
  const result = await bridge.ListAIConversationBackups(conversationId)
  return Array.isArray(result) ? result.map(normalizeAIConversationBackup) : []
}

export async function getAIConversationBackupHistory(conversationId, backupId) {
  const bridge = getAppBridge()
  if (!bridge?.GetAIConversationBackupHistory) {
    return []
  }
  const result = await bridge.GetAIConversationBackupHistory(conversationId, backupId)
  return Array.isArray(result) ? result.map(normalizeAIConversationBackupHistoryEntry) : []
}

export async function restoreAIConversationBackup(conversationId, backupId) {
  const bridge = getAppBridge()
  if (!bridge?.RestoreAIConversationBackup) {
    return null
  }
  const snapshot = normalizeAIConversationSnapshot(await bridge.RestoreAIConversationBackup(conversationId, backupId))
  publishAIConversationUpsert(snapshot)
  return snapshot
}

export async function deleteAIConversationBackup(conversationId, backupId) {
  const bridge = getAppBridge()
  if (!bridge?.DeleteAIConversationBackup) {
    return
  }
  await bridge.DeleteAIConversationBackup(conversationId, backupId)
}