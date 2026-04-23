/**
 * Shim for openclaw/plugin-sdk/tool-send
 * Source: openclaw/src/plugin-sdk/tool-send.ts
 */

function extractToolSend(args, expectedAction = "sendMessage") {
  const action = typeof args.action === "string" ? args.action.trim() : "";
  if (action !== expectedAction) return null;
  const to = typeof args.to === "string" ? args.to : undefined;
  if (!to) return null;
  const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
  const threadIdRaw =
    typeof args.threadId === "string"
      ? args.threadId.trim()
      : typeof args.threadId === "number"
        ? String(args.threadId)
        : "";
  const threadId = threadIdRaw.length > 0 ? threadIdRaw : undefined;
  return { to, accountId, threadId };
}

module.exports = { extractToolSend };
