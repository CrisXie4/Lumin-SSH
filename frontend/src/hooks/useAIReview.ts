import { useCallback, useEffect, useState } from 'react';
import { restoreAIChatTool } from '../components/ai/aiChatBridge.ts';
import {
  buildAIWorkspaceTabPanelKey,
  buildAIWorkspaceTerminalPanelKey,
  resolveAIWorkspaceTerminalBindingByTerminalId,
} from '../utils/sessionWorkspace.ts';
import { warnDev } from '../utils/devLog.ts';

/** AI 变更审查（reviewId/requestId 为必填标识） */
interface AIChangeReview {
  reviewId: string;
  requestId: string;
  sessionId?: string;
  [key: string]: unknown;
}

/** 恢复预览状态（按面板键存储） */
interface RestorePreviewState {
  sessionId: string;
  terminalId: string;
  tabId: string;
  review: AIChangeReview;
}

/** 对话差异面板项 */
export interface ConversationDiffItem {
  id: string;
  messageId: string;
  artifactPath: string;
  toolName: string;
  title: string;
  summary: string;
  status: string;
  copyContent: string;
  order: number;
  /** 该条目已被还原（按钮持久显示「已还原」并禁用，单一数据源） */
  restored?: boolean;
}

/** 对话差异面板 */
interface ConversationDiffPanel {
  sessionId: string;
  terminalId: string;
  tabId: string;
  openedAt: number;
  items: ConversationDiffItem[];
  selectedMessageId: string;
  selectedArtifactPath: string;
  reviewByArtifactPath: Record<string, unknown>;
  loadingByArtifactPath: Record<string, boolean>;
}

/** AI 桥接层（Preview/Reapply 工具差异） */
interface AIBridgeLike {
  PreviewAIChatToolDiff?: (artifactPath: string, terminalId: string) => Promise<unknown>;
  ReapplyAIChatTool?: (artifactPath: string, terminalId: string) => Promise<void>;
}

export interface UseAIReviewOptions {
  sessionsRef: React.RefObject<unknown[]>;
  addToast: (message: string | Error, type?: string, duration?: number, actions?: unknown[]) => number;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

export interface UseAIReviewResult {
  changeReviewQueues: Record<string, AIChangeReview[]>;
  restorePreviewReviews: Record<string, RestorePreviewState>;
  conversationDiffPanels: Record<string, ConversationDiffPanel>;
  setRestorePreviewReviews: React.Dispatch<React.SetStateAction<Record<string, RestorePreviewState>>>;
  setConversationDiffPanels: React.Dispatch<React.SetStateAction<Record<string, ConversationDiffPanel>>>;
  enqueueChangeReview: (review: AIChangeReview, tabId?: string) => void;
  removeChangeReviewsByRequestId: (requestId: string) => void;
  removeChangeReviewsBySessionId: (terminalId: string, tabId?: string) => void;
  handleReapplyConversationDiffItem: (artifactPath: string, targetSessionId: string, targetTerminalId: string, tabId?: string) => Promise<boolean>;
  handleApplyConversationDiffRestore: (artifactPath: string, targetSessionId: string, targetTerminalId: string, tabId?: string) => Promise<boolean>;
  handleSelectConversationDiffItem: (item: ConversationDiffItem, options?: {
    sessionId?: string;
    terminalId?: string;
    items?: ConversationDiffItem[];
    locate?: boolean;
    setActive?: boolean;
    tabId?: string;
  }) => Promise<void>;
}

// 审阅/恢复预览/对话差异三类状态的读取方（useAppOrchestrator）只按
// 「会话::终端::标签」三级键查找，因此写入侧必须使用同一严格语义：
// tabId 为空时返回空串并丢弃写入，而不是回退到读取方永远看不到的终端级键。
function buildAIReviewPanelKey(sessionId: string, terminalId: string, tabId = ''): string {
  return buildAIWorkspaceTabPanelKey(sessionId, terminalId, tabId);
}

export default function useAIReview({ sessionsRef, addToast, t }: UseAIReviewOptions): UseAIReviewResult {
  const [changeReviewQueues, setChangeReviewQueues] = useState<Record<string, AIChangeReview[]>>({});
  const [restorePreviewReviews, setRestorePreviewReviews] = useState<Record<string, RestorePreviewState>>({});
  const [conversationDiffPanels, setConversationDiffPanels] = useState<Record<string, ConversationDiffPanel>>({});

  const enqueueChangeReview = useCallback((review: AIChangeReview, tabId = '') => {
    if (!review || typeof review !== 'object' || !review.reviewId || !review.requestId) {
      warnDev('审阅事件被丢弃：review 缺少 reviewId/requestId', review);
      return;
    }
    const binding = resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, review.sessionId || '');
    if (!binding) {
      warnDev('审阅事件被丢弃：无法按 terminalId 解析会话绑定', { terminalId: review.sessionId });
      return;
    }
    const panelKey = buildAIReviewPanelKey(binding.sessionId, binding.terminalId, tabId);
    if (!panelKey) {
      warnDev('审阅事件被丢弃：tabId 为空，无法定位面板键', { terminalId: binding.terminalId, tabId });
      return;
    }
    setChangeReviewQueues((prev) => {
      const currentQueue = Array.isArray(prev[panelKey]) ? prev[panelKey] : [];
      if (currentQueue.some((item) => item.reviewId === review.reviewId)) {
        return prev;
      }
      return {
        ...prev,
        [panelKey]: [...currentQueue, review],
      };
    });
  }, []);

