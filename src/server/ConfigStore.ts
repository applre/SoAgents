import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { AppConfig, Provider, ModelEntity, ModelAliases, ProviderVerifyStatus } from '../shared/types/config';
import { DEFAULT_CONFIG, PROVIDERS } from '../shared/providers';
import { safeWriteJsonSync, safeLoadJsonSync } from './safeJson';

const DATA_DIR = join(homedir(), '.soagents');
export const CONFIG_DIR = DATA_DIR;
const CONFIG_PATH = join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): AppConfig {
  ensureDataDir();
  const parsed = safeLoadJsonSync<Partial<AppConfig>>(CONFIG_PATH, {});
  if (!parsed || Object.keys(parsed).length === 0) {
    return { ...DEFAULT_CONFIG };
  }
  return {
    currentProviderId: parsed.currentProviderId ?? DEFAULT_CONFIG.currentProviderId,
    currentModelId: parsed.currentModelId,
    apiKeys: parsed.apiKeys ?? {},
    customProviders: parsed.customProviders ?? [],
    presetCustomModels: parsed.presetCustomModels,
    providerVerifyStatus: parsed.providerVerifyStatus,
    providerModelAliases: parsed.providerModelAliases,
    mcpServerArgs: parsed.mcpServerArgs,
    // ── MCP 统一存储字段 ──
    mcpServers: parsed.mcpServers,
    mcpEnabledServers: parsed.mcpEnabledServers,
    mcpServerEnv: parsed.mcpServerEnv,
    // ── 其他持久化字段 ──
    minimizeToTray: parsed.minimizeToTray,
    defaultWorkspacePath: parsed.defaultWorkspacePath,
    proxySettings: parsed.proxySettings,
    showDevTools: parsed.showDevTools,
  };
}

export function writeConfig(config: AppConfig): void {
  ensureDataDir();
  safeWriteJsonSync(CONFIG_PATH, config);
}

/**
 * Disk-first 部分更新：读取最新配置 → 合并 → 写入。
 * 遵循 CLAUDE.md "Config 持久化" 约束。
 */
export function updateConfig(partial: Partial<AppConfig>): void {
  const current = readConfig();
  const merged = { ...current, ...partial };
  writeConfig(merged);
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

export function savePresetCustomModels(providerId: string, models: ModelEntity[]): void {
  const config = readConfig();
  if (!config.presetCustomModels) {
    config.presetCustomModels = {};
  }
  if (models.length === 0) {
    delete config.presetCustomModels[providerId];
  } else {
    config.presetCustomModels[providerId] = models;
  }
  writeConfig(config);
}

export function saveProviderVerifyStatus(
  providerId: string,
  status: 'valid' | 'invalid',
  accountEmail?: string,
): void {
  const config = readConfig();
  if (!config.providerVerifyStatus) {
    config.providerVerifyStatus = {};
  }
  config.providerVerifyStatus[providerId] = {
    status,
    verifiedAt: new Date().toISOString(),
    ...(accountEmail ? { accountEmail } : {}),
  };
  writeConfig(config);
}

export function getProviderVerifyStatus(): Record<string, ProviderVerifyStatus> {
  const config = readConfig();
  return config.providerVerifyStatus ?? {};
}

export function saveProviderModelAliases(providerId: string, aliases: ModelAliases): void {
  const config = readConfig();
  if (!config.providerModelAliases) {
    config.providerModelAliases = {};
  }
  const hasValue = aliases.sonnet || aliases.opus || aliases.haiku;
  if (hasValue) {
    config.providerModelAliases[providerId] = aliases;
  } else {
    delete config.providerModelAliases[providerId];
  }
  writeConfig(config);
}

/** 将 presetCustomModels 合并到预设 Provider 的模型列表中 */
function mergePresetCustomModels(providers: Provider[], presetCustomModels?: Record<string, ModelEntity[]>): Provider[] {
  if (!presetCustomModels) return providers;
  return providers.map((p) => {
    const extra = presetCustomModels[p.id];
    if (!extra?.length || !p.isBuiltin) return p;
    // 去重：只追加 model ID 不存在于预设中的
    const existingIds = new Set(p.models.map((m) => m.model));
    const newModels = extra.filter((m) => !existingIds.has(m.model));
    if (newModels.length === 0) return p;
    return { ...p, models: [...p.models, ...newModels] };
  });
}

export function getAllProviders(): Provider[] {
  const config = readConfig();
  const presets = mergePresetCustomModels(PROVIDERS, config.presetCustomModels);
  return [...presets, ...(config.customProviders ?? [])];
}
