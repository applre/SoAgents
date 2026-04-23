// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/slack-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/slack-core.' + fn + '() not implemented in Bridge mode'); }
}

const buildChannelConfigSchema = undefined;
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function withNormalizedTimestamp() { _w('withNormalizedTimestamp'); return undefined; }
function createActionGate() { _w('createActionGate'); return undefined; }
function imageResultFromFile() { _w('imageResultFromFile'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const SlackConfigSchema = undefined;

module.exports = {
  buildChannelConfigSchema,
  getChatChannelMeta,
  withNormalizedTimestamp,
  createActionGate,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
  SlackConfigSchema,
};
