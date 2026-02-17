export interface AppConfig {
  currentProviderId: string;
  apiKeys: Record<string, string>;
}

export interface ProviderEnv {
  baseUrl?: string;
  apiKey?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  currentProviderId: 'anthropic',
  apiKeys: {},
};
