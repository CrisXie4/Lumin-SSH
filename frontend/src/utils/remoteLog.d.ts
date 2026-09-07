export interface FileManagerWorkspaceSummary {
  activeTabId: string
  tabCount: number
  tabIds: string[]
  tabPaths: string[]
}
export interface FileManagerWorkspaceMapSummary {
  sessionCount: number
  sessionIds: string[]
  workspaces: Record<string, FileManagerWorkspaceSummary>
}
export function summarizeFileManagerWorkspace(workspace: unknown): FileManagerWorkspaceSummary
export function summarizeFileManagerWorkspaceMap(workspaces: unknown): FileManagerWorkspaceMapSummary
export function addRemoteLog(payload: unknown): Promise<boolean>
export function addRemoteLogSeparator(): Promise<boolean>