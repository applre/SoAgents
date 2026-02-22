import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

const MCP_CONFIG_PATH = join(homedir(), '.soagents', 'mcp.json');

export interface MCPServerConfig {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function readMcpConfig(): Record<string, MCPServerConfig> {
  if (!existsSync(MCP_CONFIG_PATH)) {
    return {};
  }
  try {
    const raw = readFileSync(MCP_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, MCPServerConfig>;
  } catch {
    return {};
  }
}

function writeMcpConfig(config: Record<string, MCPServerConfig>): void {
  const dir = dirname(MCP_CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getAll(): Record<string, MCPServerConfig> {
  return readMcpConfig();
}

export function set(id: string, config: MCPServerConfig): void {
  const all = readMcpConfig();
  all[id] = config;
  writeMcpConfig(all);
}

export function remove(id: string): void {
  const all = readMcpConfig();
  delete all[id];
  writeMcpConfig(all);
}
