import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, Provider, ModelEntity } from '../../shared/types/config';
import { DEFAULT_CONFIG, PROVIDERS } from '../../shared/providers';
import { globalApiGetJson } from '../api/apiFetch';
import { loadAppConfig, atomicModifyConfig } from '../config/configService';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  const loadProviders = useCallback(async () => {
    // Global sidecar 可能还没启动完毕（App.tsx useEffect 在 ConfigProvider 之后执行），
    // 需要重试等待 sidecar 就绪
    setProvidersLoading(true);
    const MAX_RETRIES = 8;
    const RETRY_DELAY = 800;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const data = await globalApiGetJson<Provider[]>('/api/providers');
        setAllProviders(data);
        setProvidersLoading(false);
        return;
      } catch {
        if (i < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        }
      }
    }
    // 全部重试失败，使用内置 PROVIDERS 作为兜底
    setAllProviders(PROVIDERS);
    setProvidersLoading(false);
  }, []);

  // 启动时从 Tauri FS（或 localStorage）加载配置
  useEffect(() => {
    loadAppConfig()
      .then((loaded) => setConfig(loaded))
      .catch((err) => console.error('[ConfigProvider] Failed to load config:', err));
    void loadProviders();
  }, [loadProviders]);

  const currentProvider = useMemo<Provider>(() => {
    if (allProviders.length === 0) {
      // 加载中，返回占位 Provider（isLoading 为 true 时 UI 不应依赖此值）
      return { id: '', name: '', vendor: '', cloudProvider: '', type: 'api', primaryModel: '', isBuiltin: false, config: {}, models: [] };
    }
    return allProviders.find((p) => p.id === config.currentProviderId) ?? allProviders[0];
  }, [config.currentProviderId, allProviders]);

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
    const next = await atomicModifyConfig((prev) => ({
      currentProviderId: partial.currentProviderId ?? prev.currentProviderId,
      currentModelId: partial.currentProviderId && partial.currentProviderId !== prev.currentProviderId
        ? undefined
        : (partial.currentModelId !== undefined ? partial.currentModelId : prev.currentModelId),
      apiKeys: partial.apiKeys !== undefined ? partial.apiKeys : prev.apiKeys,
      customProviders: partial.customProviders !== undefined ? partial.customProviders : prev.customProviders,
    }));
    setConfig(next);
  }, []);

  const refreshConfig = useCallback(async () => {
    await loadProviders();
  }, [loadProviders]);

  const value = useMemo(
    () => ({ config, allProviders, currentProvider, currentModel, updateConfig, refreshConfig, isLoading: providersLoading }),
    [config, allProviders, currentProvider, currentModel, updateConfig, refreshConfig, providersLoading]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
