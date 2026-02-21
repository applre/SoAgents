import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, Provider, ModelEntity } from '../../shared/types/config';
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
      currentModelId: parsed.currentModelId,
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
    () => allProviders.find((p) => p.id === config.currentProviderId) ?? allProviders[0] ?? {
      id: 'anthropic-sub', name: 'Anthropic (订阅)', vendor: 'Anthropic', cloudProvider: '官方',
      type: 'subscription', primaryModel: 'claude-sonnet-4-6', isBuiltin: true, config: {}, models: [],
    },
    [config.currentProviderId, allProviders]
  );

  const currentModel = useMemo<ModelEntity | null>(() => {
    if (!currentProvider.models?.length) return null;
    if (config.currentModelId) {
      const found = currentProvider.models.find(m => m.model === config.currentModelId);
      if (found) return found;
    }
    if (currentProvider.primaryModel) {
      const found = currentProvider.models.find(m => m.model === currentProvider.primaryModel);
      if (found) return found;
    }
    return currentProvider.models[0];
  }, [currentProvider, config.currentModelId]);

  const updateConfig = useCallback(async (partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next: AppConfig = {
        currentProviderId: partial.currentProviderId ?? prev.currentProviderId,
        currentModelId: partial.currentProviderId && partial.currentProviderId !== prev.currentProviderId
          ? undefined
          : (partial.currentModelId !== undefined ? partial.currentModelId : prev.currentModelId),
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
    () => ({ config, currentProvider, currentModel, updateConfig, refreshConfig, isLoading: false }),
    [config, currentProvider, currentModel, updateConfig, refreshConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
