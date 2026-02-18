import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

export interface MCPServerConfig {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function readSettings(): Record<string, unknown> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return {};
  }
  try {
    const raw = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getAll(): Record<string, MCPServerConfig> {
  const settings = readSettings();
  const mcp = settings.mcp;
  if (!mcp || typeof mcp !== 'object') {
    return {};
  }
  return mcp as Record<string, MCPServerConfig>;
}

export function set(id: string, config: MCPServerConfig): void {
  const settings = readSettings();
  if (!settings.mcp || typeof settings.mcp !== 'object') {
    settings.mcp = {};
  }
  (settings.mcp as Record<string, MCPServerConfig>)[id] = config;
  writeSettings(settings);
}

export function remove(id: string): void {
  const settings = readSettings();
  if (!settings.mcp || typeof settings.mcp !== 'object') {
    return;
  }
  delete (settings.mcp as Record<string, MCPServerConfig>)[id];
  writeSettings(settings);
}
