const VALID_REASONING_EFFORTS = new Set(['disable', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
const GPT_VERSION_PATTERN = /^gpt-(\d+)(?:\.(\d+))?/
const RESPONSES_24H_ONLY_PATTERN = /^gpt-5\.5(?:$|[-.])/
const RESPONSES_24H_CAPABLE_PATTERNS = [
  /^gpt-5\.4(?:$|[-.])/,
  /^gpt-5\.2(?:$|[-.])/,
  /^gpt-5\.1(?:$|[-.])/,
  /^gpt-5-codex(?:$|[-.])/,
  /^gpt-5(?:$|-20\d{2}-\d{2}-\d{2})/,
  /^gpt-4\.1(?:$|[-.])/,
]

const CONSERVATIVE_CAPABILITY = {
  known: false,
  supportsPromptCache: false,
  promptCacheRetention: 'in_memory',
  supportsReasoningBinary: false,
  supportsReasoningBudget: false,
  requiredReasoningBudget: false,
  supportsReasoningEffort: [],
  requiredReasoningEffort: false,
  reasoningEffort: 'disable',
  reasoningMode: 'none',
  maxTokens: 0,
  maxThinkingTokens: 0,
  supportsTemperature: true,
}

const capabilityRules = [
  {
    matchPrefix: 'gpt-5.4',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      supportsReasoningEffort: ['low', 'medium', 'high', 'xhigh'],
      reasoningEffort: 'xhigh',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'gpt-5.2',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      supportsReasoningEffort: ['none', 'low', 'medium', 'high', 'xhigh'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'gpt-5.1',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      supportsReasoningEffort: ['none', 'low', 'medium', 'high'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'gpt-5-chat',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      reasoningMode: 'none',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'gpt-5',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      reasoningMode: 'none',
      supportsTemperature: false,
    },
  },
  {
    matchContains: 'codex',
    capability: {
      known: true,
      supportsPromptCache: true,
      promptCacheRetention: '24h',
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'o4-mini-high',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'high',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'o4-mini-low',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'low',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'o4-mini',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'o3-mini-high',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'high',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'o3-mini-low',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'low',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'o3-mini',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchExact: 'o3-low',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'low',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'o3',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
  {
    matchPrefix: 'o1',
    capability: {
      known: true,
      supportsPromptCache: true,
      supportsReasoningEffort: ['low', 'medium', 'high'],
      reasoningEffort: 'high',
      reasoningMode: 'effort',
      supportsTemperature: false,
    },
  },
]

function normalizeReasoningEffortOptions(values) {
  if (!Array.isArray(values)) {
    return []
  }
  const seen = new Set()
  const normalized = []
  values.forEach((value) => {
    const nextValue = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (!VALID_REASONING_EFFORTS.has(nextValue) || seen.has(nextValue)) {
      return
    }
    seen.add(nextValue)
    normalized.push(nextValue)
  })
  return normalized
}

function buildCapability(modelId, patch = {}) {
  return {
    ...CONSERVATIVE_CAPABILITY,
    modelId: typeof modelId === 'string' ? modelId.trim() : '',
    ...patch,
    supportsReasoningEffort: normalizeReasoningEffortOptions(patch.supportsReasoningEffort),
    reasoningEffort: typeof patch.reasoningEffort === 'string' ? patch.reasoningEffort.trim().toLowerCase() : CONSERVATIVE_CAPABILITY.reasoningEffort,
  }
}

function matchesRule(rule, normalizedModelId) {
  if (rule.matchExact) {
    return normalizedModelId === rule.matchExact.toLowerCase()
  }
  if (rule.matchPrefix) {
    return normalizedModelId.startsWith(rule.matchPrefix.toLowerCase())
  }
  if (rule.matchContains) {
    return normalizedModelId.includes(rule.matchContains.toLowerCase())
  }
  return false
}

function getModelCapability(modelId) {
  const normalizedModelId = typeof modelId === 'string' ? modelId.trim().toLowerCase() : ''
  if (!normalizedModelId) {
    return buildCapability(modelId)
  }
  const matchedRule = capabilityRules.find((rule) => matchesRule(rule, normalizedModelId))
  return matchedRule ? buildCapability(modelId, matchedRule.capability) : buildCapability(modelId)
}

function normalizePromptCacheModelId(modelId) {
  return typeof modelId === 'string' ? modelId.trim().toLowerCase() : ''
}

function supportsResponsesPromptCacheTTL(modelId) {
  const normalizedModelId = normalizePromptCacheModelId(modelId)
  const match = normalizedModelId.match(GPT_VERSION_PATTERN)
  if (!match) {
    return false
  }
  const majorVersion = Number(match[1])
  const minorVersion = Number(match[2] || '0')
  if (!Number.isFinite(majorVersion) || !Number.isFinite(minorVersion)) {
    return false
  }
  return majorVersion > 5 || (majorVersion === 5 && minorVersion >= 6)
}

function supportsResponsesExtendedPromptCacheRetention(modelId, capability) {
  if (capability?.promptCacheRetention === '24h') {
    return true
  }
  const normalizedModelId = normalizePromptCacheModelId(modelId)
  return RESPONSES_24H_CAPABLE_PATTERNS.some((pattern) => pattern.test(normalizedModelId))
}

function buildPromptCacheOptions(values) {
  const labelKeyMap = {
    off: '强制关闭',
    model: '基于模型能力',
    '30m': '30分钟',
    in_memory: '内存缓存',
    '24h': '24小时',
  }
  return values.map((value) => ({
    value,
    labelKey: labelKeyMap[value] || value,
  }))
}

function getPromptCacheStrategyOptions(modelId) {
  const normalizedModelId = normalizePromptCacheModelId(modelId)
  const capability = getModelCapability(modelId)
  if (!normalizedModelId) {
    return buildPromptCacheOptions(['off', 'model'])
  }
  if (supportsResponsesPromptCacheTTL(normalizedModelId)) {
    return buildPromptCacheOptions(['off', 'model', '30m'])
  }
  if (RESPONSES_24H_ONLY_PATTERN.test(normalizedModelId)) {
    return buildPromptCacheOptions(['off', 'model', '24h'])
  }
  const supportsExtendedRetention = supportsResponsesExtendedPromptCacheRetention(normalizedModelId, capability)
  if (capability?.supportsPromptCache === false && !supportsExtendedRetention) {
    return buildPromptCacheOptions(['off', 'model'])
  }
  const values = ['off', 'model', 'in_memory']
  if (supportsExtendedRetention) {
    values.push('24h')
  }
  return buildPromptCacheOptions(values)
}

export const responsesProvider = {
  value: 'Responses',
  label: 'Responses',
  defaultModel: '',
  initialModels: [],
  supportsPromptCacheSettings: true,
  supportsWebSearch: true,
  supportsDedicatedWebSearchCandidate: true,
  getModelCapability,
  getPromptCacheStrategyOptions,
}