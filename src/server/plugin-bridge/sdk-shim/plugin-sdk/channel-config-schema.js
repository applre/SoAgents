// OpenClaw plugin-sdk/channel-config-schema shim for MyAgents Plugin Bridge
// Provides buildChannelConfigSchema() — converts Zod schema to JSON Schema (or passes through).

/**
 * Build a channel config schema from a Zod schema or plain object.
 * In real OpenClaw: zod → JSON Schema (draft-07) via toJSONSchema().
 * Our shim: if the schema has a toJSONSchema method, use it; otherwise treat
 * as a JSON Schema passthrough (or generic object).
 */
export function buildChannelConfigSchema(schema) {
  // Real OpenClaw wraps the JSON Schema in { schema: ... } (ChannelConfigSchema contract).
  let jsonSchema;
  if (!schema) {
    jsonSchema = { type: 'object', properties: {} };
  } else if (typeof schema.toJSONSchema === 'function') {
    // Zod schema: call .toJSONSchema() if available (zod v4+)
    try { jsonSchema = schema.toJSONSchema(); } catch { jsonSchema = { type: 'object', additionalProperties: true }; }
  } else if (typeof schema._def === 'object') {
    // Zod schema (v3): minimal conversion
    jsonSchema = { type: 'object', additionalProperties: true };
  } else if (typeof schema === 'object' && schema.type) {
    // Already a JSON Schema object
    jsonSchema = schema;
  } else {
    jsonSchema = { type: 'object', properties: {} };
  }
  return { schema: jsonSchema };
}

/**
 * Build a catch-all multi-account channel schema.
 * In real OpenClaw: wraps a per-account Zod schema in a record.
 * Our shim: passthrough — MyAgents handles multi-account via its own config.
 */
export function buildCatchallMultiAccountChannelSchema(accountSchema) {
  return accountSchema;
}

/**
 * Build nested DM config schema.
 * Returns a minimal config shape for DM policy.
 */
export function buildNestedDmConfigSchema() {
  return { type: 'object', properties: {
    enabled: { type: 'boolean' },
    policy: { type: 'string' },
    allowFrom: { type: 'array', items: { type: ['string', 'number'] } },
  }};
}

// Zod schema stubs for plugins that import them
export const AllowFromListSchema = undefined;
export const DmPolicySchema = undefined;
export const GroupPolicySchema = undefined;
export const MarkdownConfigSchema = undefined;
export const ToolPolicySchema = undefined;