  const removeChangeReviewsByRequestId = useCallback((requestId: string) => {
    const normalizedRequestId = typeof requestId === 'string' ? requestId.trim() : '';
    if (!normalizedRequestId) {
      return;
    }
    setChangeReviewQueues((prev) => {
      let changed = false;
      const next: Record<string, AIChangeReview[]> = {};
      Object.entries(prev).forEach(([panelKey, queue]) => {
        const currentQueue = Array.isArray(queue) ? queue : [];
        const filteredQueue = currentQueue.filter((item) => item.requestId !== normalizedRequestId);
        if (filteredQueue.length !== currentQueue.length) {
          changed = true;
        }
        if (filteredQueue.length > 0) {
          next[panelKey] = filteredQueue;
        }
      });
      return changed ? next : prev;
    });
    setRestorePreviewReviews((prev) => {
      let changed = false;
      const next: Record<string, RestorePreviewState> = {};
      Object.entries(prev).forEach(([panelKey, reviewState]) => {
        if (reviewState?.review?.requestId === normalizedRequestId) {
          changed = true;
          return;
        }
        next[panelKey] = reviewState;
      });
      return changed ? next : prev;
    });
  }, []);

  const removeChangeReviewsBySessionId = useCallback((terminalId: string, tabId = '') => {
    const binding = resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, terminalId);
    if (!binding) {
      warnDev('审阅状态清理被跳过：无法按 terminalId 解析会话绑定', { terminalId });
      return;
    }
    const basePanelKey = buildAIWorkspaceTerminalPanelKey(binding.sessionId, binding.terminalId);
    if (!basePanelKey) {
      return;
    }
    // 带.tabId 时精确清理单个标签；不带时清理该终端全部标签（含历史遗留的终端级键）
    const tabPanelKey = buildAIWorkspaceTabPanelKey(binding.sessionId, binding.terminalId, tabId);
    const matchesPanelKey = (currentKey: string) => (
      tabPanelKey
        ? currentKey === tabPanelKey
        : currentKey === basePanelKey || currentKey.startsWith(`${basePanelKey}::`)
    );
    setChangeReviewQueues((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([currentKey]) => !matchesPanelKey(currentKey)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setRestorePreviewReviews((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([currentKey]) => !matchesPanelKey(currentKey)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setConversationDiffPanels((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([currentKey]) => !matchesPanelKey(currentKey)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, []);

  useEffect(() => {
    const handleRequiredChangeReview = (event: Event) => {
      const detail = (event as CustomEvent<{ review?: unknown; terminalId?: unknown; tabId?: unknown }>).detail || {};
      const review = detail.review;
      const terminalId = typeof detail.terminalId === 'string' ? detail.terminalId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      if (!review || typeof review !== 'object' || !terminalId || !tabId) {
        warnDev('审阅事件被丢弃：事件载荷缺少 review/terminalId/tabId', { hasReview: Boolean(review), terminalId, tabId });
        return;
      }
      enqueueChangeReview({
        ...(review as AIChangeReview),
        sessionId: terminalId,
      }, tabId);
    };
    window.addEventListener('ai-change-review-required', handleRequiredChangeReview);
    return () => window.removeEventListener('ai-change-review-required', handleRequiredChangeReview);
  }, [enqueueChangeReview]);

  useEffect(() => {
    const handleClearChangeReview = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: unknown; tabId?: unknown; reviewId?: unknown }>).detail || {};
      const sessionId = typeof detail.sessionId === 'string' ? detail.sessionId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      const reviewId = typeof detail.reviewId === 'string' ? detail.reviewId.trim() : '';
      if (!sessionId) {
        return;
      }
      if (!reviewId) {
        removeChangeReviewsBySessionId(sessionId, tabId);
        return;
      }
      const binding = resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, sessionId);
      const panelKey = binding ? buildAIReviewPanelKey(binding.sessionId, binding.terminalId, tabId) : '';
      if (!panelKey) {
        return;
      }
      setChangeReviewQueues((prev) => {
        const queue = Array.isArray(prev[panelKey]) ? prev[panelKey] : [];
        const nextQueue = queue.filter((item) => item.reviewId !== reviewId);
        if (nextQueue.length === queue.length) {
          return prev;
        }
        const next = { ...prev };
        if (nextQueue.length > 0) {
          next[panelKey] = nextQueue;
        } else {
          delete next[panelKey];
        }
        return next;
      });
    };

    window.addEventListener('ai-change-review-clear', handleClearChangeReview);
    return () => window.removeEventListener('ai-change-review-clear', handleClearChangeReview);
  }, [removeChangeReviewsBySessionId]);

  useEffect(() => {
    const handlePreviewChangeReview = (event: Event) => {
      const detail = (event as CustomEvent<{ review?: unknown; sessionId?: unknown; tabId?: unknown }>).detail || {};
      const review = detail.review;
      const terminalId = typeof detail.sessionId === 'string' ? detail.sessionId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      if (!review || typeof review !== 'object') {
        warnDev('恢复预览事件被丢弃：事件载荷缺少 review', detail);
        return;
      }
      const binding = resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, terminalId);
      if (!binding) {
        warnDev('恢复预览事件被丢弃：无法按 terminalId 解析会话绑定', { terminalId, tabId });
        return;
      }
      const panelKey = buildAIReviewPanelKey(binding.sessionId, binding.terminalId, tabId);
      if (!panelKey) {
        warnDev('恢复预览事件被丢弃：tabId 为空，无法定位面板键', { terminalId: binding.terminalId, tabId });
        return;
      }
      setRestorePreviewReviews((prev) => ({
        ...prev,
        [panelKey]: {
          sessionId: binding.sessionId,
          terminalId: binding.terminalId,
          tabId,
          review: review as AIChangeReview,
        },
      }));
    };

    const handleClearPreviewChangeReview = (event: Event) => {
      const detail = (event as CustomEvent<{ reviewId?: unknown; sessionId?: unknown; tabId?: unknown }>).detail || {};
      const reviewId = typeof detail.reviewId === 'string' ? detail.reviewId.trim() : '';
      const terminalId = typeof detail.sessionId === 'string' ? detail.sessionId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      // 无任何作用域的清除事件直接忽略，避免把其它会话的预览状态一并清掉
      if (!reviewId && !terminalId) {
        warnDev('恢复预览清除事件被忽略：缺少 reviewId/sessionId 作用域', detail);
        return;
      }
      const binding = terminalId ? resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, terminalId) : null;
      const panelKey = binding ? buildAIReviewPanelKey(binding.sessionId, binding.terminalId, tabId) : '';
      if (terminalId && !binding) {
        warnDev('恢复预览清除：无法按 terminalId 解析会话绑定，回退按事件 terminalId 匹配', { terminalId, tabId });
      }
      setRestorePreviewReviews((prev) => {
        let changed = false;
        const next: Record<string, RestorePreviewState> = {};
        Object.entries(prev).forEach(([currentKey, reviewState]) => {
          // 作用域过滤：优先精确面板键；绑定解析失败时回退按终端匹配；仅有 reviewId 时才扫描全部
          if (panelKey) {
            if (currentKey !== panelKey) {
              next[currentKey] = reviewState;
              return;
            }
          } else if (terminalId && reviewState.terminalId !== terminalId) {
            next[currentKey] = reviewState;
            return;
          }
          if (reviewId && reviewState?.review?.reviewId && reviewState.review.reviewId !== reviewId) {
            next[currentKey] = reviewState;
            return;
          }
          changed = true;
        });
        return changed ? next : prev;
      });
    };

    window.addEventListener('ai-change-review-preview', handlePreviewChangeReview);
    window.addEventListener('ai-change-review-preview-clear', handleClearPreviewChangeReview);
    return () => {
      window.removeEventListener('ai-change-review-preview', handlePreviewChangeReview);
      window.removeEventListener('ai-change-review-preview-clear', handleClearPreviewChangeReview);
    };
  }, []);

