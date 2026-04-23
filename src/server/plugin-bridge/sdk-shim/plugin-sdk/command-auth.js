// OpenClaw plugin-sdk/command-auth shim for MyAgents Plugin Bridge
// Provides command authorization resolution for channel plugins.
// MyAgents handles access control at the Rust layer, so these are permissive defaults.

/**
 * Resolve control command gate.
 * In real OpenClaw: checks access groups, authorizers, and gating modes.
 * Our shim: always allows — MyAgents Rust layer handles whitelist/permissions.
 */
export function resolveControlCommandGate(params) {
  return { commandAuthorized: true, shouldBlock: false };
}

/**
 * Resolve dual text control command gate (e.g., /command + text-command).
 */
export function resolveDualTextControlCommandGate(params) {
  return { commandAuthorized: true, shouldBlock: false };
}

/**
 * Resolve whether a command is authorized from a list of authorizers.
 */
export function resolveCommandAuthorizedFromAuthorizers(params) {
  return true;
}

/**
 * Resolve direct DM authorization outcome.
 * MyAgents always allows DMs (Rust layer handles filtering).
 */
export function resolveDirectDmAuthorizationOutcome(params) {
  return 'allowed';
}

/**
 * Resolve sender command authorization (full check with runtime).
 * Returns a permissive result — MyAgents access control is at Rust layer.
 */
export async function resolveSenderCommandAuthorizationWithRuntime(params) {
  const effectiveAllowFrom = params.configuredAllowFrom || [];
  const effectiveGroupAllowFrom = params.configuredGroupAllowFrom || [];
  return {
    shouldComputeAuth: false,
    effectiveAllowFrom,
    effectiveGroupAllowFrom,
    senderAllowedForCommands: true,
    commandAuthorized: true,
  };
}

/**
 * Resolve sender command authorization (without runtime injection).
 */
export async function resolveSenderCommandAuthorization(params) {
  const effectiveAllowFrom = params.configuredAllowFrom || [];
  const effectiveGroupAllowFrom = params.configuredGroupAllowFrom || [];
  return {
    shouldComputeAuth: false,
    effectiveAllowFrom,
    effectiveGroupAllowFrom,
    senderAllowedForCommands: true,
    commandAuthorized: true,
  };
}

/**
 * Check if raw message body contains a control command (e.g. /help, /status).
 */
export function shouldComputeCommandAuthorized(rawBody, cfg) {
  return false;
}

/**
 * Create a command authorization runtime bundle.
 */
export function createCommandAuthorizationRuntime() {
  return {
    shouldComputeCommandAuthorized: () => false,
    resolveCommandAuthorizedFromAuthorizers: () => true,
  };
}
