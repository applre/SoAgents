// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-actions.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-actions.' + fn + '() not implemented in Bridge mode'); }
}

function createMessageToolButtonsSchema() { _w('createMessageToolButtonsSchema'); return undefined; }
function createMessageToolCardSchema() { _w('createMessageToolCardSchema'); return undefined; }
function createUnionActionGate() { _w('createUnionActionGate'); return undefined; }
function listTokenSourcedAccounts() { _w('listTokenSourcedAccounts'); return []; }
function resolveReactionMessageId() { _w('resolveReactionMessageId'); return undefined; }
function optionalStringEnum() { _w('optionalStringEnum'); return undefined; }
function stringEnum() { _w('stringEnum'); return undefined; }

module.exports = {
  createMessageToolButtonsSchema,
  createMessageToolCardSchema,
  createUnionActionGate,
  listTokenSourcedAccounts,
  resolveReactionMessageId,
  optionalStringEnum,
  stringEnum,
};
