// OpenClaw plugin-sdk/account-id shim for MyAgents Plugin Bridge

export const DEFAULT_ACCOUNT_ID = 'default';

export function normalizeAccountId(id) {
  if (!id || id === 'default') return DEFAULT_ACCOUNT_ID;
  return String(id).trim().toLowerCase();
}

export function normalizeOptionalAccountId(id) {
  if (id === undefined || id === null) return undefined;
  return normalizeAccountId(id);
}
