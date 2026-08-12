// 桥接模块（自 .js 收编后类型化）：AI 供应商状态与浏览器嵌入凭据解析
import { t } from '../../i18n.ts'
import { runAIProviderPasteHandlerById } from './aiProviderPasteHandlers.ts'

/** 规范化后的 AI 供应商（normalizeProvider 输出，严格形状；type 而非 interface 以兼容 AIProviderLike 的索引签名） */
export type AIProvider = {
  id: string
  name: string
  provider: string
  model: string
  baseUrl: string
  apiKey: string
  cacheStrategy: string
  webSearchEnabled: boolean
  dedicatedWebSearchEnabled: boolean
  dedicatedWebSearchProviderId: string
  dedicatedProxyEnabled: boolean
  dedicatedProxyId: string
  reasoningEffort: string
  enableReasoningEffort: boolean
  openAiLegacyReasoningFormatEnabled: boolean
  modelMaxTokens: number
  modelMaxThinkingTokens: number
  pinned: boolean
  builtin: boolean
  builtinLoginURL: string
  apiKeyField: Record<string, unknown> | null
  updatedAt: number
}

/** 规范化后的 AI 供应商状态 */
export interface AIProviderState {
  currentProviderId: string
  providers: AIProvider[]
}

const EMPTY_STATE: AIProviderState = { currentProviderId: '', providers: [] }
const VALID_PROTOCOLS = new Set<string>(['Compatible', 'Responses', 'Messages'])
const VALID_CACHE_STRATEGIES = new Set<string>(['off', 'model', '5m', '1h', '30m', 'in_memory', '24h'])
const VALID_REASONING_EFFORTS = new Set<string>(['disable', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'])

/** wails 桥接形状（三个模块的并集，运行时按存在性守卫） */
interface AIProviderBridgeShape {
  GetAIProviderState?: () => Promise<unknown>
  SaveAIProviderState?: (payload: string) => Promise<unknown>
  GetAIProviderTokenGroup?: (payload: string) => Promise<unknown>
}

function getAppBridge(): AIProviderBridgeShape | null {
  return (window?.go?.wailsapp?.AIBindings || window?.go?.wailsapp?.AIProviderBindings || window?.go?.wailsapp?.App) as AIProviderBridgeShape | null
}

function normalizeProtocol(value: unknown): string {
  const nextValue = typeof value === 'string' ? value.trim() : ''
  return VALID_PROTOCOLS.has(nextValue) ? nextValue : 'Compatible'
}

function normalizeCacheStrategy(value: unknown): string {
  const nextValue = typeof value === 'string' ? value.trim() : ''
  return VALID_CACHE_STRATEGIES.has(nextValue) ? nextValue : 'model'
}

function normalizeReasoningEffort(value: unknown): string {
  const nextValue = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_REASONING_EFFORTS.has(nextValue) ? nextValue : 'disable'
}

function normalizePositiveInteger(value: unknown): number {
  const nextValue = Number(value)
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return 0
  }
  return Math.floor(nextValue)
}

function normalizeModel(value: unknown): string {
  const nextValue = typeof value === 'string' ? value.trim() : ''
  return nextValue === t('未选择模型') ? '' : nextValue
}

export function isBuiltinAIProvider(provider: unknown): boolean {
  return (provider as { builtin?: unknown } | null | undefined)?.builtin === true
}

function cloneApiKeyField(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch {
    return null
  }
}

function readEmbeddedBrowserPathValue(source: unknown, path: unknown): unknown {
  if (!source || typeof source !== 'object' || typeof path !== 'string' || !path.trim()) {
    return undefined
  }
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((current: unknown, segment) => {
      if (current === undefined || current === null) {
        return undefined
      }
      if (typeof current === 'string') {
        try {
          current = JSON.parse(current)
        } catch {
          return undefined
        }
      }
      if (typeof current !== 'object') {
        return undefined
      }
      return (current as Record<string, unknown>)[segment]
    }, source)
}

interface BrowserStorageItem {
  key?: unknown
  name?: unknown
  domain?: unknown
  origin?: unknown
  value?: unknown
}

interface BrowserStoragePathConfig {
  domain?: unknown
  name?: unknown
  key?: unknown
  origin?: unknown
}

function resolveEmbeddedBrowserStorageValue(bucket: unknown, pathConfig: unknown, sourceType: unknown): unknown {
  if (!bucket || !pathConfig || typeof pathConfig !== 'object') {
    return undefined
  }
  const path = pathConfig as BrowserStoragePathConfig
  if (sourceType === 'cookie' && Array.isArray(bucket)) {
    const expectedDomain = typeof path.domain === 'string' ? path.domain.trim() : ''
    const expectedName = typeof path.name === 'string' ? path.name.trim() : ''
    const matchedItem = bucket.find((item) => {
      const storageItem = item as BrowserStorageItem | null | undefined
      const itemDomain = typeof storageItem?.domain === 'string' ? storageItem.domain.trim() : ''
      const itemName = typeof storageItem?.name === 'string' ? storageItem.name.trim() : (typeof storageItem?.key === 'string' ? storageItem.key.trim() : '')
      return (!expectedDomain || itemDomain === expectedDomain) && expectedName && itemName === expectedName
    })
    return (matchedItem as BrowserStorageItem | undefined)?.value
  }
  const expectedKey = typeof path.key === 'string' ? path.key.trim() : ''
  if (Array.isArray(bucket)) {
    const exactItem = bucket.find((item) => {
      const storageItem = item as BrowserStorageItem | null | undefined
      const itemKey = typeof storageItem?.key === 'string' ? storageItem.key.trim() : (typeof storageItem?.name === 'string' ? storageItem.name.trim() : '')
      const itemOrigin = typeof storageItem?.origin === 'string' ? storageItem.origin.trim() : ''
      const expectedOrigin = typeof path.origin === 'string' ? path.origin.trim() : ''
      return itemKey === expectedKey && (!expectedOrigin || !itemOrigin || itemOrigin === expectedOrigin)
    })
    if ((exactItem as BrowserStorageItem | undefined)?.value !== undefined) {
      return (exactItem as BrowserStorageItem | undefined)?.value
    }
    if (expectedKey.includes('.')) {
      const [rootKey, ...restPath] = expectedKey.split('.')
      const nestedItem = bucket.find((item) => {
        const storageItem = item as BrowserStorageItem | null | undefined
        const itemKey = typeof storageItem?.key === 'string' ? storageItem.key.trim() : (typeof storageItem?.name === 'string' ? storageItem.name.trim() : '')
        return itemKey === rootKey
      })
      if ((nestedItem as BrowserStorageItem | undefined)?.value !== undefined) {
        return readEmbeddedBrowserPathValue((nestedItem as BrowserStorageItem | undefined)?.value, restPath.join('.'))
      }
    }
    return undefined
  }
  if (expectedKey && Object.prototype.hasOwnProperty.call(bucket, expectedKey)) {
    return (bucket as Record<string, unknown>)[expectedKey]
  }
  return readEmbeddedBrowserPathValue(bucket, expectedKey)
}

export function resolveEmbeddedBrowserAPIKey(payload: unknown, apiKeyField: unknown): string {
  const payloadRecord = (payload ?? {}) as Record<string, unknown>
  const directCandidates = [
    payloadRecord.apiKey,
    payloadRecord.token,
    payloadRecord.value,
    payloadRecord.accessToken,
  ]
  const directApiKey = directCandidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim() !== '')
  if (directApiKey) {
    return directApiKey.trim()
  }
  if (!apiKeyField || typeof apiKeyField !== 'object') {
    return ''
  }
  const apiKeyFieldRecord = apiKeyField as Record<string, unknown>
  const sourceType = typeof apiKeyFieldRecord.source === 'string' ? apiKeyFieldRecord.source.trim().toLowerCase() : ''
  const pathConfig = apiKeyFieldRecord.path && typeof apiKeyFieldRecord.path === 'object' ? apiKeyFieldRecord.path : null
  const storage = payloadRecord.storage as Record<string, unknown> | null | undefined
  let bucket: unknown = null
  if (sourceType === 'cookie') {
    bucket = payloadRecord.cookies ?? payloadRecord.cookie ?? payloadRecord.cookieJar ?? null
  } else if (sourceType === 'local_storage') {
    bucket = payloadRecord.localStorage ?? payloadRecord.local_storage ?? storage?.localStorage ?? storage?.local_storage ?? null
  } else if (sourceType === 'session_storage') {
    bucket = payloadRecord.sessionStorage ?? payloadRecord.session_storage ?? storage?.sessionStorage ?? storage?.session_storage ?? null
  }
  const resolvedValue = resolveEmbeddedBrowserStorageValue(bucket, pathConfig, sourceType)
  return typeof resolvedValue === 'string' ? resolvedValue.trim() : ''
}

