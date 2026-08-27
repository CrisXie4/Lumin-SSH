// Z-index scale — centralized management
// All magic numbers should be defined here for consistency.
// Order: lowest (back) → highest (front)

export const Z = {
  // ── Component-internal layering ──
  BG: 0,
  CONTENT: 1,
  STACK: 2,
  SCROLLBAR: 5,
  PANEL_BUTTON: 10,

  // ── Local overlays (loading states, etc.) ──
  COMPONENT_OVERLAY: 50,

  // ── Popup panels (term history/commands, local floating UI) ──
  POPUP_BACKDROP: 99,
  POPUP: 100,

  // ── Anchored popovers under a high parent (e.g. topbar) ──
  POPOVER: 150,

  // ── Nested context menus ──
  MENU_BACKDROP: 199,
  MENU: 200,

  // ── Nested dialogs (QuickCommands confirm, group picker) ──
  DIALOG_BACKDROP: 299,
  DIALOG: 300,
  SUBMENU_BACKDROP: 301,
  SUBMENU: 302,

  // ── Editor toolbars ──
  EDITOR_TOOLBAR: 998,

  // ── System panels / workspace overlays ──
  TRAY_PANEL: 8000,
  FULLSCREEN_OVERLAY: 9000,
  FLOATING_EDITOR: 9001,
  FLOATING_EDITOR_MENU: 9002,

  // ── Chrome / search ──
  TOPBAR: 1000,
  SEARCH_PANEL: 10000,

  // ── Global modals ──
  MODAL: 35000,
  GLOBAL_DIALOG: 38000,
  SETTINGS: 39000,

  // ── Critical app dialogs ──
  SETTINGS_DIALOG: 39001,
  SYSTEM_DIALOG: 39002,

  // ── Absolute top (toasts / system notices) ──
  TOAST: 40000,
} as const;

