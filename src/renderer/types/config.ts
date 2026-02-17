export interface Provider {
  id: string;
  name: string;
  type: 'subscription' | 'api';
  baseUrl?: string;
  primaryModel?: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'anthropic', name: 'Anthropic（订阅）', type: 'subscription' },
  { id: 'deepseek', name: 'DeepSeek', type: 'api', baseUrl: 'https://api.deepseek.com/anthropic', primaryModel: 'deepseek-chat' },
  { id: 'moonshot', name: 'Moonshot（月之暗面）', type: 'api', baseUrl: 'https://api.moonshot.cn/anthropic', primaryModel: 'moonshot-v1-8k' },
  { id: 'zhipu', name: '智谱 AI（GLM）', type: 'api', baseUrl: 'https://open.bigmodel.cn/api/anthropic', primaryModel: 'glm-4' },
  { id: 'minimax', name: 'MiniMax', type: 'api', baseUrl: 'https://api.minimaxi.com/anthropic', primaryModel: 'minimax-text-01' },
];

export interface AppConfig {
  currentProviderId: string;
  apiKeys: Record<string, string>;
}

export const DEFAULT_CONFIG: AppConfig = {
  currentProviderId: 'anthropic',
  apiKeys: {},
};
