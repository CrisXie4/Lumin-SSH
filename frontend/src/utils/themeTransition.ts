/**
 * 主题切换过渡动画（View Transitions API + 优雅降级）
 *
 * 效果与 Art Design Pro 等一致，并按目标模式区分方向：
 * - 切到浅色（扩散 expand）：新浅色画面从点击处从小到大圆形扩散盖住全局；
 * - 切到深色（收缩 contract）：旧浅色画面收缩成圆形陷落到点击处，深色从四周合拢。
 *
 * 实现方式（优雅降级）：
 * - Chromium（Win WebView2 ≥111 / macOS WKWebView 新版）支持 `View Transitions`：
 *   `document.startViewTransition` 截取旧/新快照，扩散在 `::view-transition-new(root)`、
 *   收缩在 `::view-transition-old(root)` 上跑 `clip-path: circle()`，见 `animations.css`。
 * - Linux WebKitGTK（Wails 透明窗口下 clip-path 黑屏）及旧版 WebView（无
 *   `startViewTransition`）：走 `runFallbackTransition`——旧主题色层 320ms 淡出
 *   揭示新主题，三端均保留过渡，`prefers-reduced-motion` 时直接切换。
 */

interface ThemeTransitionPoint {
  x: number;
  y: number;
}

/** 扩散：新快照从小到大揭示；收缩：旧快照从全屏收缩到点击点 */
export type ThemeTransitionDirection = 'expand' | 'contract';

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
};

/** 收缩方向期间挂在 <html> 上的标记类，配合 CSS 把旧快照提到新快照之上 */
const CONTRACT_CLASS = 'theme-transition-contract';

const TRANSITION_DURATION_MS = 500;

/** 全局记录最后一次指针按下位置，作为圆形扩散的圆心（键盘触发时用最近一次点击位置） */
let lastPointerPoint: ThemeTransitionPoint | null = null;
let pointerTrackingBound = false;

const DEFAULT_TRANSITION_POINT: ThemeTransitionPoint = { x: -1, y: -1 };

function bindPointerTracking(): void {
  if (pointerTrackingBound || typeof window === 'undefined') return;
  pointerTrackingBound = true;
  // capture + passive：只读坐标，不影响任何交互
  window.addEventListener('pointerdown', (event) => {
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
    lastPointerPoint = { x: event.clientX, y: event.clientY };
  }, { capture: true, passive: true });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleWebKit = /AppleWebKit/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
  if (!isAppleWebKit) return false;
  // 仅 Linux WebKitGTK 在 Wails 透明窗口下会黑屏，macOS WKWebView 实测正常
  // 通过 UA/平台区分：Linux 含 Linux/X11，macOS 含 Mac
  const platform = (navigator as unknown as { platform?: string }).platform || '';
  const uaIsLinux = /Linux|X11/.test(ua) || /Linux/.test(platform);
  return uaIsLinux;
}

function getViewTransitionDocument(): ViewTransitionDocument | null {
  if (typeof document === 'undefined') return null;
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== 'function') return null;
  if (isWebKit()) return null;
  if (typeof CSS !== 'undefined' && typeof (CSS as unknown as { supports?: unknown }).supports === 'function') {
    try {
      // @ts-ignore — view-transition-name 为较新属性，无类型
      if (!CSS.supports('view-transition-name', 'root')) return null;
    } catch {
      // 旧内核 CSS.supports 可能抛异常，视为不支持
      return null;
    }
  }
  return doc;
}

export function isThemeTransitionSupported(): boolean {
  // 优雅降级：原生 View Transitions 不可用时走 fallback 淡出，仍有动画
  return !prefersReducedMotion();
}

/** 按目标模式推导方向：切到浅色扩散、切到深色收缩（system 按当前系统偏好解析） */
export function themeTransitionDirectionFor(nextMode: string): ThemeTransitionDirection {
  let resolved = String(nextMode || '');
  if (resolved === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return resolved === 'light' ? 'expand' : 'contract';
}

function resolveTransitionPoint(origin?: ThemeTransitionPoint | null): ThemeTransitionPoint {
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) return origin;
  if (lastPointerPoint) return lastPointerPoint;
  // 无任何指针记录（如快捷键首次触发）：退化为顶栏主题按钮的大致位置
  if (DEFAULT_TRANSITION_POINT.x < 0 && typeof window !== 'undefined') {
    DEFAULT_TRANSITION_POINT.x = Math.max(window.innerWidth - 48, 0);
    DEFAULT_TRANSITION_POINT.y = 40;
  }
  return DEFAULT_TRANSITION_POINT;
}

