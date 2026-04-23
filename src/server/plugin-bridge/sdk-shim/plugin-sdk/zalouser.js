/** Shim for openclaw/plugin-sdk/zalouser */

// This module is a private helper surface for the bundled zalouser plugin.
// In Bridge mode, most of these are unused. Provide minimal stubs to prevent
// "Cannot find module" errors.

const DEFAULT_ACCOUNT_ID = 'default';

function normalizeAccountId(id) {
  if (!id || id === 'default') return DEFAULT_ACCOUNT_ID;
  return String(id).trim().toLowerCase();
}

// --- allow-from re-exports ---

function mergeAllowlist(params) {
  const all = [...(params.existing ?? []).map((e) => String(e).trim()), ...params.additions];
  return [...new Set(all.filter(Boolean))];
}

function summarizeMapping(mapping) { return (mapping ?? []).join(', '); }

// --- mention gating ---

function resolveMentionGatingWithBypass(_params) {
  return { shouldProcess: true, reason: 'bypass' };
}

// --- config helpers ---

function deleteAccountFromConfigSection(config, section) {
  if (config && config[section]) delete config[section];
  return config || {};
}

function setAccountEnabledInConfigSection(config, section, enabled) {
  if (!config) config = {};
  if (!config[section]) config[section] = {};
  config[section].enabled = enabled;
  return config;
}

// --- config schema ---

function buildChannelConfigSchema(schema) {
  if (schema && typeof schema.toJSONSchema === 'function') {
    try {
      return { schema: schema.toJSONSchema({ target: 'draft-07', unrepresentable: 'any' }) };
    } catch { /* fallback */ }
  }
  return { schema: { type: 'object', additionalProperties: true } };
}

// --- pairing helpers ---

function formatPairingApproveHint() { return ''; }

// --- setup wizard helpers ---

function addWildcardAllowFrom(allowFrom) {
  const next = (allowFrom ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (!next.includes('*')) next.push('*');
  return next;
}

function mergeAllowFromEntries(current, additions) {
  const merged = [...(current ?? []), ...(additions ?? [])].map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(merged)];
}

function setTopLevelChannelDmPolicyWithAllowFrom() {}

// --- setup helpers ---

function applyAccountNameToChannelSection(config, section, name) {
  if (!config) config = {};
  if (!config[section]) config[section] = {};
  config[section].name = name;
  return config;
}

function applySetupAccountConfigPatch() { return {}; }
function migrateBaseNameToDefaultAccount() { return {}; }
function patchScopedAccountConfig() { return {}; }

// --- account helpers ---

function createAccountListHelpers() {
  return {
    listAccounts: () => [],
    getAccount: () => undefined,
    addAccount: () => {},
    removeAccount: () => {},
  };
}

// --- channel reply pipeline ---

function createChannelReplyPipeline() {
  return { process: async () => undefined };
}

// --- dangerous name matching ---

function isDangerousNameMatchingEnabled() { return false; }

// --- runtime group policy ---

function resolveDefaultGroupPolicy() { return 'mention'; }
function resolveOpenProviderRuntimeGroupPolicy() { return 'mention'; }
function warnMissingProviderGroupPolicyFallbackOnce() {}

// --- zod schemas (stub) ---

const ToolPolicySchema = {};
const MarkdownConfigSchema = {};

// --- tmp dir ---

function resolvePreferredOpenClawTmpDir() {
  const os = require('node:os');
  const path = require('node:path');
  const { mkdirSync } = require('node:fs');
  const dir = path.join(os.tmpdir(), 'openclaw');
  mkdirSync(dir, { recursive: true });
  return dir;
}

// --- plugin config schema ---

function emptyPluginConfigSchema() {
  return { type: 'object', properties: {}, additionalProperties: false };
}

// --- allow-from (local) ---

function formatAllowFromLowercase(params) {
  return (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.stripPrefixRe ? e.replace(params.stripPrefixRe, '') : e)
    .map((e) => e.toLowerCase());
}

// --- command auth ---

async function resolveSenderCommandAuthorization(_params) {
  return {
    shouldComputeAuth: false,
    effectiveAllowFrom: [],
    effectiveGroupAllowFrom: [],
    senderAllowedForCommands: true,
    commandAuthorized: undefined,
  };
}

// --- config paths ---

function resolveChannelAccountConfigBasePath(_params) { return ''; }

// --- group access ---

function evaluateGroupRouteAccessForPolicy() { return { allowed: true }; }
function resolveSenderScopedGroupPolicy() { return 'mention'; }

// --- outbound media ---

async function loadOutboundMediaFromUrl(_url) { return null; }

// --- channel pairing ---

function createChannelPairingController() {
  return { approve: async () => {}, deny: async () => {} };
}

// --- channel send result ---

function buildChannelSendResult(params) {
  return { success: true, ...params };
}

// --- reply payload ---

async function deliverTextOrMediaReply() {}
function isNumericTargetId(id) { return /^\d+$/.test(String(id)); }
async function resolveOutboundMediaUrls() { return []; }
function resolveSendableOutboundReplyParts() { return []; }
async function sendMediaWithLeadingCaption() {}
async function sendPayloadWithChunkedTextAndMedia() {}

// --- resolution notes ---

function formatResolvedUnresolvedNote(params) {
  if (params.resolved.length === 0 && params.unresolved.length === 0) return undefined;
  return [
    params.resolved.length > 0 ? `Resolved: ${params.resolved.join(', ')}` : undefined,
    params.unresolved.length > 0 ? `Unresolved (kept as typed): ${params.unresolved.join(', ')}` : undefined,
  ].filter(Boolean).join('\n');
}

// --- status helpers ---

function buildBaseAccountStatusSnapshot() { return {}; }

// --- text chunking ---

function chunkTextForOutbound(text, _limit) {
  return text ? [text] : [];
}

// --- zalouser setup adapter/wizard ---

const zalouserSetupAdapter = null;
const zalouserSetupWizard = null;

module.exports = {
  mergeAllowlist,
  summarizeMapping,
  resolveMentionGatingWithBypass,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  setTopLevelChannelDmPolicyWithAllowFrom,
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
  patchScopedAccountConfig,
  createAccountListHelpers,
  createChannelReplyPipeline,
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  ToolPolicySchema,
  MarkdownConfigSchema,
  resolvePreferredOpenClawTmpDir,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  formatAllowFromLowercase,
  resolveSenderCommandAuthorization,
  resolveChannelAccountConfigBasePath,
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
  loadOutboundMediaFromUrl,
  createChannelPairingController,
  buildChannelSendResult,
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveOutboundMediaUrls,
  resolveSendableOutboundReplyParts,
  sendMediaWithLeadingCaption,
  sendPayloadWithChunkedTextAndMedia,
  formatResolvedUnresolvedNote,
  buildBaseAccountStatusSnapshot,
  chunkTextForOutbound,
  zalouserSetupAdapter,
  zalouserSetupWizard,
};
