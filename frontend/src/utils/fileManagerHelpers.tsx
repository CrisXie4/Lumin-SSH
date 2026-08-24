import React from 'react';
import { getLanguage, type I18nKey } from '../i18n.ts';
import {
  Folder, FolderOpen, FolderPlus, File, FileText, FilePlus, FileCode,
  FileArchive, Settings, ClipboardList, Wrench, Image, Code, Globe, House,
  Palette, Database, Terminal, Film, Music, Archive, HardDrive, BookOpen,
  Pencil, PenLine, Download, Upload, Trash2, RefreshCw, Lock, FolderUp, SquarePen, Copy,
  Pin, X, ClipboardPaste, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Scissors,
  MonitorSmartphone, PencilLine, FolderSymlink, FileSymlink,
  type LucideIcon,
} from 'lucide-react';
import { isArchive, isBinaryLike, isViewable } from './fileTypeClassify.ts';

/** 与 fileWorkbench.FileManagerTabLike 兼容的宽松标签页形状 */
type FileManagerTabLike = import('./fileWorkbench').FileManagerTabLike
type FileManagerTab = import('./fileWorkbench').FileManagerTab

interface FileManagerWorkspaceTab {
  pinned?: unknown
  systemPinned?: unknown
  id?: unknown
  path?: unknown
  customTitle?: unknown
}

interface FileManagerWorkspace {
  tabs?: unknown
}

// 远程/本地文件条目：ListDir 输出 + 本地传输占位的统一形状
interface FileManagerFileItem {
  name: string
  isDirectory: boolean
  size?: number
  permission?: string
  mode?: string
  modifyTime?: number
  uid?: string
  gid?: string
  isSymlink?: boolean
  __rowKey?: string
  __luminDeletedPlaceholder?: boolean
  [key: string]: unknown
}

type LooseT = (key: I18nKey, vars?: Record<string, unknown>) => string

export interface RowEffectState {
  logicalKey: string
  rowKey: string
  effect: string
  paneKey: string
  startedAt?: number
  durationMs?: number
}

export interface FileListViewAnchor {
  key: string
  offset: number
  scrollTop: number
}

export interface ChmodPerms {
  user: { r: boolean; w: boolean; x: boolean }
  group: { r: boolean; w: boolean; x: boolean }
  other: { r: boolean; w: boolean; x: boolean }
}

export interface DownloadConflictSettings {
  strategy: string
  diffBySize: boolean
  diffByMtime: boolean
  renameSuffixMode: string
}

export interface FileManagerDownloadConflictSettings {
  strategy?: unknown
  diffBySize?: unknown
  diffByMtime?: unknown
  renameSuffixMode?: unknown
  pathStrategies?: unknown
}

export interface FileManagerVirtualRange {
  startIndex?: unknown
  endIndex?: unknown
  [key: string]: unknown
}

export interface FileManagerVirtualRow {
  rowKey: string
  rowType: string
  logicalPath: string
  sourcePath: string
  isDirectory: boolean
  name: string
  item: FileManagerFileItem | null
}

export interface IdentityPresetOption {
  id: string
  name: string
}

export interface IdentityOption extends IdentityPresetOption {
  label: string
  searchText: string
}


export interface FileManagerPaneEffectState {
  pendingVisualEffects: Map<string, RowEffectState>
}

export interface FileManagerPaneViewState {
  pendingRestore: FileListViewAnchor | null
  lastVisibleAnchor: FileListViewAnchor | null
}

// FileManager 纯辅助函数（列宽测量/格式化/图标/排序/并发限制/身份解析等），
// 从 FileManager.tsx 抽出，无 React 状态依赖。
export const FILE_LIST_ACTIONS_COLUMN_WIDTH = 110;
export const FILE_LIST_NAME_MIN_WIDTH = 120;
export const FILE_LIST_SIZE_MIN_WIDTH = 60;
export const FILE_LIST_PERMISSION_MIN_WIDTH = 120;
export const FILE_LIST_MODIFIED_MIN_WIDTH = 110;
export const FILE_LIST_SIZE_MAX_WIDTH = 160;
export const FILE_LIST_PERMISSION_MAX_WIDTH = 420;
export const FILE_LIST_MODIFIED_MAX_WIDTH = 210;

export const fileListMeasureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

export function measureFileListTextWidth(text: unknown, font: unknown) {
  if (!fileListMeasureCanvas) {
    return String(text || '').length * 8;
  }
  const ctx = fileListMeasureCanvas.getContext('2d');
  if (!ctx) {
    return String(text || '').length * 8;
  }
  ctx.font = String(font || '');
  return ctx.measureText(String(text || '')).width;
}

export function clampFileListColumnWidth(width: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.ceil(width)));
}

export function fmtSize(bytes: unknown) {
  const normalizedBytes = Number(bytes) || 0;
  if (!normalizedBytes) return '-';
  if (normalizedBytes < 1024) return `${normalizedBytes} B`;
  if (normalizedBytes < 1024 ** 2) return `${(normalizedBytes / 1024).toFixed(1)} KB`;
  if (normalizedBytes < 1024 ** 3) return `${(normalizedBytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(normalizedBytes / 1024 ** 3).toFixed(1)} GB`;
}

