import { useTranslation } from '../i18n.ts'
import { useRef, useState } from 'react'
import { useAIWorkspaceTabs } from './ai/useAIWorkspaceTabs.ts'
import { renderAIWorkspaceTabBar } from './ai/AIWorkspaceTabBar.tsx'
import { AIConversationTabPanel } from './ai/AIConversationTabPanel.tsx'
import { useTabStripWheelScrollInContainer } from '../hooks/useTabStripWheelScroll.ts'
import type { AIPanelProps } from './ai/aiChatLogic.ts'
import { getCachedAIGlobalSettings } from './ai/aiGlobalSettingsBridge.ts'

// AIPanel：AI 工作区多标签管理外壳。单个标签页面板见 ./ai/AIConversationTabPanel.tsx。
export default function AIPanel({ width, side, sessionId, terminalId, sessionTerminals = [], sessionLabel = '', terminalLabel = '', isPanelVisible = true, onActiveTabChange, onActivateWorkspaceTab, addToast }: AIPanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [workspaceTabNumbersOnly, setWorkspaceTabNumbersOnly] = useState<boolean | null>(() => {
    const cachedSettings = getCachedAIGlobalSettings()
    return cachedSettings ? cachedSettings.aiWorkspaceTabNumbersOnly === true : null
  })
  const {
    tabGroup, tabRequestIds, activeTabId, tabGroupRef, aiWorkspaceTabScrollRef,
    aiWorkspaceTabCloseLockRef, aiWorkspaceTabOverflow, aiWorkspaceTabCanScrollLeft, aiWorkspaceTabCanScrollRight,
    clearAIWorkspaceTabCloseUnlockTimer, suppressAIWorkspaceTabCloseInteraction, scrollAIWorkspaceTabs,
    handleAIWorkspaceTabScroll, createWorkspaceTab, returnWorkspaceTabHome, activateWorkspaceTab,
    closeWorkspaceTab, forkWorkspaceTabConversation, openConversationInWorkspaceTab, handleWorkspaceTabStateChange,
  } = useAIWorkspaceTabs({ t, terminalId, sessionId, sessionLabel, terminalLabel, onActiveTabChange, onActivateWorkspaceTab })
  // 工作区标签条会被每个会话标签面板各渲染一份：滚轮统一挂到容器内全部副本
  // （隐藏副本收不到 wheel 事件），标签数变化时重挂。
  useTabStripWheelScrollInContainer(panelRef, tabGroup.tabs.length)
  const workspaceTabBar = workspaceTabNumbersOnly === null ? null : renderAIWorkspaceTabBar({
    t,
    sessionId,
    terminalId,
    tabGroup,
    tabGroupRef,
    tabRequestIds,
    activeTabId,
    workspaceTabNumbersOnly,
    aiWorkspaceTabOverflow,
    aiWorkspaceTabCanScrollLeft,
    aiWorkspaceTabCanScrollRight,
    aiWorkspaceTabScrollRef,
    aiWorkspaceTabCloseLockRef,
    suppressAIWorkspaceTabCloseInteraction,
    scrollAIWorkspaceTabs,
    handleAIWorkspaceTabScroll,
    clearAIWorkspaceTabCloseUnlockTimer,
    activateWorkspaceTab,
    closeWorkspaceTab,
    forkWorkspaceTabConversation,
    createWorkspaceTab,
  })
  return (
    <div ref={panelRef} className="h-full min-h-0 flex flex-col overflow-hidden relative w-full min-w-0 max-w-full" style={{ width: width || '100%', minWidth: 0, maxWidth: '100%' }}>
      {tabGroup.tabs.map((tab) => (
        <div key={tab.id} className="absolute inset-0" style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}>
          <AIConversationTabPanel
            width="100%"
            side={side}
            sessionId={sessionId}
            terminalId={terminalId}
            sessionTerminals={sessionTerminals}
            sessionLabel={sessionLabel}
            terminalLabel={terminalLabel}
            onWorkspaceTabDisplaySettingsChange={setWorkspaceTabNumbersOnly}
            workspaceTabId={tab.id}
            isHomeView={tab.conversationId === ''}
            isWorkspaceTabActive={isPanelVisible && activeTabId === tab.id}
            initialConversationId={tab.conversationId}
            tabBar={workspaceTabBar}
            onGoHomeRequested={() => returnWorkspaceTabHome(tab.id)}
            onOpenConversationRequested={openConversationInWorkspaceTab}
            onWorkspaceTabStateChange={handleWorkspaceTabStateChange}
            addToast={addToast}
          />
        </div>
      ))}
    </div>
  )}
