// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/json-store.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/json-store.' + fn + '() not implemented in Bridge mode'); }
}

async function readJsonFileWithFallback() { _w('readJsonFileWithFallback'); return undefined; }
async function writeJsonFileAtomically() { _w('writeJsonFileAtomically'); return undefined; }
function loadJsonFile() { _w('loadJsonFile'); return undefined; }
function saveJsonFile() { _w('saveJsonFile'); return undefined; }

module.exports = {
  readJsonFileWithFallback,
  writeJsonFileAtomically,
  loadJsonFile,
  saveJsonFile,
};
