import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { useTranslation } from '../../../i18n.ts'
import { openGlobalContextMenu } from '../../../utils/contextMenu.ts'
import * as runtime from '../../../../wailsjs/runtime/runtime.js'
import { useAIWorkspaceTabContext } from '../aiWorkspaceTabContext.ts'

// 清理 GFM 自动链接中误吞的非 URL 字符
// 1. 硬截断：HTML 定界符/引号/反斜杠不应出现在 URL 中
// 2. 不匹配的括号：右括号无左括号 → 截断；左括号无右括号 → 截断
// 3. 尾部标点剥离
// 返回 { cleaned, removed } — removed 是被截断的文本，需作为纯文本插回
function cleanAutolinkUrl(url: string) {
  if (!url) return { cleaned: url, removed: '' }
  let cleaned = url
  let removed = ''
  const hardStop = cleaned.search(/["'<>\\]/)
  if (hardStop >= 0) {
    removed = cleaned.slice(hardStop) + removed
    cleaned = cleaned.slice(0, hardStop)
  }
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    const closeIdx = cleaned.indexOf(close)
    if (closeIdx >= 0) {
      const openIdx = cleaned.indexOf(open)
      if (openIdx < 0 || openIdx > closeIdx) {
        removed = cleaned.slice(closeIdx) + removed
        cleaned = cleaned.slice(0, closeIdx)
      }
    } else {
      const openIdx = cleaned.indexOf(open)
      if (openIdx >= 0) {
        removed = cleaned.slice(openIdx) + removed
        cleaned = cleaned.slice(0, openIdx)
      }
    }
  }
  const trailingMatch = cleaned.match(/[.,:!?;]+$/)
  if (trailingMatch) {
    removed = trailingMatch[0] + removed
    cleaned = cleaned.replace(/[.,:!?;]+$/, '')
  }
  return { cleaned, removed }
}

/** remark AST 节点（仅取本插件用到的字段） */
interface MarkdownAstNode {
  type?: string;
  url?: string;
  value?: string;
  children?: MarkdownAstNode[];
}

function remarkCleanAutolinks() {
  return (tree: MarkdownAstNode) => {
    const walk = (node: MarkdownAstNode) => {
      if (!node.children) return
      const nextChildren: MarkdownAstNode[] = []
      for (const child of node.children) {
        if (child.type === 'link' && /^https?:\/\//.test(child.url || '')) {
          const { cleaned, removed } = cleanAutolinkUrl(child.url || '')
          if (cleaned !== child.url) {
            child.url = cleaned
            if (child.children?.length === 1 && child.children[0].type === 'text') {
              child.children[0].value = cleaned
            }
            nextChildren.push(child)
            if (removed) {
              nextChildren.push({ type: 'text', value: removed })
            }
            continue
          }
        }
        nextChildren.push(child)
      }
      node.children = nextChildren
      node.children.forEach(walk)
    }
    walk(tree)
  }
}

function openExternalLink(event: React.MouseEvent<HTMLAnchorElement>, href: unknown) {
  const nextHref = typeof href === 'string' ? href.trim() : ''
  if (!nextHref) {
    return
  }
  const openUrl = window?.runtime?.BrowserOpenURL
  if (typeof openUrl === 'function') {
    event.preventDefault()
    openUrl(nextHref)
  }
}

// react-markdown v9 移除了 code 组件的 inline prop，用 Context 区分行内/块级代码
const PreContext = createContext(false)

// 代码块内 URL 高亮（remark-gfm 不会在 code/inlineCode 内自动链接）
const CODE_URL_RE = /\bhttps?:\/\/[^\s]+/g

function renderCodeChildren(children: ReactNode): ReactNode {
  const text = typeof children === 'string' ? children
    : Array.isArray(children) ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
    : ''
  if (!text) return children
  CODE_URL_RE.lastIndex = 0
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match
  while ((match = CODE_URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const rawUrl = match[0]
    const { cleaned, removed } = cleanAutolinkUrl(rawUrl)
    if (cleaned && /^https?:\/\//.test(cleaned)) {
      parts.push(
        <a key={`code-url-${match.index}`} href={cleaned} target="_blank" rel="noreferrer"
          onClick={(event) => openExternalLink(event, cleaned)}
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          {cleaned}
        </a>
      )
      if (removed) parts.push(removed)
    } else {
      parts.push(rawUrl)
    }
    lastIndex = match.index + rawUrl.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : children
}

function getSelectedTextWithinContainer(container: HTMLElement | null) {
  if (!container || typeof window === 'undefined') {
    return ''
  }
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return ''
  }
  const selectedText = selection.toString().trim()
  if (!selectedText) {
    return ''
  }
  const range = selection.getRangeAt(0)
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer
  const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer
  if (!startNode || !endNode || !container.contains(startNode) || !container.contains(endNode)) {
    return ''
  }
  return selectedText
}

async function copyTextToClipboard(text: string) {
  const nextText = typeof text === 'string' ? text.trim() : ''
  if (!nextText) {
    return
  }
  try {
    await runtime.ClipboardSetText(nextText)
    return
  } catch {}
  try {
    await navigator.clipboard.writeText(nextText)
  } catch {}
}

const markdownComponents: Components = {
  p: ({ children }) => <p style={{ margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: 20 }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '2px 0', lineHeight: 1.7 }}>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => openExternalLink(event, href)}
      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  ),
  code: ({ children }) => {
    const isBlock = useContext(PreContext)
    const content = renderCodeChildren(children)
    if (!isBlock) {
      return (
        <code
          style={{
            padding: '2px 6px',
            borderRadius: 6,
            background: 'rgba(var(--accent-rgb), 0.08)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {content}
        </code>
      )
    }
    return (
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}
      >
        {content}
      </code>
    )
  },
  pre: ({ children }) => (
    <PreContext.Provider value={true}>
      <pre
        style={{
          margin: '0 0 12px',
          padding: '12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </pre>
    </PreContext.Provider>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '0 0 12px',
        padding: '4px 0 4px 12px',
        borderLeft: '3px solid rgba(var(--accent-rgb), 0.4)',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h1 style={{ margin: '0 0 12px', fontSize: 22, lineHeight: 1.35 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ margin: '0 0 10px', fontSize: 18, lineHeight: 1.4 }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.45 }}>{children}</h3>,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '0 0 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ border: '1px solid var(--border)', padding: '8px 10px', textAlign: 'left', background: 'var(--surface-base)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: '1px solid var(--border)', padding: '8px 10px', verticalAlign: 'top' }}>
      {children}
    </td>
  ),
}

