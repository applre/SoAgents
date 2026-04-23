/**
 * Shim for openclaw/plugin-sdk/channel-status
 *
 * Provides the subset of exports that OpenClaw channel plugins actually use.
 * The lark plugin (and potentially others) imports PAIRING_APPROVED_MESSAGE
 * and status helper functions from this module.
 *
 * Source of truth: openclaw/src/plugin-sdk/channel-status.ts
 */

// Re-exported from channels/plugins/pairing-message.ts
const PAIRING_APPROVED_MESSAGE =
  "\u2705 OpenClaw access approved. Send a message to start chatting.";

// Re-exported from channels/account-snapshot-fields.ts (stub — rarely used by plugins)
function projectCredentialSnapshotFields(snapshot, fields) {
  if (!snapshot || !fields) return {};
  const result = {};
  for (const f of fields) {
    if (f in snapshot) result[f] = snapshot[f];
  }
  return result;
}

function resolveConfiguredFromCredentialStatuses(statuses) {
  if (!statuses || !Array.isArray(statuses)) return false;
  return statuses.length > 0 && statuses.every((s) => s === true || s === "valid");
}

function resolveConfiguredFromRequiredCredentialStatuses(statuses) {
  return resolveConfiguredFromCredentialStatuses(statuses);
}

// Re-exported from status-helpers.ts
function createDefaultChannelRuntimeState(accountId, extra) {
  return {
    accountId,
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
    ...(extra ?? {}),
  };
}

function buildBaseChannelStatusSummary(snapshot, extra) {
  return {
    configured: snapshot.configured ?? false,
    ...(extra ?? {}),
    running: snapshot.running ?? false,
    lastStartAt: snapshot.lastStartAt ?? null,
    lastStopAt: snapshot.lastStopAt ?? null,
    lastError: snapshot.lastError ?? null,
  };
}

function buildRuntimeAccountStatusSnapshot(params, extra) {
  const { runtime, probe } = params;
  return {
    running: runtime?.running ?? false,
    lastStartAt: runtime?.lastStartAt ?? null,
    lastStopAt: runtime?.lastStopAt ?? null,
    lastError: runtime?.lastError ?? null,
    probe,
    ...(extra ?? {}),
  };
}

function buildComputedAccountStatusSnapshot(params, extra) {
  const { accountId, name, enabled, configured, runtime, probe } = params;
  return {
    accountId,
    name,
    enabled,
    configured,
    ...buildRuntimeAccountStatusSnapshot({ runtime, probe }),
    lastInboundAt: runtime?.lastInboundAt ?? null,
    lastOutboundAt: runtime?.lastOutboundAt ?? null,
    ...(extra ?? {}),
  };
}

function buildTokenChannelStatusSummary(snapshot, opts) {
  const base = {
    ...buildBaseChannelStatusSummary(snapshot),
    tokenSource: snapshot.tokenSource ?? "none",
    probe: snapshot.probe,
    lastProbeAt: snapshot.lastProbeAt ?? null,
  };
  if (opts?.includeMode === false) return base;
  return { ...base, mode: snapshot.mode ?? null };
}

function collectStatusIssuesFromLastError(channel, accounts) {
  return accounts.flatMap((account) => {
    const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
    if (!lastError) return [];
    return [{ channel, accountId: account.accountId, kind: "runtime", message: `Channel error: ${lastError}` }];
  });
}

// Exports aligned with openclaw/src/plugin-sdk/channel-status.ts re-exports.
// Functions like createDefaultChannelRuntimeState, buildBaseChannelStatusSummary,
// collectStatusIssuesFromLastError live in status-helpers, not channel-status.
module.exports = {
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
  resolveConfiguredFromRequiredCredentialStatuses,
  buildComputedAccountStatusSnapshot,
  buildTokenChannelStatusSummary,
};