// 格式化日期
export function fmtDate(ts: unknown) {
  if (!ts) return '-';
  const lang = getLanguage();
  const locale = typeof lang === 'string' && lang.trim() ? lang : 'zh-CN';
  const date = new Date(typeof ts === 'string' || typeof ts === 'number' ? ts : Number(ts) || 0);
  return date.toLocaleString(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function isMissingUnzipError(error: unknown) {
  const message = String(error || '').toLowerCase();
  return /(?:bash|sh):\s*unzip:\s*command not found/.test(message)
    || (message.includes('unzip') && message.includes('command not found'))
    || (message.includes('unzip') && message.includes('status 127'));
}

// 文件图标（颜色统一走 CSS 变量，浅/深色主题一致切换）
export const ICON_SIZE = 16;
export function fileIcon(name: unknown, isDir: boolean, isSymlink = false) {
  if (isDir) {
    return (
      <span className={`file-icon-themed file-icon-folder${isSymlink ? ' file-icon-symlink' : ''}`}>
        {isSymlink ? <FolderSymlink size={ICON_SIZE} /> : <Folder size={ICON_SIZE} />}
      </span>
    );
  }
  if (isSymlink) {
    return (
      <span className="file-icon-themed file-icon-default file-icon-symlink">
        <FileSymlink size={ICON_SIZE} />
      </span>
    );
  }
  const lowerName = String(name || '').toLowerCase();
  let ext = (lowerName.split('.').pop() || '').toLowerCase();
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) ext = 'dockerfile';
  if (lowerName === 'makefile') ext = 'makefile';
  if (lowerName === 'cmakelists.txt') ext = 'cmake';
  if (lowerName === 'nginx.conf') ext = 'nginx';

  const iconMap: Record<string, LucideIcon> = {
    js: Code, jsx: Code, mjs: Code, cjs: Code, ts: Code, tsx: Code, vue: Code,
    py: Terminal, pyw: Terminal, pyi: Terminal, rb: HardDrive, lua: Code, go: Code, rs: Code, java: Code,
    c: Code, cc: Code, cpp: Code, cxx: Code, h: Code, hpp: Code, hh: Code, hxx: Code, cs: Code,
    html: Globe, htm: Globe, css: Palette, scss: Palette, less: Palette,
    json: Settings, yaml: Settings, yml: Settings, toml: Settings, ini: Settings, env: Settings, cfg: Settings, conf: Settings,
    md: FileText, txt: File, log: ClipboardList,
    png: Image, jpg: Image, jpeg: Image, gif: Image, svg: Image, webp: Image,
    zip: FileArchive, tar: FileArchive, gz: FileArchive, rar: FileArchive, '7z': FileArchive, tgz: FileArchive, bz2: FileArchive,
    sh: Wrench, bash: Wrench, zsh: Wrench, ksh: Wrench, ps1: Wrench, psm1: Wrench, psd1: Wrench,
    pdf: BookOpen, sql: Database, xml: FileCode, php: Terminal,
    mp4: Film, mkv: Film, avi: Film,
    mp3: Music, wav: Music,
    pl: Terminal, pm: Terminal, diff: FileCode, patch: FileCode,
    dockerfile: FileCode, makefile: FileCode, cmake: FileCode, nginx: FileCode,
  };
  // Sanitize class fragment: keep alnum/._- only
  const safeExt = (ext || 'default').replace(/[^a-z0-9._-]/gi, '') || 'default';
  const IconComp = iconMap[ext] || File;
  return (
    <span className={`file-icon-themed file-icon-${safeExt}`}>
      <IconComp size={ICON_SIZE} />
    </span>
  );
}

// 判断是否可以编辑（文本文件）
export function isEditable(name: string) {
  // ponytail: 以 . 开头的文件（如 .htaccess, .bashrc, .env）视为配置文件，默认可编辑
  if (name.startsWith('.')) return true;
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.ca-bundle')) return true;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const editable = [
    'txt', 'md', 'log', 'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'env', 'conf', 'config',
    'cer', 'crt', 'cert', 'pem', 'key', 'csr', 'pub', 'header', 'ca-bundle',
    'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'pyw', 'pyi', 'rb', 'lua', 'go', 'rs', 'java', 'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'hh', 'hxx', 'cs',
    'php', 'html', 'htm', 'css', 'scss', 'less', 'xml', 'svg', 'sql', 'sh', 'bash', 'zsh', 'ksh', 'ps1', 'psm1', 'psd1',
    'pl', 'pm', 'vue', 'svelte', 'diff', 'patch', 'cmake',
    'list', 'sources', 'repo', 'nginx', 'gitignore', 'dockerfile', 'makefile',
  ];
  if (editable.includes(ext)) return true;
  // special filenames
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.') || lowerName === 'cmakelists.txt' || lowerName === 'makefile' || lowerName === 'nginx.conf') {
    return true;
  }
  // No extension (like Dockerfile, Makefile)
  if (!name.includes('.')) return true;
  return false;
}

