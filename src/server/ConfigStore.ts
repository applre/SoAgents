import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { AppConfig, Provider } from '../shared/types/config';
import { DEFAULT_CONFIG, PROVIDERS } from '../shared/providers';

const DATA_DIR = join(homedir(), '.soagents');
const CONFIG_PATH = join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): AppConfig {
  ensureDataDir();
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
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

export function writeConfig(config: AppConfig): void {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function isValidCustomProviderId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id);
}

// Custom Provider CRUD
export function addCustomProvider(provider: Omit<Provider, 'id'>, preferredId?: string): string {
  const config = readConfig();
  if (!config.customProviders) {
    config.customProviders = [];
  }
  const allProviders = [...PROVIDERS, ...config.customProviders];
  const preferred = preferredId?.trim();

  let id: string;
  if (preferred) {
    if (!isValidCustomProviderId(preferred)) {
      throw new Error('Provider ID 仅支持小写字母、数字、短横线');
    }
    if (allProviders.some((p) => p.id === preferred)) {
      throw new Error(`Provider ID 已存在: ${preferred}`);
    }
    id = preferred;
  } else {
    // 生成唯一 ID: custom-{timestamp}-{random}
    do {
      id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    } while (allProviders.some((p) => p.id === id));
  }

  const newProvider: Provider = { ...provider, id };
  config.customProviders.push(newProvider);
  writeConfig(config);
  return id;
}

export function updateCustomProvider(id: string, updates: Partial<Provider>): void {
  const config = readConfig();
  if (!config.customProviders) {
    config.customProviders = [];
  }
  const index = config.customProviders.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Provider not found: ${id}`);
  }
  config.customProviders[index] = { ...config.customProviders[index], ...updates };
  writeConfig(config);
}

export function deleteCustomProvider(id: string): void {
  const config = readConfig();
  if (!config.customProviders) {
    config.customProviders = [];
  }
  config.customProviders = config.customProviders.filter((p) => p.id !== id);
  writeConfig(config);
}

export function getAllProviders(): Provider[] {
  const config = readConfig();
  return [...PROVIDERS, ...(config.customProviders ?? [])];
}
