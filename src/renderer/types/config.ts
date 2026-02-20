export interface Provider {
  id: string;
  name: string;
  type: 'subscription' | 'api';
  baseUrl?: string;
  primaryModel?: string;
  models?: string;       // 展示用：列举主要模型
  official?: boolean;   // 显示"官方"徽章
  isBuiltin?: boolean;  // 是否为预设供应商
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (订阅)',
    type: 'subscription',
    official: true,
    isBuiltin: true,
    models: 'Claude Sonnet 4.5, Claude Opus 4...',
  },
  {
    id: 'anthropic-api',
    name: 'Anthropic (API)',
    type: 'api',
    official: true,
    isBuiltin: true,
    primaryModel: 'claude-sonnet-4-5-20250929',
    models: 'Claude Sonnet 4.5, Claude Opus 4...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://api.deepseek.com/anthropic',
    primaryModel: 'deepseek-chat',
    models: 'DeepSeek Chat, DeepSeek Reasoner',
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://api.moonshot.cn/anthropic',
    primaryModel: 'kimi-k2-5',
    models: 'Kimi K2.5, Kimi K2 Thinking, Kimi...',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    primaryModel: 'glm-4-plus',
    models: 'GLM 4.7, GLM 5, GLM 4.5 Air',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://api.minimaxi.com/anthropic',
    primaryModel: 'MiniMax-Text-01',
    models: 'MiniMax M2.5, MiniMax M2.5 Light...',
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/anthropic',
    primaryModel: 'doubao-seed-code',
    models: 'Ark Code Latest, Doubao Seed Code',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://api.siliconflow.cn/anthropic',
    primaryModel: 'deepseek-ai/DeepSeek-V3',
    models: 'Kimi K2.5, GLM 4.7, DeepSeek V3...',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'api',
    isBuiltin: true,
    baseUrl: 'https://openrouter.ai/api/v1/anthropic',
    primaryModel: 'openai/gpt-4o',
    models: 'GPT-4o, Claude, Gemini, Llama...',
  },
];

export interface AppConfig {
  currentProviderId: string;
  apiKeys: Record<string, string>;
  customProviders?: Provider[];
}

export const DEFAULT_CONFIG: AppConfig = {
  currentProviderId: 'anthropic',
  apiKeys: {},
  customProviders: [],
};
