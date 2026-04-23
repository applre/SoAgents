/**
 * Shim for openclaw/plugin-sdk/agent-runtime
 * Source: openclaw/src/plugin-sdk/agent-runtime.ts
 *
 * Provides agent tool result helpers used by channel plugins.
 * Only the commonly used symbols are shimmed; the full module re-exports
 * from ~25 internal files which are unnecessary in Bridge mode.
 */

// --- agents/tools/common.ts ---

const OWNER_ONLY_TOOL_ERROR = "Tool restricted to owner senders.";

class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
    this.status = 400;
  }
}

class ToolAuthorizationError extends ToolInputError {
  constructor(message) {
    super(message);
    this.name = "ToolAuthorizationError";
    this.status = 403;
  }
}

function createActionGate(actions) {
  return (key, defaultValue = true) => {
    const value = actions?.[key];
    if (value === undefined) return defaultValue;
    return value !== false;
  };
}

function readParamRaw(params, key) {
  if (key in params) return params[key];
  // snake_case fallback: fooBar → foo_bar
  const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  if (snake !== key && snake in params) return params[snake];
  return undefined;
}

function readStringParam(params, key, options = {}) {
  const { required = false, trim = true, label = key, allowEmpty = false } = options;
  const raw = readParamRaw(params, key);
  if (typeof raw !== "string") {
    if (required) throw new ToolInputError(`${label} required`);
    return undefined;
  }
  const value = trim ? raw.trim() : raw;
  if (!value && !allowEmpty) {
    if (required) throw new ToolInputError(`${label} required`);
    return undefined;
  }
  return value;
}

function readStringOrNumberParam(params, key, options = {}) {
  const { required = false, label = key } = options;
  const raw = readParamRaw(params, key);
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") {
    const value = raw.trim();
    if (value) return value;
  }
  if (required) throw new ToolInputError(`${label} required`);
  return undefined;
}

function readNumberParam(params, key, options = {}) {
  const { required = false, label = key, integer = false, strict = false } = options;
  const raw = readParamRaw(params, key);
  let value;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) {
      const parsed = strict ? Number(trimmed) : Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) value = parsed;
    }
  }
  if (value === undefined) {
    if (required) throw new ToolInputError(`${label} required`);
    return undefined;
  }
  return integer ? Math.trunc(value) : value;
}

function readStringArrayParam(params, key, options = {}) {
  const { required = false, label = key } = options;
  const raw = readParamRaw(params, key);
  if (Array.isArray(raw)) {
    const values = raw.filter((e) => typeof e === "string").map((e) => e.trim()).filter(Boolean);
    if (values.length === 0) {
      if (required) throw new ToolInputError(`${label} required`);
      return undefined;
    }
    return values;
  }
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) {
      if (required) throw new ToolInputError(`${label} required`);
      return undefined;
    }
    return [value];
  }
  if (required) throw new ToolInputError(`${label} required`);
  return undefined;
}

function stringifyToolPayload(payload) {
  if (typeof payload === "string") return payload;
  try {
    const encoded = JSON.stringify(payload, null, 2);
    if (typeof encoded === "string") return encoded;
  } catch { /* fall through */ }
  return String(payload);
}

function textResult(text, details) {
  return { content: [{ type: "text", text }], details };
}

function failedTextResult(text, details) {
  return textResult(text, details);
}

function payloadTextResult(payload) {
  return textResult(stringifyToolPayload(payload), payload);
}

function jsonResult(payload) {
  return textResult(JSON.stringify(payload, null, 2), payload);
}

function wrapOwnerOnlyToolExecution(tool, senderIsOwner) {
  if (tool.ownerOnly !== true || senderIsOwner || !tool.execute) return tool;
  return { ...tool, execute: async () => { throw new Error(OWNER_ONLY_TOOL_ERROR); } };
}

// --- agents/defaults.ts (commonly used constants) ---

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_CONTEXT_TOKENS = 200_000;

// --- agents/provider-id.ts (stub) ---

function normalizeProviderId(id) {
  return typeof id === "string" ? id.trim().toLowerCase() : "";
}

module.exports = {
  // tools/common
  OWNER_ONLY_TOOL_ERROR,
  ToolInputError,
  ToolAuthorizationError,
  createActionGate,
  readStringParam,
  readStringOrNumberParam,
  readNumberParam,
  readStringArrayParam,
  stringifyToolPayload,
  textResult,
  failedTextResult,
  payloadTextResult,
  jsonResult,
  wrapOwnerOnlyToolExecution,
  // defaults
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_CONTEXT_TOKENS,
  // provider-id
  normalizeProviderId,
};