  const previewConversationDiffArtifact = useCallback(async (artifactPath: string, targetTerminalId: string) => {
    const bridge = (window?.go?.wailsapp?.AIBindings || window?.go?.wailsapp?.App) as AIBridgeLike;
    if (!bridge?.PreviewAIChatToolDiff) {
      throw new Error(t('差异预览能力未就绪'));
    }
    const review = await bridge.PreviewAIChatToolDiff(artifactPath, targetTerminalId);
    return review && typeof review === 'object' ? review : null;
  }, []);

  const handleReapplyConversationDiffItem = useCallback(async (artifactPath: string, targetSessionId: string, targetTerminalId: string, _tabId = '') => {
    const bridge = (window?.go?.wailsapp?.AIBindings || window?.go?.wailsapp?.App) as AIBridgeLike;
    const effectiveTerminalId = typeof targetTerminalId === 'string' && targetTerminalId.trim()
      ? targetTerminalId.trim()
      : (typeof targetSessionId === 'string'
        ? targetSessionId.trim()
        : '');
    if (!bridge?.ReapplyAIChatTool) {
      addToast(t('重新应用能力未就绪'), 'error', 3200);
      return false;
    }
    try {
      await bridge.ReapplyAIChatTool(artifactPath, effectiveTerminalId);
      return true;
    } catch (error) {
      addToast(error instanceof Error ? t(error.message) : t('当前状态不支持重新应用'), 'error', 3200);
      return false;
    }
  }, [addToast, t]);

