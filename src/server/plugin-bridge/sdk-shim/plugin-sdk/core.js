// OpenClaw plugin-sdk/core shim for MyAgents Plugin Bridge
// Re-exports core types and factory functions used by 3.22+ plugins.

// Re-export account-id utilities (plugins import from core or account-id)
export { normalizeAccountId, DEFAULT_ACCOUNT_ID } from './account-id.js';

/**
 * Define a channel plugin entry.
 * In real OpenClaw: validates the plugin and wraps it with lifecycle hooks.
 * Our shim: normalize and pass through — Bridge handles lifecycle via compat-api.
 */
export function defineChannelPluginEntry(params) {
  return {
    id: params.id || 'unknown',
    name: params.name || params.id || 'Unknown',
    description: params.description || '',
    plugin: params.plugin,
    configSchema: typeof params.configSchema === 'function'
      ? params.configSchema()
      : (params.configSchema || { type: 'object', properties: {} }),
    setRuntime: params.setRuntime || (() => {}),
    registerFull: params.registerFull || (() => {}),
    register(api) {
      if (typeof params.setRuntime === 'function' && api.runtime) {
        params.setRuntime(api.runtime);
      }
      // Pass entry-level id/name alongside plugin so compat-api.registerChannel
      // can read them (plugin object itself may not have id/name set).
      const pluginObj = params.plugin || {};
      if (params.id && !pluginObj.id) pluginObj.id = params.id;
      if (params.name && !pluginObj.name) pluginObj.name = params.name;
      api.registerChannel({ plugin: pluginObj });
      if (typeof params.registerFull === 'function') {
        params.registerFull(api);
      }
    },
  };
}

/**
 * Create a chat channel plugin from adapter components.
 * In real OpenClaw: assembles base, security, pairing, threading, outbound adapters.
 * Our shim: merges everything into a single object — Bridge accesses .gateway directly.
 */
export function createChatChannelPlugin(params) {
  const base = params.base || {};
  return {
    ...base,
    security: params.security || {},
    pairing: params.pairing || {},
    threading: params.threading || {},
    outbound: params.outbound || {},
  };
}

/**
 * Create a channel plugin base from options.
 */
export function createChannelPluginBase(params) {
  return params || {};
}

/**
 * Build an outbound session route descriptor.
 */
export function buildChannelOutboundSessionRoute(params) {
  return {
    agentId: params.agentId || 'default',
    channel: params.channel || 'unknown',
    accountId: params.accountId || null,
    peer: params.peer || { kind: 'direct', id: '' },
    chatType: params.chatType || 'direct',
    from: params.from || '',
    to: params.to || '',
    threadId: params.threadId,
  };
}

/**
 * Strip channel target prefix from a raw target string.
 */
export function stripChannelTargetPrefix(raw, ...providers) {
  if (!raw || typeof raw !== 'string') return raw || '';
  for (const provider of providers) {
    const prefix = `${provider}:`;
    if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  }
  return raw;
}

/**
 * Strip target kind prefix (e.g. "dm:", "group:") from a raw target string.
 */
export function stripTargetKindPrefix(raw) {
  if (!raw || typeof raw !== 'string') return raw || '';
  const colonIdx = raw.indexOf(':');
  if (colonIdx > 0 && colonIdx < 10) return raw.slice(colonIdx + 1);
  return raw;
}
