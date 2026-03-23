import { globalApiGetJson, globalApiPostJson, globalApiPutJson, globalApiDeleteJson } from '../api/apiFetch';
import type { McpServerDefinition, McpEnableError } from '../../shared/types/mcp';

// ── Types ──

export interface MCPServerListResponse {
  servers: McpServerDefinition[];
  enabledIds: string[];
}

export interface MCPToggleResponse {
  ok: boolean;
  error?: McpEnableError;
}

export interface MCPSaveResponse {
  ok?: boolean;
  error?: string;
}

// ── API Functions ──

/** Get all MCP servers and enabled IDs */
export async function fetchMcpServers(): Promise<MCPServerListResponse> {
  return globalApiGetJson<MCPServerListResponse>('/api/mcp');
}

/** Toggle MCP server enabled/disabled */
export async function toggleMcpServer(id: string, enabled: boolean): Promise<MCPToggleResponse> {
  return globalApiPostJson<MCPToggleResponse>('/api/mcp/toggle', { id, enabled });
}

/** Add a new custom MCP server */
export async function addMcpServer(id: string, config: Record<string, unknown>): Promise<MCPSaveResponse> {
  return globalApiPostJson<MCPSaveResponse>('/api/mcp', { id, ...config });
}

/** Update an existing custom MCP server */
export async function updateMcpServer(id: string, config: Record<string, unknown>): Promise<MCPSaveResponse> {
  return globalApiPutJson<MCPSaveResponse>(`/api/mcp/${encodeURIComponent(id)}`, config);
}

/** Delete a custom MCP server */
export async function deleteMcpServer(id: string): Promise<void> {
  await globalApiDeleteJson(`/api/mcp/${id}`);
}

/** Get per-server env vars */
export async function fetchMcpEnv(): Promise<Record<string, Record<string, string>>> {
  return globalApiGetJson<Record<string, Record<string, string>>>('/api/mcp/env');
}

/** Save per-server env vars */
export async function saveMcpEnv(id: string, env: Record<string, string>): Promise<void> {
  await globalApiPutJson('/api/mcp/env', { id, env });
}

/** Check which MCP servers need config */
export async function checkNeedsConfig(): Promise<Record<string, boolean>> {
  return globalApiGetJson<Record<string, boolean>>('/api/mcp/needs-config');
}

/** Push effective MCP servers to backend session */
export async function pushEffectiveMcpServers(servers: Array<{ id: string; name: string; description?: string; type: string; isBuiltin: boolean }>): Promise<void> {
  await globalApiPostJson('/api/mcp/set', { servers });
}
