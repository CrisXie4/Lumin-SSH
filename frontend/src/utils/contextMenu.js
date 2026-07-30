export const GLOBAL_CONTEXT_MENU_OPEN_EVENT = 'lumin-open-context-menu'

export function openGlobalContextMenu(detail) {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent(GLOBAL_CONTEXT_MENU_OPEN_EVENT, { detail }))
}