// Track files currently being downloaded/opened
export const globalOpeningFiles = new Set<string>();
export const globalOpeningListeners = new Set<(files: Set<string>) => void>();
// key -> safety-timeout id, so removeOpeningFile can clear pending timers
export const globalOpeningTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function addOpeningFile(sessionId: unknown, path: unknown) {
  if (!sessionId || !path) return;
  const key = `${sessionId}:${path}`;
  globalOpeningFiles.add(key);
  notifyOpeningListeners();

  // 5-minute safety timeout to prevent permanent lock leakage in case of backend hang.
  // Defensive: replace any stale timer for this key before scheduling a new one.
  if (globalOpeningTimers.has(key)) {
    clearTimeout(globalOpeningTimers.get(key));
  }
  const timer = setTimeout(() => {
    globalOpeningTimers.delete(key);
    if (globalOpeningFiles.has(key)) {
      globalOpeningFiles.delete(key);
      notifyOpeningListeners();
    }
  }, 5 * 60 * 1000);
  globalOpeningTimers.set(key, timer);
}

export function removeOpeningFile(sessionId: unknown, path: unknown) {
  if (!sessionId || !path) return;
  const key = `${sessionId}:${path}`;
  // Cancel the pending safety-timeout so normal fast opens leave no dangling timer
  if (globalOpeningTimers.has(key)) {
    clearTimeout(globalOpeningTimers.get(key));
    globalOpeningTimers.delete(key);
  }
  globalOpeningFiles.delete(key);
  notifyOpeningListeners();
}

export function notifyOpeningListeners() {
  const currentSet = new Set(globalOpeningFiles);
  globalOpeningListeners.forEach(listener => listener(currentSet));
}


// 压缩包/二进制/媒体文件类型判定已抽到 utils/fileTypeClassify.js（isArchive/isBinaryLike/isViewable）

// 文件编辑大小上限默认值（MB）；实际值由用户配置，组件内 maxEditSizeMB state 持有
export const DEFAULT_MAX_EDIT_SIZE_MB = 5;
export const MAX_CHUNK_UPLOAD_RETRIES = 5;
export const UPLOAD_ABORT_SENTINEL = '__LUMIN_UPLOAD_ABORTED__';
export const DEFAULT_FILE_MANAGER_DOWNLOAD_DIR = '${APP_DIR}\\download';
export const DOWNLOAD_CONFLICT_STRATEGY_DIFF_OVERWRITE = 'diff_overwrite';
export const DOWNLOAD_CONFLICT_STRATEGY_FORCE_OVERWRITE = 'force_overwrite';
export const DOWNLOAD_CONFLICT_STRATEGY_PROMPT = 'prompt';
export const DOWNLOAD_CONFLICT_STRATEGY_AUTO_RENAME = 'auto_rename';
export const DOWNLOAD_RENAME_SUFFIX_TIMESTAMP = 'timestamp';
export const DOWNLOAD_RENAME_SUFFIX_RANDOM = 'random';
export const DOWNLOAD_RENAME_SUFFIX_SEQUENCE = 'sequence';
export const UPLOAD_PANEL_CLOSE_ANIMATION_MS = 100;
export const FILE_MANAGER_INTERNAL_DRAG_MIME = 'application/x-lumin-file-manager-items';
export const FILE_MANAGER_NEW_TAB_PATH_MODE_INHERIT_CURRENT = 'inherit_current';
export const FILE_MANAGER_NEW_TAB_PATH_MODE_ROOT = 'root';
export const FILE_MANAGER_NEW_TAB_PATH_MODE_SESSION_INITIAL_PATH = 'session_initial_path';
export const FILE_MANAGER_NEW_TAB_PATH_MODE_TERMINAL_CWD = 'terminal_cwd';
export const FILE_MANAGER_SYSTEM_TAB_KIND_HOME = 'home';
export const FILE_MANAGER_SYSTEM_TAB_KIND_CWD = 'cwd';
export const FILE_MANAGER_LAYOUT_MODE_CLASSIC = 'classic';
export const FILE_MANAGER_LAYOUT_MODE_SIDEBAR_DUAL = 'sidebar_dual';

export function getFileManagerSystemTabType(tab: FileManagerTabLike | null | undefined) {
  if (String(tab?.systemPinnedType || '').trim() === FILE_MANAGER_SYSTEM_TAB_KIND_CWD) {
    return '';
  }
  if (tab?.systemPinned === true) {
    return FILE_MANAGER_SYSTEM_TAB_KIND_HOME;
  }
  return '';
}

