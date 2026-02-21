import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, Provider } from '../../shared/types/config';
import { DEFAULT_CONFIG } from '../../shared/providers';
import { globalApiGetJson } from '../api/apiFetch';

const STORAGE_KEY = 'soagents:config';

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      currentProviderId: parsed.currentProviderId ?? DEFAULT_CONFIG.currentProviderId,
      apiKeys: parsed.apiKeys ?? {},
      customProviders: parsed.customProviders ?? [],
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
  const [allProviders, setAllProviders] = useState<Provider[]>([]);

  const loadProviders = useCallback(async () => {
    try {
      const data = await globalApiGetJson<Provider[]>('/api/providers');
      setAllProviders(data);
    } catch {
      setAllProviders([]);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const currentProvider = useMemo<Provider>(
    () => allProviders.find((p) => p.id === config.currentProviderId) ?? allProviders[0] ?? { id: 'anthropic', name: 'Anthropic', type: 'subscription' },
    [config.currentProviderId, allProviders]
  );

  const updateConfig = useCallback(async (partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next: AppConfig = {
        currentProviderId: partial.currentProviderId ?? prev.currentProviderId,
        apiKeys: partial.apiKeys !== undefined ? partial.apiKeys : prev.apiKeys,
        customProviders: partial.customProviders !== undefined ? partial.customProviders : prev.customProviders,
      };
      saveConfig(next);
      return next;
    });
  }, []);

  const refreshConfig = useCallback(async () => {
    await loadProviders();
  }, [loadProviders]);

  const value = useMemo(
    () => ({ config, currentProvider, updateConfig, refreshConfig, isLoading: false }),
    [config, currentProvider, updateConfig, refreshConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
