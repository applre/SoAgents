import type { Provider, AppConfig, ModelEntity, ModelAliases } from './types/config';

/** Anthropic 官方预设模型（订阅和 API 共用） */
const ANTHROPIC_MODELS: ModelEntity[] = [
  { model: 'claude-sonnet-4-6', modelName: 'Claude Sonnet 4.6', modelSeries: 'claude' },
  { model: 'claude-opus-4-6', modelName: 'Claude Opus 4.6', modelSeries: 'claude' },
  { model: 'claude-haiku-4-5', modelName: 'Claude Haiku 4.5', modelSeries: 'claude' },
];

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic-sub',
    name: 'Anthropic (订阅)',
    vendor: 'Anthropic',
    cloudProvider: '官方',
    type: 'subscription',
    primaryModel: 'claude-sonnet-4-6',
    isBuiltin: true,
    config: {},
    models: ANTHROPIC_MODELS,
  },
  {
    id: 'anthropic-api',
    name: 'Anthropic (API)',
    vendor: 'Anthropic',
    cloudProvider: '官方',
    type: 'api',
    primaryModel: 'claude-sonnet-4-6',
    isBuiltin: true,
    authType: 'both',
    config: {
      baseUrl: 'https://api.anthropic.com',
    },
    models: ANTHROPIC_MODELS,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    cloudProvider: '模型官方',
    type: 'api',
    primaryModel: 'deepseek-chat',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://platform.deepseek.com',
    config: {
      baseUrl: 'https://api.deepseek.com/anthropic',
      timeout: 600000,
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'deepseek-chat', opus: 'deepseek-reasoner', haiku: 'deepseek-chat' },
    models: [
      { model: 'deepseek-chat', modelName: 'DeepSeek Chat', modelSeries: 'deepseek' },
      { model: 'deepseek-reasoner', modelName: 'DeepSeek Reasoner', modelSeries: 'deepseek' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    vendor: 'Moonshot',
    cloudProvider: '模型官方',
    type: 'api',
    primaryModel: 'kimi-k2.5',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://platform.moonshot.cn/console',
    config: {
      baseUrl: 'https://api.moonshot.cn/anthropic',
    },
    modelAliases: { sonnet: 'kimi-k2.5', opus: 'kimi-k2.5', haiku: 'kimi-k2-thinking-turbo' },
    models: [
      { model: 'kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'moonshot' },
      { model: 'kimi-k2-thinking-turbo', modelName: 'Kimi K2 Thinking', modelSeries: 'moonshot' },
      { model: 'kimi-k2-0711', modelName: 'Kimi K2', modelSeries: 'moonshot' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    vendor: 'Zhipu',
    cloudProvider: '模型官方',
    type: 'api',
    primaryModel: 'glm-4.7',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://bigmodel.cn/console/overview',
    config: {
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      timeout: 600000,
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'glm-4.7', opus: 'glm-5', haiku: 'glm-4.5-air' },
    models: [
      { model: 'glm-4.7', modelName: 'GLM 4.7', modelSeries: 'zhipu' },
      { model: 'glm-5', modelName: 'GLM 5', modelSeries: 'zhipu' },
      { model: 'glm-4.5-air', modelName: 'GLM 4.5 Air', modelSeries: 'zhipu' },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    vendor: 'MiniMax',
    cloudProvider: '模型官方',
    type: 'api',
    primaryModel: 'MiniMax-M2.5',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://platform.minimaxi.com/docs/guides/models-intro',
    config: {
      baseUrl: 'https://api.minimaxi.com/anthropic',
    },
    modelAliases: { sonnet: 'MiniMax-M2.5', opus: 'MiniMax-M2.5', haiku: 'MiniMax-M2.5-lightning' },
    models: [
      { model: 'MiniMax-M2.5', modelName: 'MiniMax M2.5', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.5-lightning', modelName: 'MiniMax M2.5 Lightning', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.1', modelName: 'MiniMax M2.1', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.1-lightning', modelName: 'MiniMax M2.1 Lightning', modelSeries: 'minimax' },
    ],
  },
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    vendor: 'Google',
    cloudProvider: '模型官方',
    type: 'api',
    primaryModel: 'gemini-2.5-flash',
    isBuiltin: true,
    authType: 'api_key',
    apiProtocol: 'openai',
    maxOutputTokens: 8192,
    websiteUrl: 'https://aistudio.google.com/apikey',
    config: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    },
    modelAliases: { sonnet: 'gemini-3.1-pro-preview', opus: 'gemini-3.1-pro-preview', haiku: 'gemini-3-flash-preview' },
    models: [
      { model: 'gemini-2.5-pro', modelName: 'Gemini 2.5 Pro', modelSeries: 'google' },
      { model: 'gemini-2.5-flash', modelName: 'Gemini 2.5 Flash', modelSeries: 'google' },
      { model: 'gemini-2.5-flash-lite', modelName: 'Gemini 2.5 Flash-Lite', modelSeries: 'google' },
      { model: 'gemini-3.1-pro-preview', modelName: 'Gemini 3.1 Pro Preview', modelSeries: 'google' },
      { model: 'gemini-3-flash-preview', modelName: 'Gemini 3 Flash Preview', modelSeries: 'google' },
    ],
  },
  {
    id: 'volcengine',
    name: '火山方舟 Coding Plan',
    vendor: '字节跳动',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'doubao-seed-2.0-code',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://console.volcengine.com/',
    config: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'doubao-seed-2.0-code', opus: 'doubao-seed-2.0-code', haiku: 'doubao-seed-2.0-code' },
    models: [
      { model: 'doubao-seed-2.0-code', modelName: 'Doubao Seed 2.0 Code', modelSeries: 'volcengine' },
      { model: 'glm-4.7', modelName: 'GLM 4.7', modelSeries: 'volcengine' },
      { model: 'deepseek-v3.2', modelName: 'DeepSeek V3.2', modelSeries: 'volcengine' },
      { model: 'kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'volcengine' },
    ],
  },
  {
    id: 'volcengine-api',
    name: '火山方舟 API调用',
    vendor: '字节跳动',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'doubao-seed-2-0-pro-260215',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://console.volcengine.com/',
    config: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/compatible',
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'doubao-seed-2-0-pro-260215', opus: 'doubao-seed-2-0-pro-260215', haiku: 'doubao-seed-2-0-lite-260215' },
    models: [
      { model: 'doubao-seed-2-0-pro-260215', modelName: 'Doubao Seed 2.0 Pro', modelSeries: 'volcengine' },
      { model: 'doubao-seed-2-0-code-preview-260215', modelName: 'Doubao Seed 2.0 Code Preview', modelSeries: 'volcengine' },
      { model: 'doubao-seed-2-0-lite-260215', modelName: 'Doubao Seed 2.0 Lite', modelSeries: 'volcengine' },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动SiliconFlow',
    vendor: 'SiliconFlow',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'Pro/deepseek-ai/DeepSeek-V3.2',
    isBuiltin: true,
    authType: 'api_key',
    websiteUrl: 'https://cloud.siliconflow.cn/me/models',
    config: {
      baseUrl: 'https://api.siliconflow.cn/',
    },
    modelAliases: { sonnet: 'Pro/deepseek-ai/DeepSeek-V3.2', opus: 'Pro/moonshotai/Kimi-K2.5', haiku: 'stepfun-ai/Step-3.5-Flash' },
    models: [
      { model: 'Pro/moonshotai/Kimi-K2.5', modelName: 'Kimi K2.5', modelSeries: 'siliconflow' },
      { model: 'Pro/zai-org/GLM-4.7', modelName: 'GLM 4.7', modelSeries: 'siliconflow' },
      { model: 'Pro/deepseek-ai/DeepSeek-V3.2', modelName: 'DeepSeek V3.2', modelSeries: 'siliconflow' },
      { model: 'Pro/MiniMaxAI/MiniMax-M2.1', modelName: 'MiniMax M2.1', modelSeries: 'siliconflow' },
      { model: 'stepfun-ai/Step-3.5-Flash', modelName: 'Step 3.5 Flash', modelSeries: 'siliconflow' },
    ],
  },
  {
    id: 'zenmux',
    name: 'ZenMux',
    vendor: 'ZenMux',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'anthropic/claude-sonnet-4.6',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://zenmux.ai',
    config: {
      baseUrl: 'https://zenmux.ai/api/anthropic',
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'anthropic/claude-sonnet-4.6', opus: 'anthropic/claude-opus-4.6', haiku: 'volcengine/doubao-seed-2.0-lite' },
    models: [
      { model: 'google/gemini-3.1-pro-preview', modelName: 'Gemini 3.1 Pro', modelSeries: 'google' },
      { model: 'anthropic/claude-sonnet-4.6', modelName: 'Claude Sonnet 4.6', modelSeries: 'claude' },
      { model: 'anthropic/claude-opus-4.6', modelName: 'Claude Opus 4.6', modelSeries: 'claude' },
      { model: 'volcengine/doubao-seed-2.0-pro', modelName: 'Doubao Seed 2.0 Pro', modelSeries: 'volcengine' },
      { model: 'volcengine/doubao-seed-2.0-lite', modelName: 'Doubao Seed 2.0 Lite', modelSeries: 'volcengine' },
      { model: 'minimax/minimax-m2.5', modelName: 'MiniMax M2.5', modelSeries: 'minimax' },
      { model: 'moonshotai/kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'moonshot' },
      { model: 'z-ai/glm-5', modelName: 'GLM 5', modelSeries: 'zhipu' },
    ],
  },
  {
    id: 'aliyun-bailian-coding',
    name: '阿里云百炼 Coding Plan',
    vendor: '阿里云',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'qwen3.5-plus',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://bailian.console.aliyun.com/',
    config: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    },
    modelAliases: { sonnet: 'qwen3.5-plus', opus: 'qwen3.5-plus', haiku: 'qwen3.5-plus' },
    models: [
      { model: 'qwen3.5-plus', modelName: 'Qwen 3.5 Plus', modelSeries: 'aliyun' },
      { model: 'kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'aliyun' },
      { model: 'glm-5', modelName: 'GLM 5', modelSeries: 'aliyun' },
      { model: 'MiniMax-M2.5', modelName: 'MiniMax M2.5', modelSeries: 'aliyun' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    vendor: 'OpenRouter',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'google/gemini-3.1-pro-preview',
    isBuiltin: true,
    authType: 'auth_token_clear_api_key',
    websiteUrl: 'https://openrouter.ai/',
    config: {
      baseUrl: 'https://openrouter.ai/api',
    },
    modelAliases: { sonnet: 'google/gemini-3.1-pro-preview', opus: 'google/gemini-3.1-pro-preview', haiku: 'google/gemini-3-flash-preview' },
    models: [
      { model: 'google/gemini-3.1-flash-lite-preview', modelName: 'Gemini 3.1 Flash Lite', modelSeries: 'google' },
      { model: 'google/gemini-3-flash-preview', modelName: 'Gemini 3 Flash', modelSeries: 'google' },
      { model: 'google/gemini-3.1-pro-preview', modelName: 'Gemini 3.1 Pro', modelSeries: 'google' },
      { model: 'anthropic/claude-sonnet-4.6', modelName: 'Claude Sonnet 4.6', modelSeries: 'claude' },
      { model: 'anthropic/claude-opus-4.6', modelName: 'Claude Opus 4.6', modelSeries: 'claude' },
      { model: 'anthropic/claude-haiku-4.5', modelName: 'Claude Haiku 4.5', modelSeries: 'claude' },
      { model: 'openai/gpt-5.4', modelName: 'GPT-5.4', modelSeries: 'openai' },
      { model: 'openai/gpt-5.4-pro', modelName: 'GPT-5.4 Pro', modelSeries: 'openai' },
      { model: 'openai/gpt-5.3-codex', modelName: 'GPT-5.3 Codex', modelSeries: 'openai' },
      { model: 'openai/gpt-5.3-chat', modelName: 'GPT-5.3 Chat', modelSeries: 'openai' },
    ],
  },
];

/** 获取 Provider 的模型展示文本 */
export function getModelsDisplay(provider: Provider, maxLength = 35): string {
  const models = provider.models.map(m => m.modelName);
  const display = models.join(', ');
  return display.length > maxLength ? display.slice(0, maxLength - 3) + '...' : display;
}

/** 获取模型展示名称 */
export function getModelDisplayName(provider: Provider, modelId: string): string {
  const model = provider.models.find(m => m.model === modelId);
  return model?.modelName ?? modelId;
}

/**
 * Get effective model aliases for a provider (preset defaults merged with user overrides).
 * Anthropic providers don't need aliases (SDK natively supports their models).
 */
export function getEffectiveModelAliases(
  provider: Provider,
  userOverrides?: Record<string, ModelAliases>,
): ModelAliases | undefined {
  if (provider.id === 'anthropic-sub' || provider.id === 'anthropic-api') return undefined;
  const defaults = provider.modelAliases ?? {};
  const overrides = userOverrides?.[provider.id];
  if (overrides) return { ...defaults, ...overrides };
  if (!defaults.sonnet && !defaults.opus && !defaults.haiku) return undefined;
  return defaults;
}

export const DEFAULT_CONFIG: AppConfig = {
  currentProviderId: 'anthropic-sub',
  apiKeys: {},
  customProviders: [],
};
