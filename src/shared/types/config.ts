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

// ── Proxy Settings ──

export type ProxyProtocol = 'http' | 'socks5';

export interface ProxySettings {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
}

export const PROXY_DEFAULTS: Omit<ProxySettings, 'enabled'> = {
  protocol: 'http' as ProxyProtocol,
  host: '127.0.0.1',
  port: 7897,
};

export function isValidProxyHost(host: string): boolean {
  if (!host) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((n) => {
      const num = Number(n);
      return num >= 0 && num <= 255;
    });
  }
  // hostname
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host);
}

// ── App Config ──

export interface AppConfig {
  currentProviderId: string;
  currentModelId?: string;
  apiKeys: Record<string, string>;
  customProviders?: Provider[];
  minimizeToTray?: boolean;
  defaultWorkspacePath?: string;
  proxySettings?: ProxySettings;
  showDevTools?: boolean;
}

export interface ProviderEnv {
  baseUrl?: string;
  apiKey?: string;
  authType?: ProviderAuthType;
  timeout?: number;
  disableNonessential?: boolean;
}
