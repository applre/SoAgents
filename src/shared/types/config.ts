/**
 * Authentication type for API providers
 * - 'auth_token': Only set ANTHROPIC_AUTH_TOKEN
 * - 'api_key': Only set ANTHROPIC_API_KEY
 * - 'both': Set both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY (default for backward compatibility)
 * - 'auth_token_clear_api_key': Set AUTH_TOKEN and explicitly clear API_KEY (required by OpenRouter)
 */
export type ProviderAuthType = 'auth_token' | 'api_key' | 'both' | 'auth_token_clear_api_key';

/**
 * API protocol for providers
 * - 'anthropic': Anthropic Messages API (default)
 * - 'openai': OpenAI Chat Completions API (via bridge)
 */
export type ApiProtocol = 'anthropic' | 'openai';

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

  // API 协议 (默认 'anthropic')
  apiProtocol?: ApiProtocol;

  // 上游 API 格式（仅 apiProtocol === 'openai' 时生效）
  // 'chat_completions' (默认): OpenAI Chat Completions API
  // 'responses': OpenAI Responses API
  upstreamFormat?: 'chat_completions' | 'responses';

  // 最大输出 token 数限制（仅 apiProtocol === 'openai' 时生效）
  // Bridge 会将 SDK 发送的 max_tokens 截断到此值
  maxOutputTokens?: number;

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

// ── Provider Verify Status ──

export interface ProviderVerifyStatus {
  status: 'valid' | 'invalid';
  verifiedAt: string; // ISO timestamp
  accountEmail?: string; // 订阅 Provider: 检测账户切换
}

export const VERIFY_EXPIRY_DAYS = 30;

export function isVerifyExpired(verifiedAt: string): boolean {
  const verifiedDate = new Date(verifiedAt);
  if (isNaN(verifiedDate.getTime())) return true;
  const daysDiff = (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > VERIFY_EXPIRY_DAYS;
}

// ── App Config ──

export interface AppConfig {
  currentProviderId: string;
  currentModelId?: string;
  apiKeys: Record<string, string>;
  customProviders?: Provider[];
  /** 用户给预设 Provider 追加的自定义模型 */
  presetCustomModels?: Record<string, ModelEntity[]>;
  /** Provider 验证状态缓存 (key = provider ID) */
  providerVerifyStatus?: Record<string, ProviderVerifyStatus>;
  minimizeToTray?: boolean;
  defaultWorkspacePath?: string;
  proxySettings?: ProxySettings;
  showDevTools?: boolean;
}

export interface ProviderEnv {
  baseUrl?: string;
  apiKey?: string;
  authType?: ProviderAuthType;
  apiProtocol?: ApiProtocol;
  timeout?: number;
  disableNonessential?: boolean;
  maxOutputTokens?: number;
  upstreamFormat?: 'chat_completions' | 'responses';
}
