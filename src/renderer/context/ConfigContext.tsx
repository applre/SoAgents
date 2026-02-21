import { createContext, useContext } from 'react';
import type { AppConfig, Provider, ModelEntity } from '../../shared/types/config';

export interface ConfigState {
  config: AppConfig;
  currentProvider: Provider;
  currentModel: ModelEntity | null;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
  isLoading: boolean;
}

export const ConfigContext = createContext<ConfigState | null>(null);

export function useConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
