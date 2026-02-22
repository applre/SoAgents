import type { Provider, AppConfig, ModelEntity } from './types/config';

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
    models: [
      { model: 'MiniMax-M2.5', modelName: 'MiniMax M2.5', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.5-lightning', modelName: 'MiniMax M2.5 Lightning', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.1', modelName: 'MiniMax M2.1', modelSeries: 'minimax' },
      { model: 'MiniMax-M2.1-lightning', modelName: 'MiniMax M2.1 Lightning', modelSeries: 'minimax' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    vendor: 'OpenRouter',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'openai/gpt-5.2-codex',
    isBuiltin: true,
    authType: 'auth_token_clear_api_key',
    websiteUrl: 'https://openrouter.ai/',
    config: {
      baseUrl: 'https://openrouter.ai/api',
    },
    models: [
      { model: 'openai/gpt-5.2-codex', modelName: 'GPT-5.2 Codex', modelSeries: 'openai' },
      { model: 'openai/gpt-5.2-pro', modelName: 'GPT-5.2 Pro', modelSeries: 'openai' },
      { model: 'google/gemini-3-pro-preview', modelName: 'Gemini 3 Pro', modelSeries: 'google' },
      { model: 'google/gemini-3-flash-preview', modelName: 'Gemini 3 Flash', modelSeries: 'google' },
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

export const DEFAULT_CONFIG: AppConfig = {
  currentProviderId: 'anthropic-sub',
  apiKeys: {},
  customProviders: [],
};
