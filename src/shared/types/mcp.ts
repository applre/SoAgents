export interface McpServerDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  isBuiltin: boolean;
  isFree?: boolean;
  requiresConfig?: string[];   // e.g. ['GEMINI_API_KEY']
  configHint?: string;         // UI hint for config
  websiteUrl?: string;         // where to get API key
}

// ── MCP Enable Error ──

export type McpEnableErrorType =
  | 'command_not_found'
  | 'warmup_failed'
  | 'package_not_found'
  | 'runtime_error'
  | 'connection_failed'
  | 'unknown';

export interface McpEnableError {
  type: McpEnableErrorType;
  message: string;
  command?: string;
  runtimeName?: string;
  downloadUrl?: string;
}

/** MCP 服务器运行时状态 */
export type McpServerStatus = 'enabled' | 'connecting' | 'pending' | 'needs-auth' | 'error' | 'disabled';

export interface McpServerWithStatus extends McpServerDefinition {
  status: McpServerStatus;
  errorMessage?: string;
}
