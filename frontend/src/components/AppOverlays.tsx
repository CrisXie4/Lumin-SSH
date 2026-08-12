import { Copy, PenLine, Search, X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import CredentialsModal from './CredentialsModal.tsx';
import ExportSelectedDialog from './ExportSelectedDialog.tsx';
import GlobalContextMenu from './GlobalContextMenu.tsx';
import GlobalDialog from './GlobalDialog.tsx';
import ImportExportDialog from './ImportExportDialog.tsx';
import PortForwardDialog from './PortForwardDialog.tsx';
import SerialConfigModal, { type SerialFormConfig } from './SerialConfigModal.tsx';
import SettingsModal from './SettingsModal.tsx';
import SyncFailureToast, { type SyncFailureState } from './SyncFailureToast.tsx';
import Tiptop from './Tiptop.tsx';
import Toast from './Toast.tsx';
import UpdateModal from './UpdateModal.tsx';
import type { PortForwardInitialMapping } from '../hooks/usePortForwardDialog.ts';
import type { SessionAuthPrompt } from '../hooks/useSessionConnections.ts';
import type { ToastAction, ToastItem } from '../hooks/useToasts.ts';
import type { ExportOptions } from '../hooks/useImportExport.ts';
import type { SessionLike } from '../utils/sessionWorkspace.ts';
import type { TopbarSession } from './AppTopbar.tsx';

/** 标签栏右键菜单 */
export interface TabContextMenuState {
  sessionId: string;
  x: number;
  y: number;
}

/** 终端子标签右键菜单（type=group 时分屏组） */
export interface TerminalTabContextMenuState {
  sessionId: string;
  terminalId: string;
  x: number;
  y: number;
  type: 'terminal' | 'group';
  terminalIds?: string[];
}

/** 编辑飞行动画元素（shape 来自 App.tsx 的组装；beam/capsule 为历史遗留分支无生产者，字段统一声明为必填以简化类型） */
interface EditFlyItem {
  id: string;
  type: string;
  field: string;
  from: { x: number; y: number };
  mid: { x: number; y: number };
  to: { x: number; y: number };
  at: { x: number; y: number };
  length: number;
  angle: number;
  delay: number;
  path: string;
  size: number;
  label: string;
  value?: string;
}

export interface AppOverlaysProps {
  dialogs: {
    activeAIDevilMode: boolean;
    closePortForwardDialog: () => void;
    connectSerial: (config: SerialFormConfig) => void;
    loadServers: () => Promise<void>;
    portForwardDialogSessionId: string | null;
    portForwardInitialMapping: PortForwardInitialMapping | null;
    portForwardInitialTab: string | null;
    probePanelPosition: 'left' | 'right';
    setProbePanelPosition: (pos: 'left' | 'right') => void;
    setSettingsInitialTab: (tab: string) => void;
    setShowCredentials: (v: boolean) => void;
    setShowSerialModal: (v: boolean) => void;
    setShowSettings: (v: boolean) => void;
    settingsInitialTab: string;
    showCredentials: boolean;
    showPortForwardDialog: boolean;
    showSerialModal: boolean;
    showSettings: boolean;
  };
  importExport: {
    exportSelectedIds: string[];
    handleDownloadTemplate: () => void;
    handleExport: (opts: ExportOptions) => void;
    handleExportSelected: (opts: ExportOptions) => void;
    handleImport: () => void;
    hasRecoveryPassword: boolean;
    ieBusy: boolean;
    setExportSelectedIds: (ids: string[]) => void;
    setShowExportSelectedDialog: (v: boolean) => void;
    setShowImportExportDialog: (v: boolean) => void;
    showExportSelectedDialog: boolean;
    showImportExportDialog: boolean;
  };
  notifications: {
    downloadProgress: number;
    handleApplyStartupUpdate: () => Promise<void>;
    handleToastAction: (id: number, action: ToastAction) => void;
    isUpdateModalVisible: boolean;
    removeToast: (id: number) => void;
    setIsUpdateModalVisible: (v: boolean) => void;
    setSyncFailed: Dispatch<SetStateAction<SyncFailureState | null>>;
    startupUpdateInfo: { version: string } | null;
    syncFailed: SyncFailureState | null;
    toasts: ToastItem[];
  };
  menus: {
    activeSessionId: string | null;
    canCopySessionPassword: (sessionId: string) => boolean;
    canMoveTerminalToDockTarget: (session: SessionLike, terminalId: string, target: string) => boolean;
    closeAllSessions: () => Promise<void>;
    closeSession: (sessionId: string, e?: React.MouseEvent) => Promise<void>;
    closeTerminal: (sessionId: string, terminalId: string, e?: React.MouseEvent) => void;
    closeTerminalGroup: (sessionId: string, layoutId: string, terminalIds: string[], e?: React.MouseEvent) => void;
    forceCloseSession: (sessionId: string) => void;
    handleCopySessionPassword: (sessionId: string) => Promise<void>;
    handleRenameTerminalTab: (sessionId: string, terminalId: string) => Promise<void>;
    handleTabClick: (sessionId: string) => void;
    isTerminalDockTargetOccupied: (session: SessionLike, terminalId: string, target: string) => boolean;
    moveTerminalToDockTarget: (session: SessionLike, terminalId: string, target: string) => void;
    sessionAuthPrompts: Record<string, SessionAuthPrompt>;
    sessionListPos: { x: number; y: number };
    sessionListQuery: string;
    sessionListRef: React.RefObject<HTMLDivElement>;
    sessions: TopbarSession[];
    setSessionListQuery: (q: string) => void;
    setShowSessionList: (v: boolean) => void;
    setTabContextMenu: (menu: TabContextMenuState | null) => void;
    setTerminalTabContextMenu: (menu: TerminalTabContextMenuState | null) => void;
    showSessionList: boolean;
    tabContextMenu: TabContextMenuState | null;
    terminalTabContextMenu: TerminalTabContextMenuState | null;
  };
  animation: {
    editFlyAnimation: { items: EditFlyItem[] } | null;
    editorModeBanner: { id: string; text: string } | null;
  };
  shared: {
    addToast: (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number;
    t: (key: string, vars?: Record<string, unknown>) => string;
  };
}

export default function AppOverlays({ dialogs, importExport, notifications, menus, animation, shared }: AppOverlaysProps) {
  const {
    activeAIDevilMode,
    activeSessionId,
    addToast,
    canCopySessionPassword,
    canMoveTerminalToDockTarget,
    closeAllSessions,
    closePortForwardDialog,
    closeSession,
    closeTerminal,
    closeTerminalGroup,
    connectSerial,
    downloadProgress,
    editFlyAnimation,
    editorModeBanner,
    exportSelectedIds,
    forceCloseSession,
    handleApplyStartupUpdate,
    handleCopySessionPassword,
    handleDownloadTemplate,
    handleExport,
    handleExportSelected,
    handleImport,
    handleRenameTerminalTab,
    handleTabClick,
    handleToastAction,
    hasRecoveryPassword,
    ieBusy,
    isTerminalDockTargetOccupied,
    isUpdateModalVisible,
    loadServers,
    moveTerminalToDockTarget,
    portForwardDialogSessionId,
    portForwardInitialMapping,
    portForwardInitialTab,
    probePanelPosition,
    removeToast,
    sessionAuthPrompts,
    sessionListPos,
    sessionListQuery,
    sessionListRef,
    sessions,
    setExportSelectedIds,
    setIsUpdateModalVisible,
    setProbePanelPosition,
    setSessionListQuery,
    setSettingsInitialTab,
    setShowCredentials,
    setShowExportSelectedDialog,
    setShowImportExportDialog,
    setShowSerialModal,
    setShowSessionList,
    setShowSettings,
    setSyncFailed,
    setTabContextMenu,
    setTerminalTabContextMenu,
    settingsInitialTab,
    showCredentials,
    showExportSelectedDialog,
    showImportExportDialog,
    showPortForwardDialog,
    showSerialModal,
    showSessionList,
    showSettings,
    startupUpdateInfo,
    syncFailed,
    t,
    tabContextMenu,
    terminalTabContextMenu,
    toasts,
  } = { ...dialogs, ...importExport, ...notifications, ...menus, ...animation, ...shared };
  return (<>
      {showImportExportDialog && (
        <ImportExportDialog
          onClose={() => setShowImportExportDialog(false)}
          onExport={handleExport}
          onImport={handleImport}
          onDownloadTemplate={handleDownloadTemplate}
          hasRecoveryPassword={hasRecoveryPassword}
          busy={ieBusy}
        />
      )}

      {showExportSelectedDialog && (
        <ExportSelectedDialog
          onClose={() => {
            setShowExportSelectedDialog(false);
            setExportSelectedIds([]);
          }}
          onExport={handleExportSelected}
          hasRecoveryPassword={hasRecoveryPassword}
          busy={ieBusy}
          selectedCount={exportSelectedIds.length}
        />
      )}

      {showSerialModal && (
        <SerialConfigModal
          onClose={() => setShowSerialModal(false)}
          onConnect={(config) => {
            setShowSerialModal(false);
            connectSerial(config);
          }}
        />
      )}

      {showPortForwardDialog && portForwardDialogSessionId && (
        <PortForwardDialog
          sessionId={portForwardDialogSessionId}
          initialMapping={portForwardInitialMapping}
          initialTab={portForwardInitialTab}
          onClose={closePortForwardDialog}
        />
      )}

      {showSettings && (
        <SettingsModal
          initialTab={settingsInitialTab}
          onClose={() => { setShowSettings(false); loadServers(); }}
          addToast={addToast}
          onRestored={loadServers}
          probePanelPosition={probePanelPosition}
          onProbePanelPositionChange={setProbePanelPosition}
          forceDarkTheme={activeAIDevilMode}
        />
      )}

      {showCredentials && (
        <CredentialsModal
          onClose={() => { setShowCredentials(false); loadServers(); }}
          onChange={loadServers}
          addToast={addToast}
        />
      )}

      {editFlyAnimation && (
        <div className="edit-fly-layer" aria-hidden="true">
          {editFlyAnimation.items.map((item) => (
            item.type === 'beam' ? (
              <div
                key={item.id}
                className={`edit-fly-beam edit-fly-beam-${item.field}`}
                style={{
                  '--beam-from-x': `${item.from.x}px`,
                  '--beam-from-y': `${item.from.y}px`,
                  '--beam-length': item.length,
                  '--beam-angle': item.angle,
                  '--beam-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              />
            ) : item.type === 'add-core' ? (
              <div
                key={item.id}
                className="add-supernova-core"
                style={{
                  '--add-path': item.path,
                  '--add-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              />
            ) : item.type === 'add-particle' ? (
              <div
                key={item.id}
                className="add-supernova-particle"
                style={{
                  '--particle-path': item.path,
                  '--particle-size': `${item.size}px`,
                  '--particle-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              />
            ) : item.type === 'add-ring' ? (
              <div
                key={item.id}
                className="add-supernova-ring"
                style={{
                  '--ring-x': `${item.at.x}px`,
                  '--ring-y': `${item.at.y}px`,
                  '--ring-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              />
            ) : item.type === 'save-flow-capsule' ? (
              <div
                key={item.id}
                className={`save-flow-capsule save-flow-capsule-${item.field}`}
                style={{
                  '--save-flow-from-x': `${item.from.x}px`,
                  '--save-flow-from-y': `${item.from.y}px`,
                  '--save-flow-mid-x': `${item.mid.x}px`,
                  '--save-flow-mid-y': `${item.mid.y}px`,
                  '--save-flow-to-x': `${item.to.x}px`,
                  '--save-flow-to-y': `${item.to.y}px`,
                  '--save-flow-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              >
                <span className="edit-fly-label">{item.label}</span>
                {item.value ? <span className="edit-fly-value">{item.value}</span> : null}
              </div>
            ) : (
              <div
                key={item.id}
                className={`edit-fly-capsule edit-fly-capsule-${item.field}`}
                style={{
                  '--fly-from-x': `${item.from.x}px`,
                  '--fly-from-y': `${item.from.y}px`,
                  '--fly-mid-x': `${item.mid.x}px`,
                  '--fly-mid-y': `${item.mid.y}px`,
                  '--fly-to-x': `${item.to.x}px`,
                  '--fly-to-y': `${item.to.y}px`,
                  '--fly-delay': `${item.delay}ms`,
                } as React.CSSProperties}
              >
                <span className="edit-fly-label">{item.label}</span>
                {item.value ? <span className="edit-fly-value">{item.value}</span> : null}
              </div>
            )
          ))}
        </div>
      )}

      {editorModeBanner && (
        <div className="editor-mode-banner" key={editorModeBanner.id} aria-live="polite">
          {editorModeBanner.text}
        </div>
      )}

      {/* ── Toasts ────────────────────────────────────────── */}
      <Toast toasts={toasts} onClose={removeToast} onAction={handleToastAction} closeLabel={t('关闭')} />
      <GlobalDialog suspendDefault={showSettings} />


      {/* ── 自动更新弹窗 ──────────────────────────────── */}
      <UpdateModal
        visible={isUpdateModalVisible}
        updateInfo={startupUpdateInfo}
        downloadProgress={downloadProgress}
        t={t}
        onClose={() => setIsUpdateModalVisible(false)}
        onUpdate={handleApplyStartupUpdate}
      />

      <SyncFailureToast
        syncFailed={syncFailed}
        setSyncFailed={setSyncFailed}
        setSettingsInitialTab={setSettingsInitialTab}
        setShowSettings={setShowSettings}
        addToast={addToast}
        t={t}
      />

      <GlobalContextMenu />

      {/* ── 终端子标签右键菜单 ── */}
      {terminalTabContextMenu && (() => {
        const session = sessions.find((item) => item.id === terminalTabContextMenu.sessionId);
        const moveTargets = [
          { target: 'top-left', label: t('移至左上面板') },
          { target: 'top-right', label: t('移至右上面板') },
          { target: 'bottom-left', label: t('移至左下面板') },
          { target: 'bottom-right', label: t('移至右下面板') },
        ];
        return (
          <div className="tab-context-menu" style={{ left: terminalTabContextMenu.x, top: terminalTabContextMenu.y }}>
            {terminalTabContextMenu.type === 'terminal' && moveTargets.map((item) => {
              const occupied = !!session && isTerminalDockTargetOccupied(session, terminalTabContextMenu.terminalId, item.target);
              const enabled = !!session && canMoveTerminalToDockTarget(session, terminalTabContextMenu.terminalId, item.target);
              return (
                <div
                  key={item.target}
                  className={`tab-context-menu-item${occupied ? ' occupied' : ''}`}
                  onClick={() => {
                    if (!session || !enabled) return;
                    moveTerminalToDockTarget(session, terminalTabContextMenu.terminalId, item.target);
                  }}
                  style={enabled ? undefined : { opacity: 0.42, pointerEvents: 'none' }}
                >
                  <span className="tab-context-menu-state">{occupied ? '☒' : '☑'}</span> {item.label}
                </div>
              );
            })}
            {terminalTabContextMenu.type === 'terminal' && (
              <div
                className="tab-context-menu-item"
                onClick={() => {
                  const { sessionId, terminalId } = terminalTabContextMenu;
                  setTerminalTabContextMenu(null);
                  void handleRenameTerminalTab(sessionId, terminalId);
                }}
              >
                <PenLine size={14} /> {t('重命名标签标题')}
              </div>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div
              className="tab-context-menu-item"
              onClick={(e) => {
                const { sessionId, terminalId, type, terminalIds } = terminalTabContextMenu;
                setTerminalTabContextMenu(null);
                if (type === 'group' && terminalIds) {
                  closeTerminalGroup(sessionId, terminalId, terminalIds, e);
                  return;
                }
                closeTerminal(sessionId, terminalId, e);
              }}
            >
              <X size={14} /> {terminalTabContextMenu.type === 'group' ? t('关闭分屏组') : t('关闭终端')}
            </div>
          </div>
        );
      })()}

      {/* ── 标签右键菜单 ── */}
      {tabContextMenu && (() => {
        const showCopySessionPassword = canCopySessionPassword(tabContextMenu.sessionId);
        return (
          <div className="tab-context-menu" style={{ left: tabContextMenu.x, top: tabContextMenu.y }}>
            {showCopySessionPassword && (
              <>
                <div
                  className="tab-context-menu-item"
                  onClick={() => {
                    const sessionId = tabContextMenu.sessionId;
                    setTabContextMenu(null);
                    void handleCopySessionPassword(sessionId);
                  }}
                >
                  <Copy size={14} /> {t('复制服务器密码')}
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </>
            )}
            <div
              className="tab-context-menu-item"
              onClick={() => {
                const sessionId = tabContextMenu.sessionId;
                setTabContextMenu(null);
                forceCloseSession(sessionId);
              }}
            >
              <X size={14} /> {t('关闭连接')}
            </div>
            {sessions.length >= 2 && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div
                  className="tab-context-menu-item"
                  onClick={() => {
                    setTabContextMenu(null);
                    closeAllSessions();
                  }}
                >
                  <X size={14} /> {t('关闭全部')}
                </div>
              </>
            )}
          </div>
        );
      })()}
      {/* ── 服务器列表下拉 ── */}
      {showSessionList && (
        <div
          ref={sessionListRef}
          className="tab-context-menu"
          style={{ left: sessionListPos.x - 240, top: sessionListPos.y, minWidth: 240, maxHeight: 400, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
            <input
              id="app-overlays-session-search"
              name="app-overlays-session-search"
              autoComplete="off"
              type="text"
              value={sessionListQuery}
              onChange={(e) => setSessionListQuery(e.target.value)}
              placeholder={t('搜索服务器')}
              autoFocus
              style={{ width: '100%', padding: '4px 8px 4px 26px', fontSize: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
            />
            <Search size={13} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {sessions
              .filter(s => !sessionListQuery || (s.serverName || '').toLowerCase().includes(sessionListQuery.toLowerCase()) || (s.host || '').toLowerCase().includes(sessionListQuery.toLowerCase()))
              .map(s => (
                <div
                  key={s.id}
                  className="tab-context-menu-item"
                  onClick={() => { handleTabClick(s.id); setShowSessionList(false); }}
                  style={{ fontWeight: activeSessionId === s.id ? 700 : 400, color: activeSessionId === s.id ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  <span className={`status-dot ${sessionAuthPrompts[s.id] ? 'attention' : s.status === 'connecting' ? 'connecting' : s.status === 'connected' ? 'online' : 'offline'}`} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.serverName}</span>
                  <Tiptop text={t('关闭')} placement="bottom">
                    <span
                      onClick={(e) => { e.stopPropagation(); closeSession(s.id, e); }}
                      aria-label={t('关闭')}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5, flexShrink: 0 }}
                    >
                      <X size={13} />
                    </span>
                  </Tiptop>
                </div>
              ))}
            {sessions.filter(s => !sessionListQuery || (s.serverName || '').toLowerCase().includes(sessionListQuery.toLowerCase()) || (s.host || '').toLowerCase().includes(sessionListQuery.toLowerCase())).length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>{t('无匹配结果')}</div>
            )}
          </div>
        </div>
      )}
  </>);
}
