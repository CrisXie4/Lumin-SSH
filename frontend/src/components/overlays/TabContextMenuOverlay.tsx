import { createPortal } from 'react-dom';
import { Copy, X } from 'lucide-react';
import { useOverlayScrollLock } from '../../hooks/useOverlayScrollLock.ts';
import type { TopbarSession } from '../AppTopbar.tsx';
import type { TabContextMenuState } from './overlayTypes.ts';

interface TabContextMenuOverlayProps {
  tabContextMenu: TabContextMenuState;
  sessions: TopbarSession[];
  t: (key: string, vars?: Record<string, unknown>) => string;
  canCopySessionPassword: (sessionId: string) => boolean;
  setTabContextMenu: (menu: TabContextMenuState | null) => void;
  handleCopySessionPassword: (sessionId: string) => Promise<void>;
  forceCloseSession: (sessionId: string) => void;
  closeAllSessions: () => Promise<void>;
}

/** 标签右键菜单 */
export default function TabContextMenuOverlay({
  tabContextMenu,
  sessions,
  t,
  canCopySessionPassword,
  setTabContextMenu,
  handleCopySessionPassword,
  forceCloseSession,
  closeAllSessions,
}: TabContextMenuOverlayProps) {
  useOverlayScrollLock(true);
  const showCopySessionPassword = canCopySessionPassword(tabContextMenu.sessionId);
  const content = (
    <div className="tab-context-menu" data-tab-context-menu="true" style={{ left: tabContextMenu.x, top: tabContextMenu.y }}>
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
          <div className="h-px my-1 bg-line" />
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
          <div className="h-px my-1 bg-line" />
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

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