export function areFileManagerTabStatesEqual(left: FileManagerTabLike | null | undefined, right: FileManagerTabLike | null | undefined) {
  if (!left || !right) {
    return false;
  }
  const leftSelectedPaths = Array.isArray(left.selectedPaths) ? left.selectedPaths : [];
  const rightSelectedPaths = Array.isArray(right.selectedPaths) ? right.selectedPaths : [];
  return String(left.id || '').trim() === String(right.id || '').trim()
    && String(left.path || '').trim() === String(right.path || '').trim()
    && String(left.customTitle || '').trim() === String(right.customTitle || '').trim()
    && String(left.sortField || '').trim() === String(right.sortField || '').trim()
    && String(left.sortDir || '').trim() === String(right.sortDir || '').trim()
    && leftSelectedPaths.length === rightSelectedPaths.length
    && leftSelectedPaths.every((path, index) => path === rightSelectedPaths[index])
    && Number.isFinite(Number(left.scrollTop)) === Number.isFinite(Number(right.scrollTop))
    && Number(left.scrollTop || 0) === Number(right.scrollTop || 0)
    && (left.pinned === true) === (right.pinned === true)
    && (left.systemPinned === true) === (right.systemPinned === true)
    && getFileManagerSystemTabType(left) === getFileManagerSystemTabType(right);
}

export function createLocalItemShell(name: unknown, isDirectory: boolean, sourceItem: Record<string, unknown> = {}): FileManagerFileItem {
  const normalizedName = String(name || '').trim();
  return {
    name: normalizedName,
    isDirectory: Boolean(isDirectory),
    size: Boolean(isDirectory) ? 0 : Number(sourceItem?.size || 0),
    permission: String(sourceItem?.permission || '').trim(),
    mode: String(sourceItem?.mode || '').trim(),
    modifyTime: typeof sourceItem?.modifyTime === 'number' ? sourceItem.modifyTime : Date.now(),
    uid: String(sourceItem?.uid || '-').trim() || '-',
    gid: String(sourceItem?.gid || '-').trim() || '-',
  };
}

export function upsertLocalItem(items: FileManagerFileItem[], nextItem: FileManagerFileItem): FileManagerFileItem[] {
  const currentItems = Array.isArray(items) ? items : [];
  const normalizedName = String(nextItem?.name || '').trim();
  if (!normalizedName) {
    return currentItems;
  }
  const filteredItems = currentItems.filter((item) => String(item?.name || '').trim() !== normalizedName);
  return [...filteredItems, { ...nextItem, name: normalizedName }];
}

let fileManagerTabSequence = 0;

export function getFileManagerNewTabPathMode() {
  return localStorage.getItem('fileManagerNewTabPathMode') || FILE_MANAGER_NEW_TAB_PATH_MODE_INHERIT_CURRENT;
}

export function getFileManagerInitialPathMode() {
  return localStorage.getItem('fileManagerInitialPathMode') || FILE_MANAGER_NEW_TAB_PATH_MODE_SESSION_INITIAL_PATH;
}

export function shouldShowFileManagerTabIcons() {
  return localStorage.getItem('fileManagerShowTabIcons') !== 'false';
}

export function shouldHideFileManagerTabCloseButton() {
  return localStorage.getItem('fileManagerHideTabCloseButton') === 'true';
}

export function getFileManagerLayoutMode() {
  return localStorage.getItem('fileManagerLayoutMode') === FILE_MANAGER_LAYOUT_MODE_SIDEBAR_DUAL
    ? FILE_MANAGER_LAYOUT_MODE_SIDEBAR_DUAL
    : FILE_MANAGER_LAYOUT_MODE_CLASSIC;
}

export function isFileManagerSharedPinnedTabsEnabled() {
  return localStorage.getItem('fileManagerSharedPinnedTabs') === 'true';
}

export function isFileManagerDualPaneDragTransferEnabled() {
  return localStorage.getItem('fileManagerDualPaneDragTransferEnabled') !== 'false';
}

export function shouldPromptFileManagerDualPaneDragDirectory() {
  return localStorage.getItem('fileManagerDualPaneDragPromptOnDirectory') !== 'false';
}

export function shouldInvertFileManagerDualPaneDragModifier() {
  return localStorage.getItem('fileManagerDualPaneDragInvertModifier') === 'true';
}

export function createFileManagerTab(path = '', options: Record<string, unknown> = {}): FileManagerTab {
  fileManagerTabSequence += 1;
  return {
    id: `file-manager-tab-${Date.now()}-${fileManagerTabSequence}`,
    path: String(path || '').trim(),
    customTitle: String(options.customTitle || '').trim(),
    sortField: 'name',
    sortDir: 'asc',
    selectedPaths: [],
    scrollTop: 0,
    pinned: options.pinned === true || options.systemPinned === true,
    systemPinned: options.systemPinned === true,
    systemPinnedType: options.systemPinned === true ? FILE_MANAGER_SYSTEM_TAB_KIND_HOME : '',
  };
}

export function extractManualPinnedTabsFromWorkspace(workspace: FileManagerWorkspace) {
  const rawTabs = workspace?.tabs
  const tabs = Array.isArray(rawTabs) ? rawTabs : [];
  return tabs
    .filter((tab) => tab && tab.pinned === true && tab.systemPinned !== true)
    .map((tab) => ({
      id: String(tab.id || '').trim(),
      path: String(tab.path || '').trim(),
      customTitle: typeof tab.customTitle === 'string' ? tab.customTitle.trim() : '',
    }))
    .filter((tab) => tab.id);
}

