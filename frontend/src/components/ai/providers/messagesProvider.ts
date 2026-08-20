// 桥接模块（自 .js 收编后类型化）：Messages 供应商模型能力表
/** 模型能力（保守默认 + 规则覆盖，modelId 由 buildCapability 注入；type 而非 interface 以兼容消费方索引签名） */
export type ModelCapability = {
  known: boolean
  supportsReasoningBinary: boolean
  supportsReasoningBudget: boolean
  requiredReasoningBudget: boolean
  supportsReasoningEffort: string[]
  requiredReasoningEffort: boolean
  reasoningEffort: string
  reasoningMode: string
  maxTokens: number
  maxThinkingTokens: number
  supportsTemperature: boolean
  modelId?: string
}

const CONSERVATIVE_CAPABILITY: ModelCapability = {
  known: false,
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

interface CapabilityRule {
  matchExact?: string
  matchPrefix?: string
  matchContains?: string
  capability: Partial<ModelCapability>
}

const capabilityRules: CapabilityRule[] = [
  {
    matchExact: 'claude-opus-4-8',
    capability: {
      known: true,
      supportsReasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
      requiredReasoningEffort: false,
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      maxTokens: 16384,
      maxThinkingTokens: 8192,
      supportsTemperature: true,
    },
  },
  {
    matchContains: 'claude-opus-4',
    capability: {
      known: true,
      supportsReasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
      requiredReasoningEffort: false,
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      maxTokens: 16384,
      maxThinkingTokens: 8192,
      supportsTemperature: true,
    },
  },
  {
    matchContains: 'claude-sonnet-4',
    capability: {
      known: true,
      supportsReasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
      requiredReasoningEffort: false,
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      maxTokens: 16384,
      maxThinkingTokens: 8192,
      supportsTemperature: true,
    },
  },
  {
    matchContains: 'claude-3.7-sonnet',
    capability: {
      known: true,
      supportsReasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
      requiredReasoningEffort: false,
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      maxTokens: 16384,
      maxThinkingTokens: 8192,
      supportsTemperature: true,
    },
  },
  {
    matchContains: 'claude',
    capability: {
      known: true,
      supportsReasoningEffort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
      requiredReasoningEffort: false,
      reasoningEffort: 'medium',
      reasoningMode: 'effort',
      maxTokens: 16384,
      maxThinkingTokens: 8192,
      supportsTemperature: true,
    },
  },
]

function buildCapability(modelId: unknown, patch: Partial<ModelCapability> = {}): ModelCapability {
  return {
    ...CONSERVATIVE_CAPABILITY,
    modelId: typeof modelId === 'string' ? modelId.trim() : '',
    ...patch,
  }
}

function matchesRule(rule: CapabilityRule, normalizedModelId: string): boolean {
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

function getModelCapability(modelId: unknown): ModelCapability {
  const normalizedModelId = typeof modelId === 'string' ? modelId.trim().toLowerCase() : ''
  if (!normalizedModelId) {
    return buildCapability(modelId)
  }
  const matchedRule = capabilityRules.find((rule) => matchesRule(rule, normalizedModelId))
  return matchedRule ? buildCapability(modelId, matchedRule.capability) : buildCapability(modelId)
}

export const messagesProvider = {
  value: 'Messages',
  label: 'Messages',
  defaultModel: '',
  initialModels: [],
  supportsPromptCacheSettings: true,
  supportsWebSearch: true,
  supportsDedicatedWebSearchCandidate: false,
  getModelCapability,
}
