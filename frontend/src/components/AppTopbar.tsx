import { useRef } from 'react';
import { House, Minus, Square, X, Bot, Settings, RefreshCw, Rocket, Sun, Moon, ChevronDown } from 'lucide-react';
import Tiptop from './Tiptop.tsx';
import { WindowMinimise } from '../../wailsjs/runtime/runtime.js';
import { Z } from '../constants/zIndex.ts';
import { cn } from '../utils/cn.ts';
import type { SessionAuthPrompt, SshChannelUsage } from '../hooks/useSessionConnections.ts';
import type { SessionLike } from '../utils/sessionWorkspace.ts';

/** 顶栏标签页的会话形状（来自 useSessionConnections 的宽松会话） */
export interface TopbarSession extends SessionLike {
  id: string;
  serverName?: string;
  host?: string;
  status: string;
}

export interface AppTopbarProps {
  t: (key: string, vars?: Record<string, unknown>) => string;
  handleTopbarDoubleClick: () => void;
  markWorkspaceRestoreNavigationOverride: () => void;
  setActiveSessionId: (id: string | null) => void;
  setActiveTerminalId: (id: string | null) => void;
  setShowSettings: (v: boolean) => void;
  logoImg: string;
  showTopbarRefreshedLogo: boolean;
  topbarLogoTransitionImg: string;
  sessions: TopbarSession[];
  tabScrollRef: React.RefObject<HTMLDivElement | null>;
  tabListRef: React.RefObject<HTMLDivElement | null>;
  activeSessionId: string | null;
  handleTabClick: (sessionId: string) => void;
  closeSession: (sessionId: string, e?: React.MouseEvent) => Promise<void>;
  setTabContextMenu: (menu: { sessionId: string; serverName: string; x: number; y: number } | null) => void;
  sessionAuthPrompts: Record<string, SessionAuthPrompt>;
  sshChannelUsage: Record<string, SshChannelUsage>;
  tabsOverflow: boolean;
  tabActionsRef: React.RefObject<HTMLDivElement | null>;
  sessionListBtnRef: React.RefObject<HTMLButtonElement | null>;
  toggleSessionList: () => void;
  closeAllSessions: () => Promise<void>;
  showThemeQuickEntry: boolean;
  activeAIDevilMode: boolean;
  resolvedQuickThemeMode: 'light' | 'dark';
  handleQuickThemeToggle: () => void;
  isActiveSessionConnected: boolean;
  showAIPanel: boolean;
  setAIPanelVisibility: (v: boolean) => void;
  startupUpdateInfo: { version: string } | null;
  showUpdateBubble: boolean;
  isUpdateModalVisible: boolean;
  setShowUpdateBubble: (v: boolean) => void;
  setIsUpdateModalVisible: (v: boolean) => void;
  setSettingsInitialTab: (tab: string) => void;
  handleToggleMaximise: () => void;
  handleCloseWindow: () => Promise<void>;
  reconnectSession: (session: SessionLike) => Promise<unknown>;
}