export function mergeSharedPinnedTabsIntoWorkspaceTabs(localTabs: FileManagerWorkspaceTab[], sharedPinnedTabs: FileManagerWorkspaceTab[]): FileManagerTab[] {
  const tabs = Array.isArray(localTabs) ? localTabs : [];
  const shared = Array.isArray(sharedPinnedTabs) ? sharedPinnedTabs : [];
  const homeTabs = tabs.filter((tab) => tab && tab.systemPinned === true);
  const localPinnedById = new Map();
  const localPinnedByPath = new Map();
  tabs.forEach((tab) => {
    if (tab && tab.systemPinned !== true && tab.pinned === true) {
      const id = String(tab.id || '').trim();
      const path = String(tab.path || '').trim();
      if (id) localPinnedById.set(id, tab);
      if (path && !localPinnedByPath.has(path)) localPinnedByPath.set(path, tab);
    }
  });
  const sharedIds = new Set(shared.map((tab) => String(tab.id || '').trim()).filter(Boolean));
  const sharedPaths = new Set(shared.map((tab) => String(tab.path || '').trim()).filter(Boolean));
  const mappedPinnedTabs = shared.map((sharedTab) => {
    const sharedId = String(sharedTab.id || '').trim();
    const sharedPath = String(sharedTab.path || '').trim();
    const existing = localPinnedById.get(sharedId) || localPinnedByPath.get(sharedPath) || null;
    return {
      id: existing ? (String(existing.id || '').trim() || sharedId) : sharedId,
      path: sharedPath,
      customTitle: String(sharedTab.customTitle || '').trim(),
      sortField: typeof existing?.sortField === 'string' ? existing.sortField : 'name',
      sortDir: existing?.sortDir === 'desc' ? 'desc' : 'asc',
      selectedPaths: Array.isArray(existing?.selectedPaths) ? existing.selectedPaths : [],
      scrollTop: Number.isFinite(Number(existing?.scrollTop)) ? Number(existing.scrollTop) : 0,
      pinned: true,
      systemPinned: false,
      systemPinnedType: '',
    };
  });
  const remainderTabs = tabs
    .filter((tab) => {
      if (!tab || tab.systemPinned === true) return false;
      if (tab.pinned === true) {
        const id = String(tab.id || '').trim();
        const path = String(tab.path || '').trim();
        return !(sharedIds.has(id) || sharedPaths.has(path));
      }
      return true;
    })
    .map((tab) => (tab.pinned === true ? { ...tab, pinned: false } : tab));
  // homeTabs/remainderTabs 为持久化 tab（字段已归一化），断言为完整 FileManagerTab
  return [...homeTabs, ...mappedPinnedTabs, ...remainderTabs] as FileManagerTab[];
}

export function getFileManagerTabLabel(path: unknown, t: LooseT, customTitle: unknown = '') {
  const normalizedCustomTitle = String(customTitle || '').trim();
  if (normalizedCustomTitle) {
    return normalizedCustomTitle;
  }
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath || normalizedPath === '/') {
    return t('目录根');
  }
  const parts = normalizedPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || t('目录根');
}

export function renderFileManagerTabTitle(tab: FileManagerTabLike, t: LooseT) {
  const systemTabType = getFileManagerSystemTabType(tab);
  if (systemTabType === FILE_MANAGER_SYSTEM_TAB_KIND_HOME) {
    return <House size={12} />;
  }
  return <span>{getFileManagerTabLabel(tab?.path, t, tab?.customTitle)}</span>;
}

export function cloneFileManagerItemsForCache(items: unknown): FileManagerFileItem[] {
  return Array.isArray(items)
    ? items
      .filter((item) => item && typeof item === 'object' && !item.__luminDeletedPlaceholder)
      .map((item) => ({ ...item }))
    : [];
}

export function getParentPath(path: unknown) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath || normalizedPath === '/') {
    return '/';
  }
  const parts = normalizedPath.split('/').filter(Boolean);
  parts.pop();
  return parts.length > 0 ? `/${parts.join('/')}` : '/';
}

export function buildDirectoryItemFromPath(path: unknown): FileManagerFileItem {
  const normalizedPath = String(path || '').trim();
  const safePath = !normalizedPath ? '/' : normalizedPath;
  if (safePath === '/') {
    return {
      name: '',
      isDirectory: true,
      permission: '',
      mode: '',
      modifyTime: 0,
      size: 0,
    };
  }
  const parts = safePath.split('/').filter(Boolean);
  return {
    name: parts[parts.length - 1] || '',
    isDirectory: true,
    permission: '',
    mode: '',
    modifyTime: 0,
    size: 0,
  };
}

