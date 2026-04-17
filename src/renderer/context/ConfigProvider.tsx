import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { ConfigDataContext, ConfigActionsContext } from './ConfigContext';
import type { AppConfig, Provider, ModelEntity, ProviderVerifyStatus } from '../../shared/types/config';
import type { WorkspaceEntry } from '../../shared/types/workspace';
import { DEFAULT_CONFIG, PROVIDERS } from '../../shared/providers';
import { globalApiGetJson, globalApiPutJson } from '../api/apiFetch';
import { loadAppConfig, atomicModifyConfig } from '../config/configService';
import { loadWorkspaces, atomicModifyWorkspaces } from '../config/workspaceService';
import { ensureAllWorkspacesHaveAgent, persistAgents } from '../config/agentConfigService';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
  const [providerVerifyStatus, setProviderVerifyStatus] = useState<Record<string, ProviderVerifyStatus>>({});

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
    // Run config + workspaces load together so we can reconcile them into a
    // single source of truth before any UI consumes `config.agents`. This is
    // the MyAgents-style startup reconcile — ensures every workspace has a
    // linked AgentConfig, repairs orphan agentId references, and creates
    // basicAgents for workspaces missing one.
    (async () => {
      try {
        const [loadedConfig, loadedWorkspaces] = await Promise.all([
          loadAppConfig(),
          loadWorkspaces(),
        ]);

        // Mutates loadedConfig.agents + loadedWorkspaces in place if any repair needed.
        const { changed } = ensureAllWorkspacesHaveAgent(
          loadedConfig,
          loadedWorkspaces,
        );
        if (changed) {
          await persistAgents(loadedConfig.agents ?? []);
          await atomicModifyWorkspaces(() => loadedWorkspaces);
        }

        setConfig(loadedConfig);
        setProviderVerifyStatus(loadedConfig.providerVerifyStatus ?? {});
        setWorkspaces(loadedWorkspaces);
      } catch (err) {
        console.error('[ConfigProvider] Failed to load config/workspaces:', err);
      }
    })();
    void loadProviders(); // eslint-disable-line react-hooks/set-state-in-effect
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
    const next = await atomicModifyConfig((prev) => {
      const merged = { ...prev, ...partial };
      // Provider 切换时清除 modelId
      if (partial.currentProviderId && partial.currentProviderId !== prev.currentProviderId) {
        merged.currentModelId = undefined;
      }
      return merged;
    });
    setConfig(next);
  }, []);

  const refreshConfig = useCallback(async () => {
    await loadProviders();
    loadWorkspaces()
      .then((ws) => setWorkspaces(ws))
      .catch((err) => console.error('[ConfigProvider] Failed to refresh workspaces:', err));
  }, [loadProviders]);

  // ── Provider Verify Status ──

  const saveProviderVerifyStatus = useCallback(async (
    providerId: string,
    status: 'valid' | 'invalid',
    accountEmail?: string,
  ) => {
    await globalApiPutJson('/api/provider-verify-status', { providerId, status, accountEmail });
    setProviderVerifyStatus((prev) => ({
      ...prev,
      [providerId]: {
        status,
        verifiedAt: new Date().toISOString(),
        ...(accountEmail ? { accountEmail } : {}),
      },
    }));
  }, []);

  // ── Workspace methods ──

  const updateWorkspaceConfig = useCallback(async (
    agentDir: string,
    partial: Partial<Omit<WorkspaceEntry, 'path' | 'lastOpenedAt'>>,
  ) => {
    const next = await atomicModifyWorkspaces((prev) => {
      const idx = prev.findIndex((w) => w.path === agentDir);
      if (idx >= 0) {
        const ws = { ...prev[idx] };
        // Provider 切换时清除 modelId
        if (partial.providerId !== undefined && partial.providerId !== ws.providerId) {
          ws.modelId = undefined;
        }
        Object.assign(ws, partial);
        const updated = [...prev];
        updated[idx] = ws;
        return updated;
      }
      // 不存在则新建
      return [...prev, { path: agentDir, lastOpenedAt: Date.now(), ...partial }];
    });
    setWorkspaces(next);
  }, []);

  const touchWorkspace = useCallback(async (agentDir: string) => {
    const next = await atomicModifyWorkspaces((prev) => {
      const idx = prev.findIndex((w) => w.path === agentDir);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastOpenedAt: Date.now() };
        return updated;
      }
      return [...prev, { path: agentDir, lastOpenedAt: Date.now() }];
    });
    setWorkspaces(next);
  }, []);

  const removeWorkspace = useCallback(async (agentDir: string) => {
    const next = await atomicModifyWorkspaces((prev) =>
      prev.filter((w) => w.path !== agentDir),
    );
    setWorkspaces(next);
  }, []);

  // ── Dual Context values ──

  const dataValue = useMemo(
    () => ({
      config, allProviders, currentProvider, currentModel, isLoading: providersLoading,
      providerVerifyStatus, workspaces,
    }),
    [config, allProviders, currentProvider, currentModel, providersLoading,
     providerVerifyStatus, workspaces]
  );

  const actionsValue = useMemo(
    () => ({
      updateConfig, refreshConfig, saveProviderVerifyStatus,
      updateWorkspaceConfig, touchWorkspace, removeWorkspace,
    }),
    [updateConfig, refreshConfig, saveProviderVerifyStatus,
     updateWorkspaceConfig, touchWorkspace, removeWorkspace]
  );

  return (
    <ConfigActionsContext.Provider value={actionsValue}>
      <ConfigDataContext.Provider value={dataValue}>
        {children}
      </ConfigDataContext.Provider>
    </ConfigActionsContext.Provider>
  );
}
