// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/security-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/security-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function buildUntrustedChannelMetadata() { _w('buildUntrustedChannelMetadata'); return undefined; }
async function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
async function resolveDmAllowState() { _w('resolveDmAllowState'); return undefined; }
function resolvePinnedMainDmOwnerFromAllowlist() { _w('resolvePinnedMainDmOwnerFromAllowlist'); return undefined; }
function resolveEffectiveAllowFromLists() { _w('resolveEffectiveAllowFromLists'); return undefined; }
function resolveDmGroupAccessDecision() { _w('resolveDmGroupAccessDecision'); return undefined; }
function resolveDmGroupAccessWithLists() { _w('resolveDmGroupAccessWithLists'); return undefined; }
function resolveDmGroupAccessWithCommandGate() { _w('resolveDmGroupAccessWithCommandGate'); return undefined; }
const DM_GROUP_ACCESS_REASON = undefined;
function detectSuspiciousPatterns() { _w('detectSuspiciousPatterns'); return undefined; }
function resolveHookExternalContentSource() { _w('resolveHookExternalContentSource'); return undefined; }
function mapHookExternalContentSource() { _w('mapHookExternalContentSource'); return undefined; }
function wrapExternalContent() { _w('wrapExternalContent'); return undefined; }
function buildSafeExternalPrompt() { _w('buildSafeExternalPrompt'); return undefined; }
function isExternalHookSession() { _w('isExternalHookSession'); return false; }
function getHookType() { _w('getHookType'); return undefined; }
function wrapWebContent() { _w('wrapWebContent'); return undefined; }
function testRegexWithBoundedInput() { _w('testRegexWithBoundedInput'); return undefined; }
function hasNestedRepetition() { _w('hasNestedRepetition'); return false; }
function compileSafeRegexDetailed() { _w('compileSafeRegexDetailed'); return undefined; }
function compileSafeRegex() { _w('compileSafeRegex'); return undefined; }

module.exports = {
  buildUntrustedChannelMetadata,
  readStoreAllowFromForDmPolicy,
  resolveDmAllowState,
  resolvePinnedMainDmOwnerFromAllowlist,
  resolveEffectiveAllowFromLists,
  resolveDmGroupAccessDecision,
  resolveDmGroupAccessWithLists,
  resolveDmGroupAccessWithCommandGate,
  DM_GROUP_ACCESS_REASON,
  detectSuspiciousPatterns,
  resolveHookExternalContentSource,
  mapHookExternalContentSource,
  wrapExternalContent,
  buildSafeExternalPrompt,
  isExternalHookSession,
  getHookType,
  wrapWebContent,
  testRegexWithBoundedInput,
  hasNestedRepetition,
  compileSafeRegexDetailed,
  compileSafeRegex,
};