export function sortFileManagerItems(items: FileManagerFileItem[], sortField = 'name', sortDir = 'asc'): FileManagerFileItem[] {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let cmp = 0;
    switch (sortField) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'size': cmp = (a.size || 0) - (b.size || 0); break;
      case 'permissions': cmp = formatPermissionDisplay(a.permission || '-').localeCompare(formatPermissionDisplay(b.permission || '-')); break;
      case 'modified': cmp = new Date(a.modifyTime || 0).getTime() - new Date(b.modifyTime || 0).getTime(); break;
      default: cmp = 0;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

export const FILE_MANAGER_VIRTUAL_ROW_PARENT = 'parent';
export const FILE_MANAGER_VIRTUAL_ROW_ITEM = 'item';

export function buildFileManagerVirtualRows(items: FileManagerFileItem[], directoryPath: unknown): FileManagerVirtualRow[] {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedPath = String(directoryPath || '').trim() || '/';
  const rows = [];
  if (normalizedPath !== '/') {
    rows.push({
      rowKey: `__parent__:${normalizedPath}`,
      rowType: FILE_MANAGER_VIRTUAL_ROW_PARENT,
      logicalPath: getParentPath(normalizedPath),
      sourcePath: normalizedPath,
      isDirectory: true,
      name: '..',
      item: null,
    });
  }
  normalizedItems.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const logicalPath = normalizedPath === '/' ? `/${item.name}` : `${normalizedPath}/${item.name}`;
    rows.push({
      rowKey: item.__rowKey || logicalPath,
      rowType: FILE_MANAGER_VIRTUAL_ROW_ITEM,
      logicalPath,
      sourcePath: normalizedPath,
      isDirectory: item.isDirectory === true,
      name: item.name,
      item,
    });
  });
  return rows;
}

export function findFileManagerVirtualRowIndex(rows: FileManagerVirtualRow[], rowKey: unknown) {
  if (!rowKey) return -1;
  return Array.isArray(rows) ? rows.findIndex((row) => row?.rowKey === rowKey) : -1;
}

export function isFileManagerVirtualRangeVisible(range: FileManagerVirtualRange, index: number) {
  if (!range || index < 0) return false;
  return index >= Number(range.startIndex ?? 0) && index <= Number(range.endIndex ?? -1);
}

export function normalizeFileManagerPaneKey(paneKey: unknown): 'left' | 'right' {
  return paneKey === 'right' ? 'right' : 'left';
}

export function createFileManagerPaneEffectState(): FileManagerPaneEffectState {
  return {
    pendingVisualEffects: new Map(),
  };
}

export function createFileManagerPaneViewState(): FileManagerPaneViewState {
  return {
    pendingRestore: null,
    lastVisibleAnchor: null,
  };
}

// Check if a file name is a hidden/system file that should be skipped
export function isHiddenFile(name: string) {
  return /^\./.test(name) || /^Thumbs\.db$/i.test(name) || /^desktop\.ini$/i.test(name);
}

// Recursively traverse a FileSystemEntry to collect all File objects
export function traverseEntry(entry: FileSystemEntry) {
  return new Promise<File[]>((resolve) => {
    if (entry.isFile) {
      if (isHiddenFile(entry.name)) {
        resolve([]);
        return;
      }
      (entry as FileSystemFileEntry).file((file) => {
        (file as File & { _fullPath?: string })._fullPath = entry.fullPath;
        resolve([file]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const allEntries: FileSystemEntry[] = [];
      let emptyCount = 0;
      function readBatch() {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            emptyCount++;
            // 连续两次返回空数组才确认读取完成（规避 Chrome readEntries 提前返回的 bug）
            if (emptyCount >= 2) {
              Promise.all(allEntries.map((e) => traverseEntry(e))).then((results) => {
                resolve(results.flat());
              });
            } else {
              readBatch();
            }
          } else {
            allEntries.push(...entries);
            emptyCount = 0;
            readBatch();
          }
        }, () => resolve([]));
      }
      readBatch();
    } else {
      resolve([]);
    }
  });
}

// 读取 Blob 为 base64 字符串（去掉 data URL 前缀）
export function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawResult = reader.result;
      const dataUrl = typeof rawResult === 'string' ? rawResult : '';
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function isCompressedTransferEnabled() {
  return localStorage.getItem('fileManagerCompressedTransfer') !== 'false';
}

export function shouldAutoOpenTransferQueue() {
  return localStorage.getItem('fileManagerAutoOpenTransferQueue') !== 'false';
}

export function getDownloadConflictSettingsFromStorage(): DownloadConflictSettings {
  return {
    strategy: localStorage.getItem('fileManagerDownloadConflictStrategy') || DOWNLOAD_CONFLICT_STRATEGY_AUTO_RENAME,
    diffBySize: localStorage.getItem('fileManagerDownloadConflictDiffBySize') !== 'false',
    diffByMtime: localStorage.getItem('fileManagerDownloadConflictDiffByMtime') !== 'false',
    renameSuffixMode: localStorage.getItem('fileManagerDownloadRenameSuffixMode') || DOWNLOAD_RENAME_SUFFIX_SEQUENCE,
  };
}

export function buildDownloadConflictOptionsPayload(settings: FileManagerDownloadConflictSettings, overrides: FileManagerDownloadConflictSettings = {}) {
  const next = { ...settings, ...overrides };
  return JSON.stringify({
    strategy: next.strategy || DOWNLOAD_CONFLICT_STRATEGY_AUTO_RENAME,
    diffBySize: next.diffBySize !== false,
    diffByMtime: next.diffByMtime !== false,
    renameSuffixMode: next.renameSuffixMode || DOWNLOAD_RENAME_SUFFIX_SEQUENCE,
    pathStrategies: next.pathStrategies || {},
  });
}

