import { DiffEditor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import cssWorker from '../../../node_modules/monaco-editor/esm/vs/language/css/css.worker.js?worker'
import htmlWorker from '../../../node_modules/monaco-editor/esm/vs/language/html/html.worker.js?worker'
import jsonWorker from '../../../node_modules/monaco-editor/esm/vs/language/json/json.worker.js?worker'
import tsWorker from '../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAppThemeMode } from '../../utils/theme.js'

let monacoConfigured = false

const DIFF_EDITOR_BASE_OPTIONS = {
  automaticLayout: true,
  readOnly: true,
  domReadOnly: true,
  originalEditable: false,
  renderSideBySide: true,
  useInlineViewWhenSpaceIsLimited: false,
  enableSplitViewResizing: true,
  renderIndicators: true,
  renderOverviewRuler: true,
  renderMarginRevertIcon: false,
  diffAlgorithm: 'advanced',
  ignoreTrimWhitespace: false,
  minimap: { enabled: false },
  glyphMargin: false,
  folding: false,
  lineNumbers: 'on',
  lineNumbersMinChars: 4,
  lineDecorationsWidth: 10,
  scrollBeyondLastLine: false,
  roundedSelection: false,
  overviewRulerBorder: false,
  wordWrap: 'off',
  renderWhitespace: 'selection',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 20,
  tabSize: 2,
  padding: { top: 8, bottom: 8 },
  smoothScrolling: true,
  stickyScroll: { enabled: false },
  guides: { indentation: false, bracketPairs: false },
  bracketPairColorization: { enabled: false },
  hideUnchangedRegions: {
    enabled: false,
    contextLineCount: 4,
    minimumLineCount: 2,
    revealLineCount: 4,
  },
}

const LANGUAGE_BY_EXTENSION = {
  bat: 'bat',
  c: 'c',
  cc: 'cpp',
  conf: 'plaintext',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  cxx: 'cpp',
  dockerfile: 'dockerfile',
  go: 'go',
  h: 'c',
  hpp: 'cpp',
  htm: 'html',
  html: 'html',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  less: 'less',
  md: 'markdown',
  mjs: 'javascript',
  php: 'php',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'shell',
  sql: 'sql',
  svg: 'xml',
  swift: 'swift',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plaintext',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'shell',
}

function ensureMonacoConfigured() {
  if (monacoConfigured || typeof globalThis === 'undefined') {
    return
  }
  globalThis.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    },
  }
  loader.config({ monaco })
  monacoConfigured = true
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n')
}

function resolveMonacoThemeName() {
  return getAppThemeMode() === 'light' ? 'vs' : 'vs-dark'
}

function resolveLanguageFromPath(path) {
  const normalizedPath = String(path || '').trim().replace(/\\/g, '/')
  const fileName = normalizedPath.split('/').pop() || ''
  const lowerFileName = fileName.toLowerCase()
  if (!lowerFileName) {
    return 'plaintext'
  }
  if (lowerFileName === 'dockerfile') {
    return 'dockerfile'
  }
  if (lowerFileName.endsWith('.d.ts')) {
    return 'typescript'
  }
  const matched = lowerFileName.match(/\.([a-z0-9_-]+)$/)
  if (!matched) {
    return 'plaintext'
  }
  return LANGUAGE_BY_EXTENSION[matched[1]] || 'plaintext'
}

function buildModelPath(path, reviewId, index, side) {
  const normalizedPath = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  const fallbackPath = `review-${reviewId || 'current'}-${index || 0}.txt`
  const relativePath = normalizedPath || fallbackPath
  const encodedPath = relativePath.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/')
  return `file:///ai-change-review/${encodeURIComponent(String(reviewId || 'current'))}/${index || 0}/${side}/${encodedPath}`
}

function buildLoadingNode(text) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-base)',
        color: 'var(--text-secondary)',
        fontSize: 12,
      }}>
      {text}
    </div>
  )
}

ensureMonacoConfigured()