  const handleApplyConversationDiffRestore = useCallback(async (artifactPath: string, targetSessionId: string, targetTerminalId: string, tabId = '') => {
    try {
      await restoreAIChatTool(artifactPath, targetTerminalId);
      addToast(t('已还原'), 'success', 3200);
      // 还原成功：标记该条目 restored=true（按钮持久显示「已还原」并禁用），保留条目不再移除
      const binding = resolveAIWorkspaceTerminalBindingByTerminalId(sessionsRef.current, targetSessionId || targetTerminalId);
      const panelKey = binding ? buildAIReviewPanelKey(binding.sessionId, binding.terminalId, tabId) : '';
      if (panelKey) {
        setConversationDiffPanels((prev) => {
          const panel = prev[panelKey];
          if (!panel || !Array.isArray(panel.items)) {
            return prev;
          }
          let changed = false;
          const nextItems = panel.items.map((item) => {
            const p = typeof (item as { artifactPath?: unknown }).artifactPath === 'string'
              ? String((item as { artifactPath: string }).artifactPath).trim()
              : '';
            if (p === artifactPath.trim() && !item.restored) {
              changed = true;
              return { ...item, restored: true };
            }
            return item;
          });
          if (!changed) {
            return prev;
          }
          return { ...prev, [panelKey]: { ...panel, items: nextItems } };
        });
      } else {
        warnDev('还原状态标记被跳过：无法解析面板键', { targetSessionId, targetTerminalId, tabId });
      }
      return true;
    } catch (error) {
      addToast(error instanceof Error ? t(error.message) : t('当前状态不支持还原'), 'error', 3200);
      return false;
    }
  }, [addToast, t]);