export function downloadConflictKindLabel(kind: unknown, t: LooseT) {
  if (kind === 'directory') return t('文件夹');
  if (kind === 'file') return t('文件');
  return '-';
}

export function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function computeCompressedOverallProgress(phase: unknown, phaseProgress: unknown, currentProgress = 0) {
  const safePhaseProgress = Math.max(0, Math.min(100, Number(phaseProgress) || 0));
  const baseline = Math.max(0, Math.min(100, Number(currentProgress) || 0));
  switch (phase) {
    case 'compressing':
      return Math.max(baseline, safePhaseProgress * 0.5);
    case 'uploading':
      return Math.max(baseline, 50 + safePhaseProgress * 0.49);
    case 'uploading-file':
      return Math.max(baseline, safePhaseProgress);
    case 'completed':
      return 100;
    case 'preparing':
    case 'scanning':
    case 'extracting':
    case 'cleanup-local':
    case 'cleanup-remote':
    case 'failed':
    default:
      return baseline;
  }
}

export function normalizeChmodMode(value: unknown) {
  const cleaned = String(value || '').replace(/[^0-7]/g, '');
  if (cleaned.length === 4 && cleaned[0] === '0') {
    return cleaned.slice(1);
  }
  return cleaned.slice(0, 3);
}

export function calcChmodOctal(perms: ChmodPerms) {
  const u = (perms.user.r ? 4 : 0) + (perms.user.w ? 2 : 0) + (perms.user.x ? 1 : 0);
  const g = (perms.group.r ? 4 : 0) + (perms.group.w ? 2 : 0) + (perms.group.x ? 1 : 0);
  const o = (perms.other.r ? 4 : 0) + (perms.other.w ? 2 : 0) + (perms.other.x ? 1 : 0);
  return `${u}${g}${o}`;
}

export function permsFromChmodMode(modeStr: unknown): ChmodPerms {
  const normalized = normalizeChmodMode(modeStr) || '644';
  const u = parseInt(normalized[0], 8);
  const g = parseInt(normalized[1], 8);
  const o = parseInt(normalized[2], 8);
  return {
    user: { r: !!(u & 4), w: !!(u & 2), x: !!(u & 1) },
    group: { r: !!(g & 4), w: !!(g & 2), x: !!(g & 1) },
    other: { r: !!(o & 4), w: !!(o & 2), x: !!(o & 1) },
  };
}

export const CHMOD_OWNER_PRESET_OPTIONS = [
  { id: '0', name: 'root' },
  { id: '26', name: 'postgres' },
  { id: '27', name: 'mysql' },
  { id: '33', name: 'www-data' },
  { id: '101', name: 'nginx' },
  { id: '999', name: 'redis' },
  { id: '1000', name: 'ubuntu' },
  { id: '65534', name: 'nobody' },
];

export const CHMOD_GROUP_PRESET_OPTIONS = [
  { id: '0', name: 'root' },
  { id: '4', name: 'adm' },
  { id: '10', name: 'wheel' },
  { id: '27', name: 'sudo' },
  { id: '33', name: 'www-data' },
  { id: '101', name: 'nginx' },
  { id: '999', name: 'redis' },
  { id: '1000', name: 'users' },
  { id: '65534', name: 'nogroup' },
];