export function runAIProviderAPIKeyPasteHandler(rawText: unknown, apiKeyField: unknown): string {
  const normalizedText = typeof rawText === 'string' ? rawText : ''
  const apiKeyFieldRecord = apiKeyField as { paste?: { handlerId?: unknown } } | null | undefined
  const handlerId = typeof apiKeyFieldRecord?.paste?.handlerId === 'string' ? apiKeyFieldRecord.paste.handlerId.trim() : ''
  return runAIProviderPasteHandlerById(
    handlerId,
    normalizedText,
    cloneApiKeyField(apiKeyField),
    { resolveEmbeddedBrowserAPIKey },
  )
}

function normalizeProvider(provider: unknown, index: number): AIProvider {
  const p = (provider ?? {}) as Record<string, unknown>
  const now = Date.now()
  return {
    id: typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `ai-provider-${index}-${now}`,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : t('未命名供应商'),
    provider: normalizeProtocol(p.provider),
    model: normalizeModel(p.model),
    baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl.trim() : '',
    apiKey: typeof p.apiKey === 'string' ? p.apiKey.trim() : '',
    cacheStrategy: normalizeCacheStrategy(p.cacheStrategy),
    webSearchEnabled: p.webSearchEnabled !== false,
    dedicatedWebSearchEnabled: Boolean(p.dedicatedWebSearchEnabled),
    dedicatedWebSearchProviderId: typeof p.dedicatedWebSearchProviderId === 'string' ? p.dedicatedWebSearchProviderId.trim() : '',
    dedicatedProxyEnabled: Boolean(p.dedicatedProxyEnabled),
    dedicatedProxyId: typeof p.dedicatedProxyId === 'string' ? p.dedicatedProxyId.trim() : '',
    reasoningEffort: normalizeReasoningEffort(p.reasoningEffort),
    enableReasoningEffort: Boolean(p.enableReasoningEffort)
      || normalizeReasoningEffort(p.reasoningEffort) !== 'disable'
      || normalizePositiveInteger(p.modelMaxTokens) > 0
      || normalizePositiveInteger(p.modelMaxThinkingTokens) > 0,
    openAiLegacyReasoningFormatEnabled: p.openAiLegacyReasoningFormatEnabled === true,
    modelMaxTokens: normalizePositiveInteger(p.modelMaxTokens),
    modelMaxThinkingTokens: normalizePositiveInteger(p.modelMaxThinkingTokens),
    pinned: Boolean(p.pinned),
    builtin: p.builtin === true,
    builtinLoginURL: typeof p.builtinLoginUrl === 'string'
      ? p.builtinLoginUrl.trim()
      : (typeof p.builtinLoginURL === 'string' ? p.builtinLoginURL.trim() : ''),
    apiKeyField: cloneApiKeyField(p.apiKeyField),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
  }
}

