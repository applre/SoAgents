// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/twitch.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/twitch.' + fn + '() not implemented in Bridge mode'); }
}

const twitchSetupAdapter = undefined;
const twitchSetupWizard = undefined;
const buildChannelConfigSchema = undefined;
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
const MarkdownConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
const emptyPluginConfigSchema = undefined;
function formatDocsLink() { _w('formatDocsLink'); return ""; }

module.exports = {
  twitchSetupAdapter,
  twitchSetupWizard,
  buildChannelConfigSchema,
  createChannelReplyPipeline,
  MarkdownConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  emptyPluginConfigSchema,
  formatDocsLink,
};