  const handleSelectConversationDiffItem = useCallback(async (item: ConversationDiffItem, options: {
    sessionId?: string;
    terminalId?: string;
    tabId?: string;
    items?: ConversationDiffItem[];
    locate?: boolean;
    setActive?: boolean;
  } = {}) => {
    const artifactPath = typeof item?.artifactPath === 'string' ? item.artifactPath.trim() : '';
    const messageId = typeof item?.messageId === 'string' ? item.messageId.trim() : '';
    const sessionId = typeof options?.sessionId === 'string' ? options.sessionId.trim() : '';
    const terminalId = typeof options?.terminalId === 'string' ? options.terminalId.trim() : '';
    const tabId = typeof options?.tabId === 'string' ? options.tabId.trim() : '';
    const providedItems = Array.isArray(options?.items) ? options.items : [];
    const shouldLocate = options?.locate === true;
    const shouldSetActive = options?.setActive !== false;
    const panelKey = buildAIReviewPanelKey(sessionId, terminalId, tabId);
    if (!artifactPath || !panelKey) {
      warnDev('对话差异选择被跳过：artifactPath 为空或无法构建面板键', { artifactPath, sessionId, terminalId, tabId });
      return;
    }
    setConversationDiffPanels((prev) => {
      const currentPanel = prev[panelKey] || {
        sessionId,
        terminalId,
        tabId,
        openedAt: Date.now(),
        items: providedItems,
      };
      return {
        ...prev,
        [panelKey]: {
          ...currentPanel,
          items: Array.isArray(currentPanel.items) && currentPanel.items.length > 0 ? currentPanel.items : providedItems,
          selectedMessageId: shouldSetActive ? messageId : (currentPanel.selectedMessageId || messageId),
          selectedArtifactPath: shouldSetActive ? artifactPath : (currentPanel.selectedArtifactPath || artifactPath),
          reviewByArtifactPath: currentPanel.reviewByArtifactPath && typeof currentPanel.reviewByArtifactPath === 'object' ? currentPanel.reviewByArtifactPath : {},
          loadingByArtifactPath: {
            ...(currentPanel.loadingByArtifactPath && typeof currentPanel.loadingByArtifactPath === 'object' ? currentPanel.loadingByArtifactPath : {}),
            [artifactPath]: true,
          },
        },
      };
    });
    try {
      const review = await previewConversationDiffArtifact(artifactPath, terminalId || sessionId);
      setConversationDiffPanels((prev) => {
        const currentPanel = prev[panelKey] || {
          sessionId,
          terminalId,
          tabId,
          openedAt: Date.now(),
          items: providedItems,
        };
        return {
          ...prev,
          [panelKey]: {
            ...currentPanel,
            items: Array.isArray(currentPanel.items) && currentPanel.items.length > 0 ? currentPanel.items : providedItems,
            selectedMessageId: shouldSetActive ? messageId : (currentPanel.selectedMessageId || messageId),
            selectedArtifactPath: shouldSetActive ? artifactPath : (currentPanel.selectedArtifactPath || artifactPath),
            reviewByArtifactPath: review && typeof review === 'object'
              ? {
                ...(currentPanel.reviewByArtifactPath && typeof currentPanel.reviewByArtifactPath === 'object' ? currentPanel.reviewByArtifactPath : {}),
                [artifactPath]: review,
              }
              : (currentPanel.reviewByArtifactPath && typeof currentPanel.reviewByArtifactPath === 'object' ? currentPanel.reviewByArtifactPath : {}),
            loadingByArtifactPath: {
              ...(currentPanel.loadingByArtifactPath && typeof currentPanel.loadingByArtifactPath === 'object' ? currentPanel.loadingByArtifactPath : {}),
              [artifactPath]: false,
            },
          },
        };
      });
      if (shouldLocate && messageId) {
        window.dispatchEvent(new CustomEvent('ai-conversation-diff-locate', {
          detail: {
            sessionId,
            terminalId,
            tabId,
            messageId,
            token: Date.now(),
          },
        }));
      }
    } catch (error) {
      setConversationDiffPanels((prev) => {
        const currentPanel = prev[panelKey] || {
          sessionId,
          terminalId,
          tabId,
          openedAt: Date.now(),
          items: providedItems,
        };
        return {
          ...prev,
          [panelKey]: {
            ...currentPanel,
            items: Array.isArray(currentPanel.items) && currentPanel.items.length > 0 ? currentPanel.items : providedItems,
            selectedMessageId: shouldSetActive ? messageId : (currentPanel.selectedMessageId || messageId),
            selectedArtifactPath: shouldSetActive ? artifactPath : (currentPanel.selectedArtifactPath || artifactPath),
            reviewByArtifactPath: currentPanel.reviewByArtifactPath && typeof currentPanel.reviewByArtifactPath === 'object' ? currentPanel.reviewByArtifactPath : {},
            loadingByArtifactPath: {
              ...(currentPanel.loadingByArtifactPath && typeof currentPanel.loadingByArtifactPath === 'object' ? currentPanel.loadingByArtifactPath : {}),
              [artifactPath]: false,
            },
          },
        };
      });
      if (shouldSetActive) {
        addToast(error instanceof Error ? t(error.message) : t('差异预览失败'), 'error', 3200);
      }
    }
  }, [addToast, previewConversationDiffArtifact]);

