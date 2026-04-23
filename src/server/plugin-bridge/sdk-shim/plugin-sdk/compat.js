// OpenClaw plugin-sdk/compat shim for MyAgents Plugin Bridge
// compat.ts re-exports from index.ts — we only need the symbols the Feishu plugin actually imports.

// Re-export everything from the root SDK
export * from './index.js';

// ===== createPluginRuntimeStore =====

export function createPluginRuntimeStore() {
  const store = new Map();
  return {
    get(key) { return store.get(key); },
    set(key, value) { store.set(key, value); },
    delete(key) { store.delete(key); },
    has(key) { return store.has(key); },
    clear() { store.clear(); },
  };
}

// ===== channels/plugins/group-policy-warnings =====

export function collectAllowlistProviderRestrictSendersWarnings(_params) {
  return []; // No warnings in Bridge mode
}

// ===== plugin-sdk/allow-from =====

export function formatAllowFromLowercase(params) {
  return (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.stripPrefixRe ? e.replace(params.stripPrefixRe, '') : e)
    .map((e) => e.toLowerCase());
}

// ===== plugin-sdk/channel-config-helpers =====

export function mapAllowFromEntries(allowFrom) {
  return (allowFrom ?? []).map((entry) => String(entry));
}

// ===== channels/plugins/directory-config-helpers =====

export function listDirectoryGroupEntriesFromMapKeysAndAllowFrom(_params) {
  return []; // Bridge doesn't use OpenClaw's directory feature
}

export function listDirectoryUserEntriesFromAllowFromAndMapKeys(_params) {
  return []; // Bridge doesn't use OpenClaw's directory feature
}

// ===== Channel plugin stubs (declared in d.ts, must exist at runtime) =====

export function registerChannelPlugin() { return {}; }
export function createChannelPluginFromModule() { return {}; }
