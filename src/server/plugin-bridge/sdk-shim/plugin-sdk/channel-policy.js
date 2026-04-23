/**
 * Shim for openclaw/plugin-sdk/channel-policy
 * Source: openclaw/src/plugin-sdk/channel-policy.ts
 *
 * Provides group policy warning collectors and DM security helpers.
 * In Bridge mode most policy enforcement is handled by Rust, so these
 * are permissive stubs.
 */

// --- group-policy-warnings stubs ---

function composeAccountWarningCollectors(...collectors) {
  return (params) => collectors.flatMap((c) => c(params));
}
function composeWarningCollectors(...collectors) {
  return (params) => collectors.flatMap((c) => c(params));
}
function createAllowlistProviderGroupPolicyWarningCollector(_opts) { return () => []; }
function createConditionalWarningCollector(_opts) { return () => []; }
function createAllowlistProviderOpenWarningCollector(_opts) { return () => []; }
function createAllowlistProviderRouteAllowlistWarningCollector(_opts) { return () => []; }
function createOpenGroupPolicyRestrictSendersWarningCollector(_opts) { return () => []; }
function createOpenProviderGroupPolicyWarningCollector(_opts) { return () => []; }
function createOpenProviderConfiguredRouteWarningCollector(_opts) { return () => []; }
function createAllowlistProviderRestrictSendersWarningCollector(_opts) { return () => []; }
function buildOpenGroupPolicyConfigureRouteAllowlistWarning() { return null; }
function buildOpenGroupPolicyRestrictSendersWarning() { return null; }
function buildOpenGroupPolicyWarning() { return null; }
function collectAllowlistProviderGroupPolicyWarnings() { return []; }
function collectAllowlistProviderRestrictSendersWarnings() { return []; }
function collectOpenGroupPolicyRestrictSendersWarnings() { return []; }
function collectOpenGroupPolicyRouteAllowlistWarnings() { return []; }
function collectOpenProviderGroupPolicyWarnings() { return []; }
function projectAccountConfigWarningCollector(fn) { return fn; }
function projectAccountWarningCollector(fn) { return fn; }
function projectConfigAccountIdWarningCollector(fn) { return fn; }
function projectConfigWarningCollector(fn) { return fn; }
function projectWarningCollector(fn) { return fn; }

// --- helpers stub ---
function buildAccountScopedDmSecurityPolicy() { return { allowed: true }; }

// --- group-policy stubs ---
function resolveChannelGroupRequireMention() { return false; }
function resolveChannelGroupToolsPolicy() { return { allow: undefined, deny: undefined }; }
function resolveToolsBySender() { return {}; }

// --- dm-policy-shared stubs ---
const DM_GROUP_ACCESS_REASON = { allowed: "allowed", denied: "denied" };
function readStoreAllowFromForDmPolicy() { return []; }
function resolveDmGroupAccessWithLists() { return { allowed: true, reason: "allowed" }; }
function resolveEffectiveAllowFromLists() { return { allowFrom: [], denyFrom: [] }; }

// --- createRestrictSendersChannelSecurity ---
function createRestrictSendersChannelSecurity(_params) {
  return {
    resolveDmPolicy: () => ({ allowed: true }),
    collectWarnings: () => [],
  };
}

module.exports = {
  composeAccountWarningCollectors,
  composeWarningCollectors,
  createAllowlistProviderGroupPolicyWarningCollector,
  createConditionalWarningCollector,
  createAllowlistProviderOpenWarningCollector,
  createAllowlistProviderRouteAllowlistWarningCollector,
  createOpenGroupPolicyRestrictSendersWarningCollector,
  createOpenProviderGroupPolicyWarningCollector,
  createOpenProviderConfiguredRouteWarningCollector,
  createAllowlistProviderRestrictSendersWarningCollector,
  buildOpenGroupPolicyConfigureRouteAllowlistWarning,
  buildOpenGroupPolicyRestrictSendersWarning,
  buildOpenGroupPolicyWarning,
  collectAllowlistProviderGroupPolicyWarnings,
  collectAllowlistProviderRestrictSendersWarnings,
  collectOpenGroupPolicyRestrictSendersWarnings,
  collectOpenGroupPolicyRouteAllowlistWarnings,
  collectOpenProviderGroupPolicyWarnings,
  projectAccountConfigWarningCollector,
  projectAccountWarningCollector,
  projectConfigAccountIdWarningCollector,
  projectConfigWarningCollector,
  projectWarningCollector,
  buildAccountScopedDmSecurityPolicy,
  resolveChannelGroupRequireMention,
  resolveChannelGroupToolsPolicy,
  resolveToolsBySender,
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
  createRestrictSendersChannelSecurity,
};