  useEffect(() => {
    const handleOpenConversationDiffPanel = (event: Event) => {
      const detail = (event as CustomEvent<{
        sessionId?: unknown;
        terminalId?: unknown;
        tabId?: unknown;
        items?: unknown;
      }>).detail || {};
      const sessionId = typeof detail.sessionId === 'string' ? detail.sessionId.trim() : '';
      const terminalId = typeof detail.terminalId === 'string' ? detail.terminalId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      const panelKey = buildAIReviewPanelKey(sessionId, terminalId, tabId);
      const rawItems = Array.isArray(detail.items) ? detail.items : [];
      const items: ConversationDiffItem[] = rawItems
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => {
          const raw = item as Record<string, unknown>;
          return {
            id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `conversation-diff-item-${index}`,
            messageId: typeof raw.messageId === 'string' ? raw.messageId.trim() : '',
            artifactPath: typeof raw.artifactPath === 'string' ? raw.artifactPath.trim() : '',
            toolName: typeof raw.toolName === 'string' ? raw.toolName.trim() : '',
            title: typeof raw.title === 'string' ? raw.title.trim() : '',
            summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
            status: typeof raw.status === 'string' ? raw.status.trim() : '',
            copyContent: typeof raw.copyContent === 'string' ? raw.copyContent : '',
            order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index + 1,
            restored: raw.restored === true,
          };
        })
        .filter((item) => item.artifactPath);
      if (!panelKey || items.length === 0) {
        return;
      }
      let firstItem: ConversationDiffItem | null = null;
      let shouldOpen = false;
      setConversationDiffPanels((prev) => {
        if (prev[panelKey]) {
          const next = { ...prev };
          delete next[panelKey];
          return next;
        }
        firstItem = items[0];
        shouldOpen = true;
        return {
          ...prev,
          [panelKey]: {
            sessionId,
            terminalId,
            tabId,
            openedAt: Date.now(),
            items,
            selectedMessageId: firstItem?.messageId || '',
            selectedArtifactPath: firstItem?.artifactPath || '',
            reviewByArtifactPath: {},
            loadingByArtifactPath: {},
          },
        };
      });
      if (shouldOpen && firstItem) {
        void handleSelectConversationDiffItem(firstItem, { sessionId, terminalId, tabId, locate: false, items, setActive: true });
        items.slice(1).forEach((nextItem) => {
          void handleSelectConversationDiffItem(nextItem, { sessionId, terminalId, tabId, locate: false, items, setActive: false });
        });
      }
    };

    const handleCloseConversationDiffPanel = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: unknown; terminalId?: unknown; tabId?: unknown }>).detail || {};
      const sessionId = typeof detail.sessionId === 'string' ? detail.sessionId.trim() : '';
      const terminalId = typeof detail.terminalId === 'string' ? detail.terminalId.trim() : '';
      const tabId = typeof detail.tabId === 'string' ? detail.tabId.trim() : '';
      const panelKey = buildAIReviewPanelKey(sessionId, terminalId, tabId);
      setConversationDiffPanels((prev) => {
        if (!panelKey) {
          return {};
        }
        if (!prev[panelKey]) {
          return prev;
        }
        const next = { ...prev };
        delete next[panelKey];
        return next;
      });
    };

    window.addEventListener('ai-conversation-diff-open', handleOpenConversationDiffPanel);
    window.addEventListener('ai-conversation-diff-close', handleCloseConversationDiffPanel);
    return () => {
      window.removeEventListener('ai-conversation-diff-open', handleOpenConversationDiffPanel);
      window.removeEventListener('ai-conversation-diff-close', handleCloseConversationDiffPanel);
    };
  }, [handleSelectConversationDiffItem]);

  return {
    changeReviewQueues,
    restorePreviewReviews,
    conversationDiffPanels,
    setRestorePreviewReviews,
    setConversationDiffPanels,
    enqueueChangeReview,
    removeChangeReviewsByRequestId,
    removeChangeReviewsBySessionId,
    handleReapplyConversationDiffItem,
    handleApplyConversationDiffRestore,
    handleSelectConversationDiffItem,
  };
}
