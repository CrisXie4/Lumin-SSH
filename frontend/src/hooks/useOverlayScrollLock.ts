import { useLayoutEffect } from 'react';
import { isLinuxWebKit } from '../utils/platform';

/**
 * useOverlayScrollLock — Linux WebKitGTK 滚动条穿透的统一加锁
 *
 * @description
 * Wails Linux 使用 WebKitGTK，其滚动条以独立合成层绘制在所有 `position:fixed`
 * 之上，`z-index`/`isolation` 无法压制。滚动后立即打开弹层时，背景 thumb 会
 * 穿透到弹层上（表现为一条 6px 细线，静置 1s 后自动消失）。
 *
 * 本 hook 与 `frontend/src/styles/base.css` 配套：
 * - `base.css` 在 `html.modal-open` 时把背景 `.app-layout` 的滚动条 thumb/track
 *   **透明化**（`scrollbar-color: transparent` / `::-webkit-scrollbar-*` 背景透明）。
 *   早期方案用 `scrollbar-width:none + overflow:hidden` 强制隐藏，但会移除滚动条
 *   槽位、改变布局（overflow:hidden 打在 * 上还破坏 sticky），导致背景 reflow
 *   （文件列表丢滚动位置、面板排版跳动、虚拟列表闪烁，Windows/Linux 均受影响）；
 *   透明化保持滚动条结构与槽位不动，零布局变化，GTK 画到弹层上的 thumb 同样透明。
 *   弹层自身通过 `[data-modal-overlay]`/`.modal-overlay`/`[data-select-dropdown]` 等
 *   恢复可见，`portaled` 到 `body` 的弹层天然在 `.app-layout` 外不受影响。
 * - 本 hook 负责在 `paint` 前同步给 `html/body` 加 `modal-open`（首帧即生效，防
 *   滚动后立即开弹层的首帧穿透），并通过 `body.dataset.modalCount` 计数保证多层
 *   嵌套（例：设置弹层内再开二次确认）时仅在最后一层关闭才解锁。
 * - **仅 Linux WebKitGTK 生效**（`isLinuxWebKit`）：Windows/macOS 的滚动条可被
 *   弹层正常裁剪，无穿透问题，不加 `modal-open` 避免无谓的全局重绘。
 *
 * 已实验排除的替代方案（2026-09 Linux 实测，勿重试）：
 * - 仅靠结构层修复（portal 到 body + isolation + 滚动条样式作用域收敛）：穿透仍复现；
 * - 弹层去进场动画（排除合成层提升触发）：无效；
 * - 滚动容器提升合成层（will-change:scroll-position，含 Virtuoso）：无效。
 * 结论：WebKitGTK 的滚动条层不受页面合成结构控制，弹层打开期间让背景滚动条
 * 不可见（透明化）是该环境下防穿透的唯一手段；透明化保持槽位不动故无 reflow。
 *
 * @param open - 弹层/菜单/下拉是否可见，`true` 时加锁，`false` 或卸载时解锁
 *
 * @usage
 * ```tsx
 * // 1) 全屏弹层 / Dialog / Drawer（必须 portal 到 body，并加 data-modal-overlay）
 * import { createPortal } from 'react-dom'
 * import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
 * function MyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
 *   useOverlayScrollLock(open)
 *   if (!open || typeof document === 'undefined') return null
 *   return createPortal(
 *     <div data-modal-overlay="true" className="modal-overlay" style={{ isolation: 'isolate' }}>
 *       <div className="modal">...</div>
 *     </div>,
 *     document.body
 *   )
 * }
 *
 * // 2) 右键菜单 / 下拉（同样 portal，菜单自身可滚动时加 data 属性以便 base.css 恢复）
 * function MyMenu({ open, x, y }: { open: boolean; x: number; y: number }) {
 *   useOverlayScrollLock(open)
 *   if (!open) return null
 *   return createPortal(
 *     <div data-context-menu="true" style={{ position:'fixed', left:x, top:y }}>...</div>,
 *     document.body
 *   )
 * }
 * // Select 下拉已在 ui/Select.tsx 内置此逻辑，无需外层重复加锁
 * ```
 *
 * @rules
 * - 已使用 `ui/Modal` 的组件无需再调用，`Modal.tsx` 已内置。
 * - **任何 `createPortal` 到 body 的交互弹层必须接入本 hook**：`npm run overlay:check`
 *   （scripts/check-overlay-lock.mjs）会扫描校验，遗漏时登记豁免清单需写明原因。
 *   GlobalContextMenu 曾因遗漏导致 Linux 上输入框右键菜单被背景滚动条穿透。
 * - 全屏遮罩会盖住顶栏导致窗口无法拖动：新的全屏弹层（`.modal-overlay` 或
 *   `fixed inset-0` 的模态类遮罩）首个子节点需放 `<ModalDragStrip />`
 *   （见 `ui/ModalDragStrip.tsx`），恢复遮罩打开时的顶栏拖动/双击最大化。
 * - 任何新写的 `fixed/inset-0` 覆盖层（即使很小如 `Select` 下拉、`ContextMenu`）
 *   若可能盖在可滚动内容（文件管理器的 Virtuoso、首页主机列表、探针面板等）之上，
 *   均应调用 `useOverlayScrollLock(open)` 并 `portal` 到 `body`。
 * - 弹层自身若有滚动（`max-h-64 overflow-y-auto`），需加 `data-modal-overlay` /
 *   `data-select-dropdown` / `data-context-menu` 等，使 `base.css` 的恢复规则
 *   不会将其误隐藏；`portaled` 的弹层已在 `.app-layout` 外，天然不受背景隐藏影响。
 * - `.app-layout` 内新增可滚动容器（`overflow-y:auto`）无需在 `base.css` 登记，
 *   通用 `html.modal-open .app-layout *` 会自动在任意弹层打开时隐藏，无需特例化。
 * - 统一修复入口：若后续仍出现穿透，优先检查弹层是否调用本 hook 且已 `portal`，
 *   而非为每个滚动条写特例。详见分支 `fix/linux-modal-scrollbar-bleed` 及
 *   `base.css:124` 注释。
 */
export function useOverlayScrollLock(open: boolean) {
  useLayoutEffect(() => {
    // 仅 Linux WebKitGTK 需要加锁：其滚动条绘制为独立合成层会穿透 fixed 弹层，
    // modal-open 时 base.css 将背景滚动条透明化以隐藏穿透（零布局变化）。
    // Windows/macOS 的滚动条可被弹层正常裁剪，不加锁避免无谓的全局重绘。
    if (!open || !isLinuxWebKit) return undefined;

    const docEl = document.documentElement;
    const body = document.body;
    const previousCount = Number(body.dataset.modalCount || '0');
    const nextCount = previousCount + 1;

    body.dataset.modalCount = String(nextCount);
    body.classList.add('modal-open');
    docEl.classList.add('modal-open');

    return () => {
      const remaining = Math.max(0, Number(body.dataset.modalCount || '1') - 1);
      if (remaining === 0) {
        body.classList.remove('modal-open');
        docEl.classList.remove('modal-open');
        delete body.dataset.modalCount;
      } else {
        body.dataset.modalCount = String(remaining);
      }
    };
  }, [open]);
}
