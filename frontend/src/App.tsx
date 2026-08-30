import { useCallback, useEffect } from 'react';
import { initializeGlobalAppearance } from './utils/globalAppearance.ts';
import AppTopbar from './components/AppTopbar.tsx';
import AppOverlays from './components/AppOverlays.tsx';
import AppMCPFloatingOverlay from './components/app/AppMCPFloatingOverlay.tsx';
import AppWorkspaceView from './components/app/AppWorkspaceView.tsx';
import WindowResizeBorders from './components/app/WindowResizeBorders.tsx';
import BigScreenPage from './components/bigscreen/BigScreenPage.tsx';
import useAppOrchestrator from './hooks/useAppOrchestrator.ts';

export default function App() {
  useEffect(() => initializeGlobalAppearance(), []);
  const orchestrator = useAppOrchestrator();

  const handleBigScreenGoHome = useCallback(() => {
    orchestrator.sessionState.markWorkspaceRestoreNavigationOverride();
    orchestrator.sessionState.setActiveSessionId(null);
    orchestrator.sessionState.setActiveTerminalId(null);
  }, [orchestrator.sessionState]);

  return (
    <div className="app-layout">
      <AppTopbar {...orchestrator.topbarProps} />
      <AppWorkspaceView orchestrator={orchestrator} />
      <AppOverlays {...orchestrator.overlaysProps} />
      <AppMCPFloatingOverlay {...orchestrator.mcpProps} />
      <BigScreenPage
        visible={orchestrator.bigScreen.visible}
        servers={orchestrator.servers}
        sessions={orchestrator.sessionState.connectedSessions}
        onClose={orchestrator.bigScreen.close}
        onGoHome={handleBigScreenGoHome}
      />
      <WindowResizeBorders />
    </div>
  );
}
