import { createContext, useContext } from 'react';
import type { AppConfig, Provider } from '../types/config';

export interface ConfigState {
  config: AppConfig;
  currentProvider: Provider;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  isLoading: boolean;
}

export const ConfigContext = createContext<ConfigState | null>(null);

export function useConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
