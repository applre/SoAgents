/**
 * MCP Tool Proxy Handler
 *
 * Takes captured tools from compat-api, resolves their factories with context,
 * and exposes list-tools / call-tool interfaces for MCP proxy endpoints.
 */

import type { CapturedTool } from './compat-api';

export interface McpToolDefinition {
  name: string;
  description: string;
  group: string;
  ownerOnly: boolean;
  parameters: Record<string, unknown>;
}

// ===== Tool group resolution =====
// Generic protocol: trust plugin-declared group. Feishu-specific fallback when undeclared.

/**
 * Feishu-specific fallback: derive group from tool name when the plugin
 * doesn't declare a `group` field. Other plugins should declare their own groups.
 */
function inferToolGroupFeishu(toolName: string): string {
  if (toolName.startsWith('feishu_bitable_')) return 'bitable';
  if (toolName.startsWith('feishu_chat')) return 'chat';
  if (toolName.startsWith('feishu_wiki') || toolName.startsWith('feishu_drive')) return 'wiki_drive';
  if (toolName.startsWith('feishu_doc') || (toolName.startsWith('feishu_') && toolName.endsWith('_doc')) || toolName === 'feishu_app_scopes') return 'doc';
  if (toolName.startsWith('feishu_perm')) return 'perm';
  if (toolName.startsWith('feishu_calendar_')) return 'calendar';
  if (toolName.startsWith('feishu_task')) return 'task';
  if (toolName === 'feishu_sheet') return 'sheet';
  // Exact matches before prefix: feishu_search_user is 'common', feishu_search_* is 'search'
  if (toolName === 'feishu_get_user' || toolName === 'feishu_search_user') return 'common';
  if (toolName.startsWith('feishu_search')) return 'search';
  if (toolName.startsWith('feishu_im_')) return 'im';
  if (toolName.startsWith('feishu_oauth') || toolName === 'feishu_ask_user_question') return 'interaction';
  return 'other';
}

// ===== Resolved tool cache =====

interface ResolvedTool {
  name: string;
  description: string;
  group: string;
  ownerOnly: boolean;
  parameters: Record<string, unknown>;
  execute: (toolCallIdOrArgs: unknown, paramsOrUserId?: unknown) => Promise<unknown>;
}

export function createMcpHandler(
  getCapturedTools: () => CapturedTool[],
  pluginConfig: Record<string, unknown>,
  /** Plugin brand (e.g. 'feishu', 'qqbot'). Used to select the correct group inference fallback. */
  pluginBrand?: string,
) {
  // Cache resolved tools (resolved once from factories, reused across calls)
  let resolvedToolsCache: ResolvedTool[] | null = null;

  function resolveAllTools(): ResolvedTool[] {
    if (resolvedToolsCache) return resolvedToolsCache;

    const captured = getCapturedTools();
    const resolved: ResolvedTool[] = [];

    // Build a context object that factories may use for configuration
    const ctx: Record<string, unknown> = {
      config: pluginConfig,
      ...pluginConfig,
    };

    for (const ct of captured) {
      try {
        const result = ct.factory(ctx);
        if (!result) continue;

        const tools = Array.isArray(result) ? result : [result];
        for (const tool of tools) {
          const name = String(tool.name || ct.name || 'unknown');
          const description = String(tool.description || '');
          const parameters = (tool.parameters || tool.inputSchema || {}) as Record<string, unknown>;
          const execute = typeof tool.execute === 'function'
            ? (tool.execute as ResolvedTool['execute'])
            : async () => ({ error: 'Tool has no execute method' });

          // Generic protocol: use plugin-declared group if present.
          // Fallback: Feishu → name-based inference; other plugins → 'default' group.
          const declaredGroup = typeof tool.group === 'string' ? tool.group.trim() : '';
          const inferredGroup = declaredGroup
            || (pluginBrand === 'feishu' ? inferToolGroupFeishu(name) : 'default');
          resolved.push({
            name,
            description,
            group: inferredGroup,
            ownerOnly: !!(tool as Record<string, unknown>).ownerOnly,
            parameters,
            execute,
          });
        }
      } catch (err) {
        console.warn(`[mcp-handler] Failed to resolve tool factory "${ct.name}":`, err);
      }
    }

    resolvedToolsCache = resolved;
    console.log(`[mcp-handler] Resolved ${resolved.length} tools from ${captured.length} factories`);
    return resolved;
  }

  /**
   * List available tools, optionally filtered by enabled groups.
   */
  function resolveTools(enabledGroups?: string[]): McpToolDefinition[] {
    const all = resolveAllTools();
    const filtered = enabledGroups?.length
      ? all.filter((t) => enabledGroups.includes(t.group))
      : all;

    return filtered.map((t) => ({
      name: t.name,
      description: t.description,
      group: t.group,
      ownerOnly: t.ownerOnly,
      parameters: t.parameters,
    }));
  }

  /**
   * Call a tool by name with the given arguments.
   */
  async function callTool(
    toolName: string,
    args: Record<string, unknown>,
    userId?: string,
    isOwner?: boolean,
  ): Promise<unknown> {
    const all = resolveAllTools();
    const tool = all.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    // ownerOnly tools require sender to be in the allowed_users whitelist
    if (tool.ownerOnly && !isOwner) {
      throw new Error(`Tool "${toolName}" requires owner permission`);
    }
    // OpenClaw plugin execute signature: execute(toolCallId, params)
    // First arg is a call ID (plugins ignore it with _), second is actual parameters
    return tool.execute(userId || '', args);
  }

  /**
   * Get unique tool group IDs from all resolved tools.
   */
  function getToolGroups(): string[] {
    const all = resolveAllTools();
    return [...new Set(all.map((t) => t.group))];
  }

  /**
   * Invalidate the resolved tool cache (e.g. after config changes).
   */
  function invalidateCache(): void {
    resolvedToolsCache = null;
  }

  return { resolveTools, callTool, getToolGroups, invalidateCache };
}
