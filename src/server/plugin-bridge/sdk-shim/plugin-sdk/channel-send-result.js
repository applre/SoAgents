/**
 * Shim for openclaw/plugin-sdk/channel-send-result
 * Source: openclaw/src/plugin-sdk/channel-send-result.ts
 *
 * Provides outbound message result helpers for channel plugins.
 */

function attachChannelToResult(channel, result) {
  return { channel, ...result };
}

function attachChannelToResults(channel, results) {
  return results.map((result) => attachChannelToResult(channel, result));
}

function createEmptyChannelResult(channel, result = {}) {
  return attachChannelToResult(channel, { messageId: "", ...result });
}

function buildChannelSendResult(channel, result) {
  return {
    channel,
    ok: result.ok,
    messageId: result.messageId ?? "",
    error: result.error ? new Error(result.error) : undefined,
  };
}

function createAttachedChannelResultAdapter(params) {
  return {
    sendText: params.sendText
      ? async (ctx) => attachChannelToResult(params.channel, await params.sendText(ctx))
      : undefined,
    sendMedia: params.sendMedia
      ? async (ctx) => attachChannelToResult(params.channel, await params.sendMedia(ctx))
      : undefined,
    sendPoll: params.sendPoll
      ? async (ctx) => attachChannelToResult(params.channel, await params.sendPoll(ctx))
      : undefined,
  };
}

function createRawChannelSendResultAdapter(params) {
  return {
    sendText: params.sendText
      ? async (ctx) => buildChannelSendResult(params.channel, await params.sendText(ctx))
      : undefined,
    sendMedia: params.sendMedia
      ? async (ctx) => buildChannelSendResult(params.channel, await params.sendMedia(ctx))
      : undefined,
  };
}

module.exports = {
  attachChannelToResult,
  attachChannelToResults,
  createEmptyChannelResult,
  buildChannelSendResult,
  createAttachedChannelResultAdapter,
  createRawChannelSendResultAdapter,
};