interface AIChatMarkdownProps {
  text?: string
  enableQuoteContextMenu?: boolean
}

export default function AIChatMarkdown({ text, enableQuoteContextMenu = false }: AIChatMarkdownProps) {
  const { t, lang } = useTranslation()
  const { sessionId, terminalId, tabId } = useAIWorkspaceTabContext()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!enableQuoteContextMenu || typeof window === 'undefined') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const selectedText = getSelectedTextWithinContainer(containerRef.current)
    openGlobalContextMenu({
      x: Number(event.clientX) || 0,
      y: Number(event.clientY) || 0,
      estimatedWidth: 176,
      estimatedHeight: 84,
      items: [
        {
          key: 'copy',
          label: t('复制'),
          shortcut: 'Ctrl+C',
          disabled: !selectedText,
          onSelect: async () => {
            await copyTextToClipboard(selectedText)
          },
        },
        {
          key: 'quote',
          label: t('引用'),
          disabled: !selectedText,
          onSelect: () => {
            if (!selectedText) {
              return
            }
            window.dispatchEvent(new CustomEvent('ai-quote-selection', {
              detail: { text: selectedText, sessionId, terminalId, tabId },
            }))
          },
        },
      ],
    })
  }, [enableQuoteContextMenu, t, lang, sessionId, terminalId, tabId])

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      style={{ minWidth: 0, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7, wordBreak: 'break-word', position: 'relative' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCleanAutolinks]} rehypePlugins={[rehypeSanitize]} components={markdownComponents}>
        {text || ''}
      </ReactMarkdown>
    </div>
  )
}