export function normalizeAIProviderState(state: unknown): AIProviderState {
  const stateRecord = (state ?? {}) as { providers?: unknown; currentProviderId?: unknown }
  const providers = Array.isArray(stateRecord.providers) ? stateRecord.providers.map((provider, index) => normalizeProvider(provider, index)) : []
  const idSet = new Set(providers.map((provider) => provider.id))

  const normalizedProviders = providers.map((provider) => {
    let webSearchEnabled = provider.webSearchEnabled
    let dedicatedWebSearchEnabled = provider.dedicatedWebSearchEnabled
    let dedicatedWebSearchProviderId = provider.dedicatedWebSearchProviderId

    if (webSearchEnabled) {
      dedicatedWebSearchEnabled = false
    }

    if (dedicatedWebSearchProviderId === provider.id) {
      dedicatedWebSearchProviderId = ''
    }

    if (dedicatedWebSearchEnabled) {
      if (!dedicatedWebSearchProviderId || !idSet.has(dedicatedWebSearchProviderId)) {
        const fallbackProvider = providers.find((item) => item.id !== provider.id)
        dedicatedWebSearchProviderId = fallbackProvider?.id || ''
        dedicatedWebSearchEnabled = Boolean(dedicatedWebSearchProviderId)
      }
    } else if (dedicatedWebSearchProviderId && !idSet.has(dedicatedWebSearchProviderId)) {
      dedicatedWebSearchProviderId = ''
    }

    return {
      ...provider,
      webSearchEnabled,
      dedicatedWebSearchEnabled,
      dedicatedWebSearchProviderId,
    }
  })

  const currentProviderId = typeof stateRecord.currentProviderId === 'string' && idSet.has(stateRecord.currentProviderId)
    ? stateRecord.currentProviderId
    : ''

  return {
    currentProviderId,
    providers: normalizedProviders,
  }
}

export async function getAIProviderState(): Promise<AIProviderState> {
  const bridge = getAppBridge()
  if (!bridge?.GetAIProviderState) {
    return EMPTY_STATE
  }
  try {
    const state = await bridge.GetAIProviderState()
    return normalizeAIProviderState(state)
  } catch {
    return EMPTY_STATE
  }
}

export async function getAIProviderTokenGroup(provider: unknown): Promise<unknown> {
  const bridge = getAppBridge()
  if (!bridge?.GetAIProviderTokenGroup) {
    throw new Error(t('Token 分组查询能力未就绪'))
  }
  const normalizedProvider = normalizeProvider(provider || {}, 0)
  return bridge.GetAIProviderTokenGroup(JSON.stringify(normalizedProvider))
}

export async function saveAIProviderState(state: unknown): Promise<AIProviderState> {
  const normalizedState = normalizeAIProviderState(state)
  const bridge = getAppBridge()
  if (!bridge?.SaveAIProviderState) {
    return normalizedState
  }
  await bridge.SaveAIProviderState(JSON.stringify(normalizedState))
  return normalizedState
}
