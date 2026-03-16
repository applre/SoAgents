import { createContext, useContext } from 'react';
import type { AppConfig, Provider, ModelEntity, ProviderVerifyStatus } from '../../shared/types/config';
import type { WorkspaceEntry } from '../../shared/types/workspace';

// ── Data Context (changes when data changes) ──

export interface ConfigDataState {
  config: AppConfig;
  allProviders: Provider[];
  currentProvider: Provider;
  currentModel: ModelEntity | null;
  isLoading: boolean;
  providerVerifyStatus: Record<string, ProviderVerifyStatus>;

  // ── workspace ──
  workspaces: WorkspaceEntry[];
}

export const ConfigDataContext = createContext<ConfigDataState | null>(null);

// ── Actions Context (stable references, rarely changes) ──

export interface ConfigActionsState {
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;

  // verify status
  saveProviderVerifyStatus: (providerId: string, status: 'valid' | 'invalid', accountEmail?: string) => Promise<void>;

  // workspace
  updateWorkspaceConfig: (agentDir: string, partial: Partial<Omit<WorkspaceEntry, 'path' | 'lastOpenedAt'>>) => Promise<void>;
  touchWorkspace: (agentDir: string) => Promise<void>;
  removeWorkspace: (agentDir: string) => Promise<void>;
}

export const ConfigActionsContext = createContext<ConfigActionsState | null>(null);

// ── Hooks ──

export function useConfigData(): ConfigDataState {
  const ctx = useContext(ConfigDataContext);
  if (!ctx) throw new Error('useConfigData must be used within ConfigProvider');
  return ctx;
}

export function useConfigActions(): ConfigActionsState {
  const ctx = useContext(ConfigActionsContext);
  if (!ctx) throw new Error('useConfigActions must be used within ConfigProvider');
  return ctx;
}

// ── Compatibility layer — existing consumers use useConfig() without changes ──

export type ConfigState = ConfigDataState & ConfigActionsState;

export function useConfig(): ConfigState {
  const data = useConfigData();
  const actions = useConfigActions();
  return { ...data, ...actions };
}
