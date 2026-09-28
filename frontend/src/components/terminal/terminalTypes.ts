import type { RefObject } from 'react';
import type { QuickCommandsHandle } from '../QuickCommands.tsx';

// 终端快照供 FileManager 等模块读取当前 buffer 文本（FileManager.jsx 亦写入同名键）
declare global {
  interface Window {
    __luminTerminalSnapshots?: Record<string, () => string>;
  }
}

/** 命令输入框单行基准高度（px）。
 *  useTerminalCommandInput 的高度自适应与 useTerminalSession 的 PTY 行数补偿都以它为基准；
 *  样式侧必须保持同高：TerminalInputBar 的 h-9 与 terminal.css 的 .term-command-input。 */
export const CMD_INPUT_BASE_HEIGHT_PX = 36;
/** 命令输入框最大高度（px），超过后改为内部滚动 */
export const CMD_INPUT_MAX_HEIGHT_PX = 132;

/** 时间戳 ring 条目 / 命令块状态 */
export interface CommandBlockState {
  id: number;
  commandLineText: string;
  occurrence: number;
  collapsed: boolean;
  savedOutput: string[] | null;
  savedOutputTs: string[] | null;
}

export interface TerminalProps {
  sessionId: string;
  serverId: string;
  historyServerId: string;
  status: string;
  isActive: boolean;
  serverName: string;
  connectedSessions?: Array<{ id?: string }>;
  showCommands?: boolean;
  onQuickCommandsOpenChange?: (open: boolean) => void;
  quickCmdsRef?: RefObject<QuickCommandsHandle | null>;
  // 重连触发器：串口/本地复用同一 sessionId 重连时，wsRebuildKey 自增，
  // 让下方建立 xterm+WebSocket 的主 effect 重跑，重建 WS（对齐 SSH 重连靠新 terminalId 触发的行为）。
  wsRebuildKey?: number;
}