/** 圆心到屏幕最远角的距离，即覆盖全屏所需的圆半径 */
function computeRevealEndRadius(point: ThemeTransitionPoint): number {
  const farthestX = Math.max(point.x, window.innerWidth - point.x);
  const farthestY = Math.max(point.y, window.innerHeight - point.y);
  return Math.hypot(farthestX, farthestY);
}

// ── WebKit 降级：View Transitions 在 Wails 透明窗口下黑屏，改用普通 overlay 模拟 ──
// 为避免实心圆的生硬与闪屏，降级采用与真实快照更接近的“旧画面整体淡出”而非实心色块圆，
// 在 Win 上仍为圆扩散，Linux 上为柔和淡入淡出，三端均保留过渡但不黑屏。
let fallbackOverlay: HTMLElement | null = null;

function createFallbackOverlay(isLight: boolean): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-theme-fallback-overlay', 'true');
  el.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
    `background:${isLight ? '#f3f4f6' : '#0f1319'};` +
    'will-change:opacity,clip-path;';
  return el;
}

function runFallbackTransition(
  applyChange: () => void,
  _point: ThemeTransitionPoint,
  direction: ThemeTransitionDirection,
): void {
  if (typeof document === 'undefined') {
    applyChange();
    return;
  }
  if (fallbackOverlay?.parentNode) fallbackOverlay.remove();
  const overlayLight = direction === 'contract';
  const overlay = createFallbackOverlay(overlayLight);
  overlay.style.opacity = '1';
  document.body.appendChild(overlay);
  fallbackOverlay = overlay;
  // 先切底层，再让旧色层淡出，避免闪屏（底层已是新主题，旧层淡出即揭示新主题）
  applyChange();
  const anim = overlay.animate({ opacity: ['1', '0'] }, { duration: 320, easing: 'ease-out', fill: 'forwards' });
  anim.onfinish = () => {
    overlay.remove();
    if (fallbackOverlay === overlay) fallbackOverlay = null;
  };
  anim.oncancel = () => {
    overlay.remove();
    if (fallbackOverlay === overlay) fallbackOverlay = null;
  };
}

async function runFallbackTransitionAsync<T>(
  applyChange: () => Promise<T>,
  _point: ThemeTransitionPoint,
  direction: ThemeTransitionDirection,
): Promise<T> {
  if (typeof document === 'undefined') return applyChange();
  if (fallbackOverlay?.parentNode) fallbackOverlay.remove();
  const overlayLight = direction === 'contract';
  const overlay = createFallbackOverlay(overlayLight);
  overlay.style.opacity = '1';
  document.body.appendChild(overlay);
  fallbackOverlay = overlay;
  const outcome: { result?: T; failure?: { error: unknown } } = {};
  try {
    outcome.result = await applyChange();
  } catch (error) {
    outcome.failure = { error };
  }
  const anim = overlay.animate({ opacity: ['1', '0'] }, { duration: 320, easing: 'ease-out', fill: 'forwards' });
  await anim.finished.catch(() => {});
  overlay.remove();
  if (fallbackOverlay === overlay) fallbackOverlay = null;
  if (outcome.failure) throw outcome.failure.error;
  return outcome.result as T;
}

function playRevealAnimation(transition: ViewTransitionLike, point: ThemeTransitionPoint, direction: ThemeTransitionDirection): void {
  transition.ready.then(() => {
    const endRadius = computeRevealEndRadius(point);
    const circleAt = `at ${point.x}px ${point.y}px`;
    const isContract = direction === 'contract';
    const animation = document.documentElement.animate(
      {
        clipPath: isContract
          // 旧画面从全屏圆收缩到点击点，四周露出新（深色）画面
          ? [`circle(${endRadius}px ${circleAt})`, `circle(0px ${circleAt})`]
          // 新画面从点击点扩散到全屏
          : [`circle(0px ${circleAt})`, `circle(${endRadius}px ${circleAt})`],
      },
      {
        duration: TRANSITION_DURATION_MS,
        easing: 'ease-in-out',
        pseudoElement: isContract ? '::view-transition-old(root)' : '::view-transition-new(root)',
        // 动画结束时保持末帧：否则裁剪立即失效，置顶的旧浅色快照会整屏弹回一帧（白闪）
        fill: 'forwards',
      },
    );
    // fill: forwards 的残留 effect 会在伪元素拆除后附着到下一次过渡的同名伪元素上，过渡结束时显式取消
    transition.finished.then(() => animation.cancel(), () => animation.cancel());
  }).catch(() => {});
}

