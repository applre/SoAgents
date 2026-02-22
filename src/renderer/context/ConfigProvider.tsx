import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { ConfigContext } from './ConfigContext';
import type { AppConfig, Provider, ModelEntity } from '../../shared/types/config';
import { DEFAULT_CONFIG, PROVIDERS } from '../../shared/providers';
import { globalApiGetJson, globalApiPutJson } from '../api/apiFetch';

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

  useEffect(() => {
    void loadProviders().then(() => {
      // 启动时双向同步：后端 ↔ localStorage
      globalApiGetJson<AppConfig>('/config')
        .then((backendConfig) => {
          const localConfig = loadConfig();
          const hasLocalApiKeys = Object.keys(localConfig.apiKeys).length > 0;
          const hasLocalProvider = localConfig.currentProviderId !== DEFAULT_CONFIG.currentProviderId;
          // 后端有数据而本地没有 → 用后端的（本地缓存被清过）
          // 本地有数据而后端没有 → 合并后回写后端
          const merged: AppConfig = {
            currentProviderId: hasLocalProvider
              ? localConfig.currentProviderId
              : (backendConfig.currentProviderId ?? localConfig.currentProviderId),
            currentModelId: localConfig.currentModelId ?? backendConfig.currentModelId,
            apiKeys: hasLocalApiKeys
              ? { ...backendConfig.apiKeys, ...localConfig.apiKeys }
              : (backendConfig.apiKeys ?? localConfig.apiKeys),
            customProviders: localConfig.customProviders,
          };
          saveConfig(merged);
          setConfig(merged);
          // 合并结果回写后端，确保 localStorage 已有的配置被持久化到 config.json
          globalApiPutJson('/config', merged).catch(() => {});
        })
        .catch(() => { /* 静默失败，使用 localStorage */ });
    });
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
    const prev = loadConfig();
    const next: AppConfig = {
      currentProviderId: partial.currentProviderId ?? prev.currentProviderId,
      currentModelId: partial.currentProviderId && partial.currentProviderId !== prev.currentProviderId
        ? undefined
        : (partial.currentModelId !== undefined ? partial.currentModelId : prev.currentModelId),
      apiKeys: partial.apiKeys !== undefined ? partial.apiKeys : prev.apiKeys,
      customProviders: partial.customProviders !== undefined ? partial.customProviders : prev.customProviders,
    };
    saveConfig(next);
    setConfig(next);
    // 异步同步到后端文件，不阻塞 UI
    globalApiPutJson('/config', next).catch((err) =>
      console.warn('[ConfigProvider] Failed to sync config to backend:', err),
    );
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
