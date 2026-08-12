// 桥接模块（自 .js 收编后类型化）：AI 供应商 API Key 粘贴解析器
function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pickTokenFromEntries(entries: unknown): string {
  if (!Array.isArray(entries)) {
    return ''
  }
  const priorityKeys = [
    'access_token',
  ]
  for (const expectedKey of priorityKeys) {
    const normalizedExpectedKey = expectedKey.toLowerCase()
    const matched = entries.find((entry) => {
      const e = entry as { key?: unknown; name?: unknown; value?: unknown } | null | undefined
      const entryKey = typeof e?.key === 'string'
        ? e.key.trim()
        : (typeof e?.name === 'string' ? e.name.trim() : '')
      return entryKey.toLowerCase().includes(normalizedExpectedKey)
    })
    const token = normalizeToken((matched as { value?: unknown } | undefined)?.value)
    if (token) {
      return token
    }
  }
  return ''
}

/** 粘贴处理器辅助能力 */
export interface PasteHandlerHelpers {
  resolveEmbeddedBrowserAPIKey?: (payload: unknown, apiKeyField: unknown) => string
}

export function builtinKimiLocalStorageJsonV1(rawText: unknown, apiKeyField: unknown, helpers: PasteHandlerHelpers = {}): string {
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if (!text) {
    return ''
  }

  try {
    const parsed = JSON.parse(text)
    const entryToken = pickTokenFromEntries(parsed)
    if (entryToken) {
      return entryToken
    }

    if (parsed && typeof parsed === 'object') {
      const resolved = typeof helpers.resolveEmbeddedBrowserAPIKey === 'function'
        ? helpers.resolveEmbeddedBrowserAPIKey(parsed, apiKeyField)
        : ''
      if (typeof resolved === 'string' && resolved.trim()) {
        return resolved.trim()
      }

      const directCandidate = [
        parsed.access_token,
        parsed.accessToken,
      ].find((candidate) => typeof candidate === 'string' && candidate.trim())

      if (typeof directCandidate === 'string' && directCandidate.trim()) {
        return directCandidate.trim()
      }
    }
  } catch {}

  return text
}

type AIPasteHandler = (rawText: unknown, apiKeyField: unknown, helpers?: PasteHandlerHelpers) => string

export const aiProviderPasteHandlerRegistry: Record<string, AIPasteHandler> = {
  'builtin-kimi-local-storage-json-v1': builtinKimiLocalStorageJsonV1,
}

export function runAIProviderPasteHandlerById(handlerId: unknown, rawText: unknown, apiKeyField: unknown, helpers: PasteHandlerHelpers = {}): string {
  const normalizedText = typeof rawText === 'string' ? rawText : ''
  const normalizedHandlerId = typeof handlerId === 'string' ? handlerId.trim() : ''
  const handler = normalizedHandlerId ? aiProviderPasteHandlerRegistry[normalizedHandlerId] : null

  if (typeof handler !== 'function') {
    return normalizedText
  }

  try {
    const nextValue = handler(normalizedText, apiKeyField, helpers)
    return typeof nextValue === 'string' ? nextValue : ''
  } catch {
    return normalizedText
  }
}
