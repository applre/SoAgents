import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { McpServerDefinition } from '../shared/types/mcp';
import { PRESET_MCP_SERVERS } from '../shared/mcp-presets';
import { readConfig, updateConfig, CONFIG_DIR } from './ConfigStore';

// ── 旧文件迁移 ──

const MIGRATION_FLAG = join(CONFIG_DIR, 'mcp-migrated');
let migrationDone = false;

function ensureMigration(): void {
  if (migrationDone) return;
  migrationDone = true;
  if (existsSync(MIGRATION_FLAG)) return;

  const oldMcpPath = join(CONFIG_DIR, 'mcp.json');
  const oldStatePath = join(CONFIG_DIR, 'mcp-state.json');
  const oldEnvPath = join(CONFIG_DIR, 'mcp-env.json');

  try {
    let didMigrate = false;
    const patch: Record<string, unknown> = {};

    if (existsSync(oldMcpPath)) {
      patch.mcpServers = JSON.parse(readFileSync(oldMcpPath, 'utf-8'));
      didMigrate = true;
    }
    if (existsSync(oldStatePath)) {
      const state = JSON.parse(readFileSync(oldStatePath, 'utf-8'));
      patch.mcpEnabledServers = state.enabledServers ?? state.enabledIds ?? [];
      didMigrate = true;
    }
    if (existsSync(oldEnvPath)) {
      patch.mcpServerEnv = JSON.parse(readFileSync(oldEnvPath, 'utf-8'));
      didMigrate = true;
    }

    if (didMigrate) {
      updateConfig(patch as Parameters<typeof updateConfig>[0]);
      writeFileSync(MIGRATION_FLAG, new Date().toISOString());
      console.log('[MCPConfigStore] Migrated from legacy files to AppConfig');
    }
  } catch (err) {
    console.error('[MCPConfigStore] Migration failed:', err);
  }
}

// ── 保留旧接口用于 AppConfig 内部存储格式 ──
export interface MCPServerConfig {
  name?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// ── 公开函数（签名不变，调用方无需修改）──

export function getAll(): McpServerDefinition[] {
  ensureMigration();
  const config = readConfig();
  const userConfigs = config.mcpServers ?? {};
  const result: McpServerDefinition[] = [];

  for (const preset of PRESET_MCP_SERVERS) {
    result.push({ ...preset });
  }
  for (const [id, cfg] of Object.entries(userConfigs)) {
    if (PRESET_MCP_SERVERS.some((p) => p.id === id)) continue;
    result.push({
      id,
      name: cfg.name ?? id,
      type: cfg.type,
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
      url: cfg.url,
      headers: cfg.headers,
      isBuiltin: false,
    });
  }
  return result;
}

export function getEnabledIds(): string[] {
  ensureMigration();
  return readConfig().mcpEnabledServers ?? [];
}

export function setEnabled(id: string, enabled: boolean): void {
  const config = readConfig();
  const set = new Set(config.mcpEnabledServers ?? []);
  if (enabled) set.add(id); else set.delete(id);
  updateConfig({ mcpEnabledServers: [...set] });
}

export function set(id: string, config: MCPServerConfig): void {
  const current = readConfig();
  const servers = { ...(current.mcpServers ?? {}), [id]: config };
  updateConfig({ mcpServers: servers });
  // 新 MCP 默认启用
  const enabled = new Set(current.mcpEnabledServers ?? []);
  if (!enabled.has(id)) {
    enabled.add(id);
    updateConfig({ mcpEnabledServers: [...enabled] });
  }
}

export function remove(id: string): boolean {
  if (PRESET_MCP_SERVERS.some((p) => p.id === id)) return false;
  const current = readConfig();
  const servers = { ...(current.mcpServers ?? {}) };
  delete servers[id];
  const enabled = (current.mcpEnabledServers ?? []).filter((s) => s !== id);
  updateConfig({ mcpServers: servers, mcpEnabledServers: enabled });
  return true;
}

export function isBuiltin(id: string): boolean {
  return PRESET_MCP_SERVERS.some((p) => p.id === id);
}

export function getServerEnv(id: string): Record<string, string> {
  return readConfig().mcpServerEnv?.[id] ?? {};
}

export function getAllServerEnv(): Record<string, Record<string, string>> {
  return readConfig().mcpServerEnv ?? {};
}

export function setServerEnv(id: string, env: Record<string, string>): void {
  const current = readConfig();
  const allEnv = { ...(current.mcpServerEnv ?? {}), [id]: env };
  updateConfig({ mcpServerEnv: allEnv });
}

export function checkNeedsConfig(id: string): boolean {
  const preset = PRESET_MCP_SERVERS.find((p) => p.id === id);
  if (!preset?.requiresConfig?.length) return false;
  const env = getServerEnv(id);
  return preset.requiresConfig.some((key) => !env[key]);
}
