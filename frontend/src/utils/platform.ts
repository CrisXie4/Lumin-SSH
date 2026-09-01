// 平台检测工具
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Linux WebKitGTK 环境（Wails Linux 端）。
 * 其原生 overlay 滚动条以独立合成层绘制、不占布局空间，会穿透 position:fixed 弹层，
 * 仅此环境需要弹层打开时锁定背景滚动（见 useOverlayScrollLock）；
 * Windows WebView2 的经典滚动条占据布局空间，隐藏会引发背景 reflow；
 * macOS WKWebView 的滚动条可被弹层正常裁剪，均无需加锁。
 * 判定与 themeTransition.ts 的 WebKitGTK 检测保持一致：AppleWebKit（排除 Chrome/Chromium）且 Linux/X11。
 */
export const isLinuxWebKit = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleWebKit = /AppleWebKit/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
  if (!isAppleWebKit) return false;
  const platform = (navigator as unknown as { platform?: string }).platform || '';
  return /Linux|X11/.test(ua) || /Linux/.test(platform);
})();

/** 修饰键事件（键盘/鼠标事件共有的 ctrlKey、metaKey 字段） */
interface ModifierKeyEvent {
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * 获取修饰键状态（macOS 上将 Meta/⌘ 映射为主快捷键 Ctrl）
 * 用于快捷键检测：const mod = getModKey(e);
 */
export function getModKey(e: ModifierKeyEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

/**
 * 标准化快捷键字符串显示（macOS 将 Ctrl 替换为 ⌘）
 * 如 "Ctrl+C" → "⌘C" (macOS)
 */
export function formatShortcut(str: string): string {
  if (!str) return str;
  if (isMac) return str.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥').replace(/Shift/g, '⇧');
  return str;
}

/** 组合键构建事件（键盘事件共有的 key 与修饰键字段） */
interface ComboKeyEvent extends ModifierKeyEvent {
  shiftKey: boolean;
  altKey: boolean;
  key: string;
}

/**
 * 构建组合键字符串（如 "Ctrl+Shift+V"），与快捷键录制/匹配三处共用同一实现，避免漂移。
 * ctrl 参数决定是否计入 Ctrl 位：主快捷键传 getModKey(e)，物理 Ctrl 语义传 e.ctrlKey。
 */
export function buildCombo(e: ComboKeyEvent, ctrl: boolean): string {
  const keys: string[] = [];
  if (ctrl) keys.push('Ctrl');
  if (e.shiftKey) keys.push('Shift');
  if (e.altKey) keys.push('Alt');
  let keyName = e.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();
  keys.push(keyName);
  return keys.join('+');
}