/** 收缩方向需要旧快照置顶，动画结束后摘掉标记类 */
function bindContractClass(transition: ViewTransitionLike, direction: ThemeTransitionDirection): void {
  if (direction !== 'contract' || typeof document === 'undefined') return;
  document.documentElement.classList.add(CONTRACT_CLASS);
  transition.finished.then(
    () => document.documentElement.classList.remove(CONTRACT_CLASS),
    () => document.documentElement.classList.remove(CONTRACT_CLASS),
  );
}

/**
 * 同步主题变更的动画包装：applyChange 内完成所有 DOM 变更
 * （body class / CSS 变量 / React 状态需配合 flushSync）
 * 优雅降级：Chromium 走原生圆扩散，Linux WebKitGTK 及旧版 WebView 走 fallback 淡出
 */
export function runThemeChangeWithTransition(
  applyChange: () => void,
  origin?: ThemeTransitionPoint | null,
  direction: ThemeTransitionDirection = 'expand',
): void {
  if (prefersReducedMotion()) {
    applyChange();
    return;
  }
  // Linux WebKitGTK 黑屏，旧版 WebView 无 View Transitions，均走 fallback 淡出而非直接切换
  if (isWebKit()) {
    bindPointerTracking();
    const point = resolveTransitionPoint(origin);
    try {
      runFallbackTransition(applyChange, point, direction);
    } catch {
      applyChange();
    }
    return;
  }
  const doc = getViewTransitionDocument();
  if (!doc) {
    bindPointerTracking();
    const point = resolveTransitionPoint(origin);
    try {
      runFallbackTransition(applyChange, point, direction);
    } catch {
      applyChange();
    }
    return;
  }
  bindPointerTracking();
  const point = resolveTransitionPoint(origin);
  try {
    const transition = doc.startViewTransition!(applyChange);
    bindContractClass(transition, direction);
    playRevealAnimation(transition, point, direction);
  } catch (_) {
    applyChange();
  }
}

/**
 * 异步主题变更的动画包装（applyChange 返回 Promise，如设置页保存后端）。
 * 动画快照会等 Promise 完成后落定；结果与异常原样透传给调用方。
 * 优雅降级同同步版本
 */
export async function runThemeChangeWithTransitionAsync<T>(
  applyChange: () => Promise<T>,
  origin?: ThemeTransitionPoint | null,
  direction: ThemeTransitionDirection = 'expand',
): Promise<T> {
  if (prefersReducedMotion()) {
    return applyChange();
  }
  if (isWebKit()) {
    bindPointerTracking();
    const point = resolveTransitionPoint(origin);
    return runFallbackTransitionAsync(applyChange, point, direction);
  }
  const doc = getViewTransitionDocument();
  if (!doc) {
    bindPointerTracking();
    const point = resolveTransitionPoint(origin);
    return runFallbackTransitionAsync(applyChange, point, direction);
  }
  bindPointerTracking();
  const point = resolveTransitionPoint(origin);
  const outcome: { result?: T; failure?: { error: unknown } } = {};
  try {
    const transition = doc.startViewTransition!(async () => {
      try {
        outcome.result = await applyChange();
      } catch (error) {
        outcome.failure = { error };
      }
    });
    bindContractClass(transition, direction);
    playRevealAnimation(transition, point, direction);
    await transition.updateCallbackDone.catch(() => {});
    await transition.finished.catch(() => {});
  } catch (_) {
    return applyChange();
  }
  if (outcome.failure) {
    throw outcome.failure.error;
  }
  return outcome.result as T;
}

bindPointerTracking();
