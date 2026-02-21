/**
 * Authentication type for API providers
 * - 'auth_token': Only set ANTHROPIC_AUTH_TOKEN
 * - 'api_key': Only set ANTHROPIC_API_KEY
 * - 'both': Set both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY (default for backward compatibility)
 * - 'auth_token_clear_api_key': Set AUTH_TOKEN and explicitly clear API_KEY (required by OpenRouter)
 */
export type ProviderAuthType = 'auth_token' | 'api_key' | 'both' | 'auth_token_clear_api_key';

export interface ModelEntity {
  model: string;         // SDK model ID, e.g. "claude-sonnet-4-6"
  modelName: string;     // 显示名, e.g. "Claude Sonnet 4.6"
  modelSeries: string;   // 品牌系列, e.g. "claude" | "deepseek" | "zhipu"
}

export interface Provider {
  id: string;
  name: string;
  vendor: string;           // 厂商名: 'Anthropic', 'DeepSeek', etc.
  cloudProvider: string;    // 云服务商: '官方', '模型官方', '云服务商'
  type: 'subscription' | 'api';
  primaryModel: string;     // 默认模型 API 代码
  isBuiltin: boolean;

  // API 配置
  config: {
    baseUrl?: string;            // ANTHROPIC_BASE_URL
    timeout?: number;            // API_TIMEOUT_MS
    disableNonessential?: boolean; // CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
  };

  // 认证方式 (默认 'both' 以保持向后兼容)
  authType?: ProviderAuthType;

  // 官网链接 (用于"去官网"入口)
  websiteUrl?: string;

  // 模型列表
  models: ModelEntity[];
}

export interface AppConfig {
  currentProviderId: string;
  currentModelId?: string;
  apiKeys: Record<string, string>;
  customProviders?: Provider[];
}

export interface ProviderEnv {
  baseUrl?: string;
  apiKey?: string;
  authType?: ProviderAuthType;
  timeout?: number;
  disableNonessential?: boolean;
}