export default function AppTopbar({
  t, handleTopbarDoubleClick, markWorkspaceRestoreNavigationOverride,
  setActiveSessionId, setActiveTerminalId, setShowSettings,
  logoImg, showTopbarRefreshedLogo, topbarLogoTransitionImg,
  sessions, tabScrollRef, tabListRef, activeSessionId, handleTabClick,
  closeSession, setTabContextMenu, sessionAuthPrompts, sshChannelUsage,
  tabsOverflow, tabActionsRef, sessionListBtnRef, toggleSessionList,
  closeAllSessions, showThemeQuickEntry, activeAIDevilMode,
  resolvedQuickThemeMode, handleQuickThemeToggle, isActiveSessionConnected,
  showAIPanel, setAIPanelVisibility, startupUpdateInfo, showUpdateBubble,
  isUpdateModalVisible, setShowUpdateBubble,
  setIsUpdateModalVisible, setSettingsInitialTab, handleToggleMaximise,
  handleCloseWindow, reconnectSession,
}: AppTopbarProps) {
  const topbarRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      {/* ── Topbar ───────────────────────────────────────── */}
      <div
        className="topbar"
        ref={topbarRef}
        onMouseDown={(e) => {
          // detail>1 为双击的第二次按下；阻止浏览器默认划词（否则 WebView2 会弹 AI 搜索条）
          if (e.detail > 1) e.preventDefault();
        }}
        onDoubleClick={handleTopbarDoubleClick}
      >
        <div className="topbar-content">
          <div className="topbar-logo" onClick={() => { markWorkspaceRestoreNavigationOverride(); setActiveSessionId(null); setActiveTerminalId(null); setShowSettings(false); }}>
            <div className="relative w-5 h-5 rounded-xs overflow-hidden shrink-0">
              <img
                src={logoImg}
                alt="Lumin SSH"
                className="absolute inset-0 w-full h-full object-cover [transition:opacity_0.6s_ease,transform_0.7s_cubic-bezier(0.22,1,0.36,1),filter_0.6s_ease]"
                style={{
                  opacity: showTopbarRefreshedLogo ? 0 : 1,
                  transform: showTopbarRefreshedLogo ? 'scale(0.9) rotate(-8deg)' : 'scale(1) rotate(0deg)',
                  filter: showTopbarRefreshedLogo ? 'blur(8px)' : 'blur(0px)',
                }}
              />
              <img
                src={topbarLogoTransitionImg}
                alt="Lumin Theme Logo"
                className="absolute inset-0 w-full h-full object-cover [transition:opacity_0.6s_ease,transform_0.7s_cubic-bezier(0.22,1,0.36,1),filter_0.6s_ease]"
                style={{
                  opacity: showTopbarRefreshedLogo ? 1 : 0,
                  transform: showTopbarRefreshedLogo ? 'scale(1) rotate(0deg)' : 'scale(1.12) rotate(8deg)',
                  filter: showTopbarRefreshedLogo ? 'blur(0px)' : 'blur(10px)',
                }}
              />
            </div>
            <div className="topbar-title">Lumin</div>
          </div>

          {sessions.length > 0 && (
            <div className="tab-bar">
              <Tiptop text={t('返回主页')} placement="bottom">
                <button
                  className="btn btn-ghost btn-sm no-drag shrink-0"
                  onClick={() => { markWorkspaceRestoreNavigationOverride(); setActiveSessionId(null); setActiveTerminalId(null); }}
                  aria-label={t('返回主页')}
                >
                  <House size={14} />
                </button>
              </Tiptop>
              <div className="tab-scroll" ref={tabScrollRef}>
                <div ref={tabListRef} className="tab-list">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`tab-item no-drag ${activeSessionId === s.id ? 'active' : ''}`}
                      onClick={() => handleTabClick(s.id)}
                      onDoubleClick={(e) => { void closeSession(s.id, e); }}
                      onMouseDown={(e) => {
                        if (e.button !== 1) return;
                        e.preventDefault();
                        e.stopPropagation();
                        void closeSession(s.id, e);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTabContextMenu({
                          sessionId: s.id,
                          serverName: s.serverName || s.host || '',
                          x: rect.left,
                          y: rect.bottom + 4,
                        });
                      }}
                    >
                      <span
                        className={`status-dot ${sessionAuthPrompts[s.id] ? 'attention' : s.status === 'connecting' ? 'connecting' : s.status === 'connected' ? 'online' : 'offline'}`}
                        role={sessionAuthPrompts[s.id] ? 'img' : undefined}
                        aria-label={sessionAuthPrompts[s.id] ? sessionAuthPrompts[s.id].title : undefined}
                        title={sessionAuthPrompts[s.id] ? sessionAuthPrompts[s.id].title : undefined}
                      />
                      {(() => {
                        const usage = sshChannelUsage[s.id];
                        if (!usage || usage.total <= 0 || s.status !== 'connected') return null;
                        const maxSessions = usage.maxSessions > 0 ? usage.maxSessions : 10;
                        const nearLimit = usage.total >= Math.max(1, maxSessions - 2);
                        return (
                          <Tiptop
                            placement="bottom"
                            minTop={() => (topbarRef.current?.getBoundingClientRect().bottom ?? 40) + 6}
                            text={(
                              <>
                                <div>{t('服务器连接通道占用')}</div>
                                <div className="mt-0.5 opacity-[0.82] text-xs">{t('终端 {count} 个', { count: usage.terminals })}</div>
                                <div className="opacity-[0.82] text-xs">{t('共享文件通道 {count} 个', { count: usage.sharedSftp })}</div>
                                <div className="opacity-[0.82] text-xs">{t('上传通道 {count} 个', { count: usage.uploadPool })}</div>
                                <div className="mt-0.5 text-xs">{t('合计 {total} / 上限 {max}', { total: usage.total, max: maxSessions })}</div>
                                <div className="mt-0.5 opacity-70 text-xs">{t('接近服务器通道上限后将无法建立新的终端或传输')}</div>
                              </>
                            )}
                          >
                            <span
                              className={cn(
                                'no-drag min-w-[15px] h-[15px] px-1 rounded-full text-[10px] font-bold leading-[15px] text-center shrink-0 cursor-default border',
                                nearLimit
                                  ? 'bg-warning-dim text-warning border-warning'
                                  : 'bg-sunken text-tertiary border-line',
                              )}
                            >
                              {usage.total}
                            </span>
                          </Tiptop>
                        );
                      })()}
                      <span className="max-w-[120px] truncate">
                        {s.serverName}
                      </span>
                      {(s.status === 'closed' || s.status === 'error') && (
                        <Tiptop text={t('重新连接')} placement="bottom">
                          <span
                            className="tab-reconnect no-drag cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              reconnectSession(s);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            aria-label={t('重新连接')}
                          >
                            <RefreshCw size={12} />
                          </span>
                        </Tiptop>
                      )}
                      <span
                        className="tab-close no-drag"
                        onClick={(e) => closeSession(s.id, e)}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <X size={12} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div ref={tabActionsRef} className="tab-actions">
                {tabsOverflow && (
                  <Tiptop text={t('服务器列表')} placement="bottom">
                    <button
                      ref={sessionListBtnRef}
                      className="btn btn-icon no-drag"
                      onClick={toggleSessionList}
                      aria-label={t('服务器列表')}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </Tiptop>
                )}
                {sessions.length >= 2 && (
                  <Tiptop text={t('关闭全部')} placement="bottom">
                    <button
                      className="btn btn-danger btn-sm no-drag"
                      onClick={closeAllSessions}
                      aria-label={t('关闭全部')}
                    >
                      <X size={12} /> {t('关闭全部')}
                    </button>
                  </Tiptop>
                )}
              </div>
            </div>
          )}
          {sessions.length === 0 && <div className="flex-1" />}

          <div className="window-controls">
            {showThemeQuickEntry && !activeAIDevilMode && (
              <Tiptop text={resolvedQuickThemeMode === 'light' ? t('深色') : t('浅色')} placement="bottom">
                <button
                  type="button"
                  className={cn(
                    'no-drag relative w-[52px] h-7 p-[3px] rounded-full border border-line inline-flex items-center justify-between overflow-hidden shrink-0',
                    '[box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]',
                    resolvedQuickThemeMode === 'light' ? 'bg-[rgba(250,204,21,0.12)]' : 'bg-[rgba(99,102,241,0.16)]',
                  )}
                  onClick={handleQuickThemeToggle}
                  aria-label={resolvedQuickThemeMode === 'light' ? t('深色') : t('浅色')}
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-overlay shadow-sm [transition:left_0.2s_ease]"
                    style={{ left: resolvedQuickThemeMode === 'light' ? 3 : 27 }}
                  />
                  <span
                    aria-hidden="true"
                    className="relative w-4 inline-flex items-center justify-center [transition:color_0.2s_ease]"
                    style={{ zIndex: Z.CONTENT, color: resolvedQuickThemeMode === 'light' ? '#f59e0b' : 'var(--text-tertiary)' }}
                  >
                    <Sun size={13} />
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative w-4 inline-flex items-center justify-center [transition:color_0.2s_ease]"
                    style={{ zIndex: Z.CONTENT, color: resolvedQuickThemeMode === 'dark' ? '#a78bfa' : 'var(--text-tertiary)' }}
                  >
                    <Moon size={13} />
                  </span>
                </button>
              </Tiptop>
            )}
            {activeSessionId !== null && isActiveSessionConnected && sessions.length > 0 && (
              <Tiptop text={showAIPanel ? t('收起 AI 助手面板') : t('打开 AI 助手面板')} placement="bottom">
                <button
                  className="btn btn-ghost btn-icon no-drag"
                  onClick={() => setAIPanelVisibility(!showAIPanel)}
                  aria-label={showAIPanel ? t('收起 AI 助手面板') : t('打开 AI 助手面板')}
                  style={{ color: showAIPanel ? 'var(--accent)' : undefined }}
                >
                  <Bot size={16} />
                </button>
              </Tiptop>
            )}
            {startupUpdateInfo && (
              <Tiptop text={`${t('发现新版本')} ${startupUpdateInfo.version}`} placement="bottom">
                <div className="update-entry no-drag relative flex items-center">
                  <div
                    className={`update-bubble${showUpdateBubble ? ' visible' : ''} top-[calc(100%+10px)] -right-1 pointer-events-none`}
                    style={{
                      position: 'absolute',
                      opacity: showUpdateBubble ? 1 : 0,
                      transform: `translateY(${showUpdateBubble ? '0' : '-8px'}) scale(${showUpdateBubble ? '1' : '0.94'})`,
                      zIndex: Z.POPOVER,
                    }}
                  >
                    <span className="update-bubble-pulse" />
                    <span className="update-bubble-dot" />
                    <div className="update-bubble-content">
                      <span className="update-bubble-pill">{t('发现新版本')}</span>
                      <span className="update-bubble-text">{startupUpdateInfo.version}</span>
                    </div>
                  </div>
                  <button
                    className={`btn btn-ghost btn-icon no-drag update-entry-button overflow-visible${isUpdateModalVisible ? ' active' : ''}`}
                    onClick={() => {
                      setShowUpdateBubble(false);
                      setIsUpdateModalVisible(true);
                    }}
                    aria-label={`${t('发现新版本')} ${startupUpdateInfo.version}`}
                    style={{
                      color: isUpdateModalVisible ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <Rocket size={16} />
                    <span className="update-entry-badge absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_0_2px_var(--surface-base)]" />
                  </button>
                </div>
              </Tiptop>
            )}
            <Tiptop text={t('设置')} placement="bottom">
              <button
                className="btn btn-ghost btn-icon no-drag"
                onClick={() => {
                  setSettingsInitialTab('general');
                  setShowSettings(true);
                }}
                aria-label={t('设置')}
              ><Settings size={16} /></button>
            </Tiptop>
            <div className="window-divider" />
            <Tiptop text={t('最小化')} placement="bottom">
              <button className="btn btn-ghost btn-icon no-drag" onClick={WindowMinimise} aria-label={t('最小化')}><Minus size={14} /></button>
            </Tiptop>
            <Tiptop text={t('最大化')} placement="bottom">
              <button className="btn btn-ghost btn-icon no-drag" onClick={handleToggleMaximise} aria-label={t('最大化')}><Square size={14} /></button>
            </Tiptop>
            <Tiptop text={t('关闭')} placement="bottom">
              <button className="btn btn-ghost btn-icon no-drag" aria-label={t('关闭')} onClick={handleCloseWindow}><X size={14} /></button>
            </Tiptop>
          </div>
        </div>
      </div>
    </>
  );
}
