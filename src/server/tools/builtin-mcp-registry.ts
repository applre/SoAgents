// Builtin MCP Registry — decouples buildSdkMcpServers() and /api/mcp/enable
// from knowing about specific builtin MCP implementations.
//
// Each builtin MCP self-registers via registerBuiltinMcp() at import time.
// Adding a new builtin MCP requires only adding a registerBuiltinMcp() call
// in the new tool file — zero changes to agent-session.ts or index.ts.

export interface BuiltinMcpSessionContext {
  sessionId: string;
  workspace?: string;
}

export interface BuiltinMcpEntry {
  /** SDK server object (passed to Agent SDK mcpServers) */
  server: unknown;
  /** Extract config from env and initialize the server. Called during buildSdkMcpServers(). */
  configure: (env: Record<string, string>, ctx: BuiltinMcpSessionContext) => void;
  /** Validate config on enable. Return error object or null if valid. */
  validate?: (env: Record<string, string>) => Promise<{ type: string; message: string } | null>;
}

const registry = new Map<string, BuiltinMcpEntry>();

export function registerBuiltinMcp(id: string, entry: BuiltinMcpEntry): void {
  registry.set(id, entry);
}

export function getBuiltinMcp(id: string): BuiltinMcpEntry | undefined {
  return registry.get(id);
}

export function getAllBuiltinMcpIds(): string[] {
  return [...registry.keys()];
}
