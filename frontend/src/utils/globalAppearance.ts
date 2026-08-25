const GLOBAL_APPEARANCE_CHANGED_EVENT = 'global-appearance-changed'

export interface GlobalAppearanceSettings {
  backgroundImage: string
  backgroundOpacity: number
  iconOpacity: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function getGlobalAppearanceSettings(): GlobalAppearanceSettings {
  const parseStored = (key: string, fallback: number) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value = Number.parseFloat(raw)
    return Number.isNaN(value) ? fallback : value
  }
  return {
    backgroundImage: localStorage.getItem('globalBgImage') || '',
    backgroundOpacity: clamp(parseStored('globalBgOpacity', 0.12), 0, 0.5),
    iconOpacity: clamp(parseStored('globalIconOpacity', 1), 0.4, 1),
  }
}

const WALLPAYER_LAYER_ID = 'global-wallpaper-layer'
const EXEMPT_ATTR = 'data-wallpaper-exempt'

// ponytail: 终端窗格从全局覆盖层镂空（clip-path path(evenodd)，WebView2/Chromium 支持），
// 终端区域只显示自己的壁纸；其余区域正常被全局背景覆盖。
// 限制：常驻 rAF 逐帧测量（窗格通常 <=8 个，开销可忽略）；坐标取整 + 路径去重写入，
// 避免小数边缘反复重铺瓦片产生拖影。

let exemptMaskCleanup: (() => void) | null = null

function applyExemptMask(layer: HTMLElement): void {
  exemptMaskCleanup?.()
  let running = true
  let lastPath = ''
  const refresh = () => {
    // 有模态框时暂停镂空：终端区域与全屏遮罩下的其他区域观感保持一致
    if (document.querySelector('[data-modal-overlay]')) {
      if (lastPath !== '') {
        lastPath = ''
        layer.style.clipPath = ''
      }
      return
    }
    const rects: DOMRect[] = []
    for (const el of document.querySelectorAll<HTMLElement>(`[${EXEMPT_ATTR}]`)) {
      if (getComputedStyle(el).visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      rects.push(new DOMRect(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)))
    }
    const d = rects.length === 0 ? '' : [
      `M0 0H${window.innerWidth}V${window.innerHeight}H0Z`,
      ...rects.map((r) => {
        const right = r.left + r.width
        const bottom = r.top + r.height
        return `M${r.left} ${r.top}H${right}V${bottom}H${r.left}Z`
      }),
    ].join('')
    // 仅在变化时写入：每帧重设样式会触发持续重合成
    if (d !== lastPath) {
      lastPath = d
      layer.style.clipPath = d ? `path(evenodd, '${d}')` : ''
    }
  }
  const loop = () => {
    if (!running) return
    refresh()
    requestAnimationFrame(loop)
  }
  loop()
  exemptMaskCleanup = () => {
    running = false
    layer.style.clipPath = ''
    exemptMaskCleanup = null
  }
}

function ensureWallpaperLayer(): HTMLElement {
  let el = document.getElementById(WALLPAYER_LAYER_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = WALLPAYER_LAYER_ID
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
  }
  return el
}

function removeWallpaperLayer(): void {
  document.getElementById(WALLPAYER_LAYER_ID)?.remove()
}

function applyGlobalAppearance(settings = getGlobalAppearanceSettings()): void {
  const root = document.documentElement
  root.classList.toggle('has-global-wallpaper', Boolean(settings.backgroundImage))

  if (settings.backgroundImage) {
    const layer = ensureWallpaperLayer()
    layer.style.cssText =
      'position:fixed;inset:0;z-index:10000;pointer-events:none;' +
      'transform:translateZ(0);' +
      `background-image:url("${settings.backgroundImage}");` +
      'background-position:center;background-repeat:no-repeat;background-size:cover;' +
      `opacity:${settings.backgroundOpacity};`
      // "覆盖终端"开启时全屏统一用全局背景（不镂空）；关闭时终端窗格镂空、只显示自己的壁纸
      if (localStorage.getItem('globalBgCoverTerminal') === '1') {
        exemptMaskCleanup?.()
      } else {
        applyExemptMask(layer)
      }
  } else {
    exemptMaskCleanup?.()
    removeWallpaperLayer()
  }

  root.style.setProperty('--app-icon-opacity', String(settings.iconOpacity))
}

export function notifyGlobalAppearanceChanged(): void {
  applyGlobalAppearance()
  window.dispatchEvent(new CustomEvent(GLOBAL_APPEARANCE_CHANGED_EVENT))
}

export function initializeGlobalAppearance(): () => void {
  const refresh = () => applyGlobalAppearance()
  applyGlobalAppearance()
  window.addEventListener(GLOBAL_APPEARANCE_CHANGED_EVENT, refresh)
  return () => window.removeEventListener(GLOBAL_APPEARANCE_CHANGED_EVENT, refresh)
}
