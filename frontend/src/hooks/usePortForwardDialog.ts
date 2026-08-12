import { useCallback, useState } from 'react';

/** 端口转发对话框的初始映射（打开时预填） */
export interface PortForwardInitialMapping {
  kind: 'local';
  localHost: string;
  localPort: string;
  remoteHost: string;
  remotePort: string;
}

export interface UsePortForwardDialogResult {
  showPortForwardDialog: boolean;
  portForwardDialogSessionId: string | null;
  portForwardInitialMapping: PortForwardInitialMapping | null;
  portForwardInitialTab: string | null;
  openPortForwardDialog: (sessionId: string, port?: string | number | null, initialTab?: string | null) => void;
  closePortForwardDialog: () => void;
}

export default function usePortForwardDialog(): UsePortForwardDialogResult {
  const [showPortForwardDialog, setShowPortForwardDialog] = useState(false);
  const [portForwardDialogSessionId, setPortForwardDialogSessionId] = useState<string | null>(null);
  const [portForwardInitialMapping, setPortForwardInitialMapping] = useState<PortForwardInitialMapping | null>(null);
  const [portForwardInitialTab, setPortForwardInitialTab] = useState<string | null>(null);

  const openPortForwardDialog = useCallback((sessionId: string, port: string | number | null = null, initialTab: string | null = null) => {
    setPortForwardDialogSessionId(sessionId);
    setPortForwardInitialMapping(port == null ? null : {
      kind: 'local',
      localHost: '127.0.0.1',
      localPort: String(port),
      remoteHost: '127.0.0.1',
      remotePort: String(port),
    });
    setPortForwardInitialTab(initialTab);
    setShowPortForwardDialog(true);
  }, []);

  const closePortForwardDialog = useCallback(() => setShowPortForwardDialog(false), []);

  return {
    showPortForwardDialog,
    portForwardDialogSessionId,
    portForwardInitialMapping,
    portForwardInitialTab,
    openPortForwardDialog,
    closePortForwardDialog,
  };
}
