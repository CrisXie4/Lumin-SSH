// 上下文菜单视口边界定位工具
// 统一各组件右键菜单的定位逻辑，防止菜单溢出屏幕

const MENU_VIEWPORT_GAP = 8;

/**
 * 根据鼠标坐标和菜单尺寸计算菜单位置，确保不溢出视口。
 * @param x - 鼠标 clientX
 * @param y - 鼠标 clientY
 * @param width - 菜单宽度（估算或实测）
 * @param height - 菜单高度（估算或实测）
 * @returns 调整后的坐标
 */
export const clampMenuPosition = (x: number, y: number, width = 180, height = 140): { x: number; y: number } => ({
  x: Math.max(MENU_VIEWPORT_GAP, Math.min(x, window.innerWidth - width - MENU_VIEWPORT_GAP)),
  y: Math.max(MENU_VIEWPORT_GAP, Math.min(y, window.innerHeight - height - MENU_VIEWPORT_GAP)),
});
