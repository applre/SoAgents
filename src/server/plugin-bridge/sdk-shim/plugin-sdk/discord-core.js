// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/discord-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/discord-core.' + fn + '() not implemented in Bridge mode'); }
}

const buildChannelConfigSchema = undefined;
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function withNormalizedTimestamp() { _w('withNormalizedTimestamp'); return undefined; }
function assertMediaNotDataUrl() { _w('assertMediaNotDataUrl'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function parseAvailableTags() { _w('parseAvailableTags'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringArrayParam() { _w('readStringArrayParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const DiscordConfigSchema = undefined;
function resolvePollMaxSelections() { _w('resolvePollMaxSelections'); return undefined; }

module.exports = {
  buildChannelConfigSchema,
  getChatChannelMeta,
  withNormalizedTimestamp,
  assertMediaNotDataUrl,
  jsonResult,
  parseAvailableTags,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  DiscordConfigSchema,
  resolvePollMaxSelections,
};