export function normalizeIdentityId(value: unknown) {
  const trimmed = String(value ?? '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

export function formatIdentityDisplay(name: unknown, id: unknown) {
  const normalizedId = normalizeIdentityId(id);
  if (!normalizedId) {
    return '-';
  }
  const trimmedName = String(name || '').trim();
  return trimmedName ? `${trimmedName}(${normalizedId})` : normalizedId;
}

export function formatPermissionDisplay(permission: unknown) {
  return String(permission || '-').trim() || '-';
}

export function buildIdentityOptionList(currentId: unknown, presets: IdentityPresetOption[]): IdentityOption[] {
  const normalizedCurrentId = normalizeIdentityId(currentId);
  const presetOptions = Array.isArray(presets) ? presets : [];
  const currentOption = normalizedCurrentId
    ? (presetOptions.find((item) => normalizeIdentityId(item.id) === normalizedCurrentId) || { id: normalizedCurrentId, name: '' })
    : null;
  const options = currentOption
    ? [currentOption, ...presetOptions.filter((item) => normalizeIdentityId(item.id) !== normalizedCurrentId)]
    : presetOptions;
  const seen = new Set();
  return options
    .map((item) => {
      const id = normalizeIdentityId(item.id);
      if (!id) {
        return null;
      }
      const name = String(item.name || '').trim();
      const label = formatIdentityDisplay(name, id);
      return {
        id,
        name,
        label,
        searchText: `${name} ${id} ${label}`.toLowerCase(),
      };
    })
    .filter((item): item is IdentityOption => {
      if (!item || seen.has(item.label)) {
        return false;
      }
      seen.add(item.label);
      return true;
    });
}

export function resolveIdentityInputValue(currentId: unknown, presets: IdentityPresetOption[]) {
  const normalizedCurrentId = normalizeIdentityId(currentId);
  if (!normalizedCurrentId) {
    return '-';
  }
  const matched = (Array.isArray(presets) ? presets : []).find((item) => normalizeIdentityId(item.id) === normalizedCurrentId);
  return formatIdentityDisplay(matched?.name || '', normalizedCurrentId);
}

export function resolveIdentityInputSpec(value: unknown, options: IdentityPresetOption[], fallbackId: unknown = '') {
  const trimmed = String(value ?? '').trim();
  const candidates = Array.isArray(options) ? options : [];
  if (!trimmed || trimmed === '-') {
    return normalizeIdentityId(fallbackId);
  }
  const matched = candidates.find((item) => {
    const normalizedId = normalizeIdentityId(item.id);
    const label = formatIdentityDisplay(item.name, normalizedId);
    return trimmed === label || trimmed === String(item.name || '').trim() || trimmed === normalizedId;
  });
  if (matched) {
    return String(matched.name || '').trim() || normalizeIdentityId(matched.id);
  }
  const labelMatch = trimmed.match(/^(.*)\(([^()]+)\)$/);
  if (labelMatch) {
    const name = String(labelMatch[1] || '').trim();
    const id = normalizeIdentityId(labelMatch[2]);
    return name || id || normalizeIdentityId(fallbackId);
  }
  return trimmed;
}

export function resolveIdentityCompareKey(value: unknown, options: IdentityPresetOption[], fallbackId: unknown = '') {
  const trimmed = String(value ?? '').trim();
  const fallback = normalizeIdentityId(fallbackId);
  const candidates = Array.isArray(options) ? options : [];
  if (!trimmed || trimmed === '-') {
    return fallback ? `id:${fallback}` : '';
  }
  const matched = candidates.find((item) => {
    const normalizedId = normalizeIdentityId(item.id);
    const label = formatIdentityDisplay(item.name, normalizedId);
    return trimmed === label || trimmed === String(item.name || '').trim() || trimmed === normalizedId;
  });
  if (matched) {
    const normalizedId = normalizeIdentityId(matched.id);
    if (normalizedId) {
      return `id:${normalizedId}`;
    }
    const normalizedName = String(matched.name || '').trim().toLowerCase();
    return normalizedName ? `name:${normalizedName}` : '';
  }
  const labelMatch = trimmed.match(/^(.*)\(([^()]+)\)$/);
  if (labelMatch) {
    const name = String(labelMatch[1] || '').trim().toLowerCase();
    const id = normalizeIdentityId(labelMatch[2]);
    if (id) {
      return `id:${id}`;
    }
    return name ? `name:${name}` : '';
  }
  if (/^\d+$/.test(trimmed)) {
    return `id:${trimmed}`;
  }
  return `name:${trimmed.toLowerCase()}`;
}

export function createLimiter(limit: number): (fn: () => unknown) => Promise<unknown> {
  const max = Math.max(1, limit);
  let active = 0;
  const queue: Array<{ fn: () => unknown; resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];
  const next = () => {
    if (active >= max || queue.length === 0) {
      return;
    }
    const entry = queue.shift();
    if (!entry) {
      return;
    }
    const { fn, resolve, reject } = entry;
    active++;
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

export function runWithLimit(items: unknown[], limit: number, handler: (item: unknown, index: number) => unknown) {
  const limiter = createLimiter(limit);
  return Promise.all(items.map((item, index) => limiter(() => handler(item, index))));
}

export function runWithLimitSettled<T>(items: T[], limit: number, handler: (item: T, index: number) => unknown): Promise<PromiseSettledResult<unknown>[]> {
  const limiter = createLimiter(limit);
  return Promise.all(items.map((item, index) => limiter(() => handler(item, index))
    .then((value) => ({ status: 'fulfilled', value }) as PromiseSettledResult<unknown>)
    .catch((reason) => ({ status: 'rejected', reason }) as PromiseSettledResult<unknown>)));
}

export async function uploadChunkWithRetry(label: string, uploadFn: () => Promise<unknown>, onAttempt?: (attempt: number, error: unknown) => void, shouldAbort?: () => boolean) {
  let firstError = null;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_CHUNK_UPLOAD_RETRIES; attempt++) {
    if (shouldAbort?.()) {
      throw new Error(UPLOAD_ABORT_SENTINEL);
    }
    try {
      onAttempt?.(attempt, null);
      return await uploadFn();
    } catch (error) {
      if (!firstError) firstError = error;
      lastError = error;
      onAttempt?.(attempt, error);
    }
  }
  const firstMessage = firstError instanceof Error ? firstError.message : String(firstError || '');
  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError || '');
  if (firstMessage && lastMessage && firstMessage !== lastMessage) {
    throw new Error(`${label} 重试 ${MAX_CHUNK_UPLOAD_RETRIES} 次后仍失败。首次错误: ${firstMessage}；最终错误: ${lastMessage}`);
  }
  throw new Error(`${label} 重试 ${MAX_CHUNK_UPLOAD_RETRIES} 次后仍失败: ${lastMessage || '未知错误'}`);
}
