import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import type { McpServerDefinition } from '../shared/types/mcp';
import { PRESET_MCP_SERVERS } from '../shared/mcp-presets';

const MCP_CONFIG_PATH = join(homedir(), '.soagents', 'mcp.json');
const MCP_STATE_PATH = join(homedir(), '.soagents', 'mcp-state.json');

// 保留旧接口用于文件读写（向后兼容 mcp.json 格式）
export interface MCPServerConfig {
  name?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface McpState {
  enabledServers: string[];
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readUserMcpConfig(): Record<string, MCPServerConfig> {
  if (!existsSync(MCP_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf-8')) as Record<string, MCPServerConfig>;
  } catch {
    return {};
  }
}

function writeUserMcpConfig(config: Record<string, MCPServerConfig>): void {
  ensureDir(MCP_CONFIG_PATH);
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function readMcpState(): McpState {
  if (!existsSync(MCP_STATE_PATH)) {
    // 首次运行：用户已有 MCP 全部启用，预设默认禁用
    const userConfigs = readUserMcpConfig();
    const userIds = Object.keys(userConfigs);
    return { enabledServers: userIds };
  }
  try {
    return JSON.parse(readFileSync(MCP_STATE_PATH, 'utf-8')) as McpState;
  } catch {
    return { enabledServers: [] };
  }
}

function writeMcpState(state: McpState): void {
  ensureDir(MCP_STATE_PATH);
  writeFileSync(MCP_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 返回所有 MCP 服务器定义（预设 + 用户自定义合并）
 */
export function getAll(): McpServerDefinition[] {
  const userConfigs = readUserMcpConfig();
  const result: McpServerDefinition[] = [];

  // 预设 MCP
  for (const preset of PRESET_MCP_SERVERS) {
    result.push({ ...preset });
  }

  // 用户自定义 MCP
  for (const [id, cfg] of Object.entries(userConfigs)) {
    // 如果用户自定义的 ID 与预设重复，跳过（预设优先）
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

/**
 * 获取全局启用的 MCP 服务器 ID 列表
 */
export function getEnabledIds(): string[] {
  return readMcpState().enabledServers;
}

/**
 * 切换 MCP 服务器的启用/禁用状态
 */
export function setEnabled(id: string, enabled: boolean): void {
  const state = readMcpState();
  const set = new Set(state.enabledServers);
  if (enabled) {
    set.add(id);
  } else {
    set.delete(id);
  }
  state.enabledServers = [...set];
  writeMcpState(state);
}

/**
 * 添加/更新用户自定义 MCP
 */
export function set(id: string, config: MCPServerConfig): void {
  const all = readUserMcpConfig();
  all[id] = config;
  writeUserMcpConfig(all);

  // 新添加的用户 MCP 默认启用
  const state = readMcpState();
  if (!state.enabledServers.includes(id)) {
    state.enabledServers.push(id);
    writeMcpState(state);
  }
}

/**
 * 删除 MCP（拒绝删除内置）
 */
export function remove(id: string): boolean {
  if (PRESET_MCP_SERVERS.some((p) => p.id === id)) {
    return false; // 不允许删除内置
  }
  const all = readUserMcpConfig();
  delete all[id];
  writeUserMcpConfig(all);

  // 从启用列表中移除
  const state = readMcpState();
  state.enabledServers = state.enabledServers.filter((s) => s !== id);
  writeMcpState(state);
  return true;
}

/**
 * 检查指定 ID 是否为内置 MCP
 */
export function isBuiltin(id: string): boolean {
  return PRESET_MCP_SERVERS.some((p) => p.id === id);
}
