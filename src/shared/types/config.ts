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

export interface AppConfig {
  currentProviderId: string;
  apiKeys: Record<string, string>;
  customProviders?: Provider[];
}

export interface ProviderEnv {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}