export function DiffEditorPair({ block, index, path = '', reviewId = '', showBlockBadge = false, t, onNavigateReady = null }) {
  const [themeName, setThemeName] = useState(resolveMonacoThemeName())
  const editorRef = useRef(null)
  const diffUpdateDisposableRef = useRef(null)
  const firstDiffRevealedRef = useRef(false)
  const original = typeof block?.before === 'string' ? normalizeText(block.before) : ''
  const modified = typeof block?.after === 'string' ? normalizeText(block.after) : ''
  const declaredStartLine = Number(block?.startLine)
  const matchedStartLine = Number(block?.matchedStartLine)
  const labelKey = typeof block?.label === 'string' && block.label.trim() ? block.label.trim() : '变更块 #{count}'
  const labelParams = block?.labelParams && typeof block.labelParams === 'object' ? block.labelParams : { count: index + 1 }
  const label = t(labelKey, labelParams)
  const language = useMemo(() => resolveLanguageFromPath(path), [path])
  const originalModelPath = useMemo(() => buildModelPath(path, reviewId, index, 'original'), [index, path, reviewId])
  const modifiedModelPath = useMemo(() => buildModelPath(path, reviewId, index, 'modified'), [index, path, reviewId])
  const focusLine = Number.isFinite(matchedStartLine) && matchedStartLine > 0
    ? matchedStartLine
    : Number.isFinite(declaredStartLine) && declaredStartLine > 0
      ? declaredStartLine
      : 1
  const showMetaBar = showBlockBadge || (Number.isFinite(matchedStartLine) && matchedStartLine > 0)
  const editorOptions = useMemo(() => ({
    ...DIFF_EDITOR_BASE_OPTIONS,
    ariaLabel: String(path || label || 'diff editor'),
  }), [label, path])
  const goToDiff = useCallback((target) => {
    editorRef.current?.goToDiff(target)
  }, [])
  const revealFirstDiff = useCallback(() => {
    const editor = editorRef.current
    if (!editor || firstDiffRevealedRef.current) {
      return
    }
    const lineChanges = editor.getLineChanges()
    if (!Array.isArray(lineChanges) || lineChanges.length === 0) {
      return
    }
    firstDiffRevealedRef.current = true
    editor.goToDiff('next')
  }, [])
  useEffect(() => {
    if (typeof onNavigateReady !== 'function') {
      return undefined
    }
    onNavigateReady(goToDiff)
    return () => onNavigateReady(null)
  }, [goToDiff, onNavigateReady])
  useEffect(() => {
    firstDiffRevealedRef.current = false
  }, [original, modified])
  useEffect(() => () => {
    diffUpdateDisposableRef.current?.dispose()
    diffUpdateDisposableRef.current = null
    editorRef.current = null
  }, [])
  useEffect(() => {
    const refreshTheme = () => setThemeName(resolveMonacoThemeName())
    refreshTheme()
    window.addEventListener('theme-mode-changed', refreshTheme)
    window.addEventListener('theme-package-changed', refreshTheme)
    window.addEventListener('theme-preview-changed', refreshTheme)
    window.addEventListener('terminal-theme-changed', refreshTheme)
    return () => {
      window.removeEventListener('theme-mode-changed', refreshTheme)
      window.removeEventListener('theme-package-changed', refreshTheme)
      window.removeEventListener('theme-preview-changed', refreshTheme)
      window.removeEventListener('terminal-theme-changed', refreshTheme)
    }
  }, [])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: showMetaBar ? '34px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        minHeight: 0,
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--surface-base)',
      }}>
      {showMetaBar ? (
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 10px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
          }}>
          <div
            style={{
              minWidth: 0,
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            {label}
          </div>
          {Number.isFinite(matchedStartLine) && matchedStartLine > 0 ? (
            <div
              style={{
                flexShrink: 0,
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}>
              {`L${matchedStartLine}`}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ minHeight: 0 }}>
        <DiffEditor
          height="100%"
          width="100%"
          original={original}
          modified={modified}
          language={language}
          originalModelPath={originalModelPath}
          modifiedModelPath={modifiedModelPath}
          keepCurrentOriginalModel={false}
          keepCurrentModifiedModel={false}
          theme={themeName}
          line={focusLine}
          loading={buildLoadingNode(t('加载中...'))}
          options={editorOptions}
          onMount={(editor) => {
            editorRef.current = editor
            diffUpdateDisposableRef.current?.dispose()
            diffUpdateDisposableRef.current = editor.onDidUpdateDiff(revealFirstDiff)
            revealFirstDiff()
            if (focusLine > 0 && !firstDiffRevealedRef.current) {
              editor.revealLineInCenter(focusLine)
            }
          }}
        />
      </div>
    </div>
  )
}