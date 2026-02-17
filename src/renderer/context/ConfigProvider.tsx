import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, Provider } from '../types/config';
import { PROVIDERS, DEFAULT_CONFIG } from '../types/config';

const STORAGE_KEY = 'soagents:config';

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      currentProviderId: parsed.currentProviderId ?? DEFAULT_CONFIG.currentProviderId,
      apiKeys: parsed.apiKeys ?? {},
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(loadConfig);

  const currentProvider = useMemo<Provider>(
    () => PROVIDERS.find((p) => p.id === config.currentProviderId) ?? PROVIDERS[0],
    [config.currentProviderId]
  );

  const updateConfig = useCallback(async (partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next: AppConfig = {
        currentProviderId: partial.currentProviderId ?? prev.currentProviderId,
        apiKeys: partial.apiKeys !== undefined ? partial.apiKeys : prev.apiKeys,
      };
      saveConfig(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ config, currentProvider, updateConfig, isLoading: false }),
    [config, currentProvider, updateConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
