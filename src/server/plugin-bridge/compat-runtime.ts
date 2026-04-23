/**
 * OpenClaw Channel Runtime Compatibility Shim
 *
 * Mocks the `pluginRuntime.channel` APIs that channel plugins use.
 * The key interception point is `reply.dispatchReplyWithBufferedBlockDispatcher`:
 * instead of calling the plugin's deliver callback, we POST the inbound message
 * to Rust's management API for AI processing.
 *
 * This shim covers the FULL PluginRuntime.channel surface so that any OpenClaw
 * channel plugin can load without TypeError crashes, not just QQ Bot.
 */

import { tmpdir } from 'os';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { registerPendingDispatch, type PendingDispatchCallbacks } from './pending-dispatch';

// ===== Media extraction utilities =====

/** MIME types treated as images for Claude Vision API (base64 content blocks). */
const IMAGE_MIME_PREFIXES = ['image/'];

/** Maximum file size for bridge media transfer (20 MB raw → ~27 MB base64). */
const MAX_MEDIA_FILE_SIZE = 20 * 1024 * 1024;

/** Fallback MIME type detection by file extension (when plugin provides no MIME). */
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.heic': 'image/heic',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.silk': 'audio/silk',
};

type BridgeAttachment = {
  fileName: string;
  mimeType: string;
  data: string; // base64
  attachmentType: 'image' | 'file';
};

/**
 * Extract media from OpenClaw inbound context and convert to bridge attachments.
 *
 * OpenClaw plugins set:
 *   - Single media: ctx.MediaPath + ctx.MediaType
 *   - Multi media:  ctx.MediaPaths[] + ctx.MediaTypes[]
 *
 * We read each file from disk, base64 encode, and classify:
 *   - image/* → "image" (Rust will base64-encode for Claude Vision API)
 *   - everything else → "file" (Rust will save to workspace + @path reference)
 */
async function extractMediaAttachments(ctx: Record<string, unknown>): Promise<BridgeAttachment[]> {
  const paths: string[] = [];
  const types: string[] = [];

  /** Resolve MIME type: use provided type, fall back to extension, then octet-stream.
   *  Wildcard types like "image/*" are treated as unresolved — need extension inference.
   *  If still wildcard after extension lookup, default to concrete type (e.g. image/jpeg). */
  const WILDCARD_DEFAULTS: Record<string, string> = {
    'image/*': 'image/jpeg', 'video/*': 'video/mp4', 'audio/*': 'audio/wav',
  };
  const resolveMime = (mime: string | undefined, filePath: string): string => {
    if (mime && !mime.endsWith('/*') && mime !== 'application/octet-stream') return mime;
    const ext = extname(filePath).toLowerCase();
    const fromExt = EXT_TO_MIME[ext];
    if (fromExt) return fromExt;
    // Wildcard MIME with no extension → default to concrete type
    if (mime && mime.endsWith('/*')) return WILDCARD_DEFAULTS[mime] || 'application/octet-stream';
    return mime || 'application/octet-stream';
  };

  // Collect single media
  if (ctx.MediaPath && typeof ctx.MediaPath === 'string') {
    paths.push(ctx.MediaPath);
    types.push(resolveMime(ctx.MediaType as string | undefined, ctx.MediaPath));
  }

  // Collect multi media (OpenClaw convention: MediaPaths[] aligned with MediaTypes[])
  if (Array.isArray(ctx.MediaPaths)) {
    const mediaPaths = ctx.MediaPaths as string[];
    const mediaTypes = (Array.isArray(ctx.MediaTypes) ? ctx.MediaTypes : []) as string[];
    for (let i = 0; i < mediaPaths.length; i++) {
      if (typeof mediaPaths[i] === 'string' && mediaPaths[i]) {
        // Avoid duplicates if single MediaPath is also in MediaPaths
        if (!paths.includes(mediaPaths[i])) {
          paths.push(mediaPaths[i]);
          types.push(resolveMime(mediaTypes[i], mediaPaths[i]));
        }
      }
    }
  }

  if (paths.length === 0) return [];

  const attachments: BridgeAttachment[] = [];
  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i];
    const mimeType = types[i] || 'application/octet-stream';
    try {
      // Normalize file:// URLs to filesystem paths (OpenClaw convention)
      let resolvedPath = filePath;
      if (filePath.startsWith('file://')) {
        try { resolvedPath = fileURLToPath(filePath); } catch { continue; }
      }
      const buf = await readFile(resolvedPath);
      if (buf.length > MAX_MEDIA_FILE_SIZE) {
        console.warn(`[compat-media] File too large, skipping: ${filePath} (${buf.length} bytes, max ${MAX_MEDIA_FILE_SIZE})`);
        continue;
      }
      const data = buf.toString('base64');
      const isImage = IMAGE_MIME_PREFIXES.some(p => mimeType.startsWith(p));
      const fileName = basename(filePath) || `media-${Date.now()}${extname(filePath) || ''}`;
      attachments.push({
        fileName,
        mimeType,
        data,
        attachmentType: isImage ? 'image' : 'file',
      });
      console.log(`[compat-media] Read ${isImage ? 'image' : 'file'}: ${filePath} (${mimeType}, ${buf.length} bytes)`);
    } catch (err) {
      console.error(`[compat-media] Failed to read media file: ${filePath}`, err);
    }
  }
  return attachments;
}

// ===== Text chunking utilities =====
// Simple implementations matching OpenClaw's text.* API surface.

function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) { chunks.push(remaining); break; }
    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt <= 0 || splitAt < limit * 0.5) splitAt = remaining.lastIndexOf(' ', limit);
    if (splitAt <= 0 || splitAt < limit * 0.5) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

function chunkByNewline(text: string, limit: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > limit && current) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Create a compat channel runtime that routes inbound messages to Rust.
 */
export function createCompatRuntime(rustPort: number, botId: string, pluginId: string) {
  const rustBaseUrl = `http://127.0.0.1:${rustPort}`;

  // Mutable — updated after plugin registration when actual ID is known
  let currentPluginId = pluginId;

  // Parse the plugin config once (passed via env var by Bridge spawner)
  const bridgePluginConfig = JSON.parse(process.env.BRIDGE_PLUGIN_CONFIG || '{}');

  // Shim compat version — must match the version in sdk-shim/package.json.
  // Plugins check api.runtime.version (e.g. weixin's assertHostCompatibility)
  // to verify the host supports the required SDK surface.
  const SHIM_COMPAT_VERSION = '2026.4.9';

  const runtime = {
    /** Update the plugin ID after registration */
    setPluginId(id: string) { currentPluginId = id; },

    /** OpenClaw host version — checked by plugins via assertHostCompatibility(). */
    version: SHIM_COMPAT_VERSION,

    // ===== RuntimeEnv top-level interface =====
    // OpenClaw RuntimeEnv requires { log, error, exit } at the top level.
    // dispatch-context.js does `const log = runtime.log;` — if missing, dc.log
    // is undefined and every dispatch crashes with "dc.log is not a function".
    log: (...args: unknown[]) => console.log('[plugin]', ...args),
    error: (...args: unknown[]) => console.error('[plugin]', ...args),
    exit: (code: number) => { console.error('[plugin] exit requested with code', code); },

    // ===== Config =====
    // LarkClient.runtime.config.loadConfig() is called during message handling
    config: {
      loadConfig() {
        console.log('[compat-timing] config.loadConfig() called');

        // Return an OpenClaw-format config with the plugin's channel settings
        // Use currentPluginId as channel key (not hardcoded 'feishu') so any plugin
        // can resolve its own config via cfg.channels[pluginId]
        // Force dmPolicy/groupPolicy=open — MyAgents handles access control at Rust layer
        return {
          channels: {
            [currentPluginId]: {
              enabled: true,
              ...bridgePluginConfig,
              dmPolicy: 'open',
              groupPolicy: 'open',
            },
          },
        };
      },
      async writeConfigFile(_cfg: unknown) {
        // No-op — Bridge doesn't write config files
      },
    },

    // ===== Logging =====
    // LarkClient.runtime.logging.getChildLogger() is called for plugin logging
    logging: {
      getChildLogger(opts: Record<string, unknown>) {
        const prefix = opts?.name ? `[${opts.name}]` : '[plugin]';
        return {
          info: (...args: unknown[]) => console.log(prefix, ...args),
          warn: (...args: unknown[]) => console.warn(prefix, ...args),
          error: (...args: unknown[]) => console.error(prefix, ...args),
          debug: (...args: unknown[]) => console.debug(prefix, ...args),
        };
      },
    },

    // ===== System events =====
    // Plugins call core.system.enqueueSystemEvent() during message dispatch
    system: {
      enqueueSystemEvent(_event: unknown) {},
      getSystemEvents() { return []; },
    },

    channel: {
      // ===== Activity tracking =====
      // No-op — MyAgents doesn't need OpenClaw activity tracking.
      activity: {
        record(_event: Record<string, unknown>) {},
        get(_params: Record<string, unknown>) { return []; },
      },

      // ===== Routing =====
      routing: {
        resolveAgentRoute(_ctx: Record<string, unknown>) {
          return { agentId: 'default', route: 'default' };
        },
      },

      // ===== Reply / dispatch =====
      reply: {
        resolveEnvelopeFormatOptions(_ctx: Record<string, unknown>) {
          return {};
        },

        formatInboundEnvelope(ctx: Record<string, unknown>) {
          return String(ctx.Body || ctx.body || '');
        },

        formatAgentEnvelope(ctx: Record<string, unknown>) {
          return String(ctx.BodyForAgent || ctx.Body || ctx.body || '');
        },

        finalizeInboundContext(ctx: Record<string, unknown>) {
          const hasMedia = Boolean(ctx.MediaPath || (Array.isArray(ctx.MediaPaths) && (ctx.MediaPaths as string[]).length > 0));
          console.log(`[compat-timing] finalizeInboundContext called, Body len=${String(ctx.Body || '').length}, hasMedia=${hasMedia}${hasMedia ? `, MediaType=${ctx.MediaType || 'unknown'}` : ''}`);
          return ctx;
        },

        resolveEffectiveMessagesConfig(_ctx: Record<string, unknown>) {
          return {};
        },

        resolveHumanDelayConfig(_ctx: Record<string, unknown>) {
          return { enabled: false, minMs: 0, maxMs: 0 };
        },

        createReplyDispatcherWithTyping(_params: Record<string, unknown>) {
          return {
            dispatcher: { _isStub: true, sendFinalReply: async () => {}, markComplete: () => {}, waitForIdle: async () => {}, sendBlockReply: async () => {} },
            replyOptions: {},
            markDispatchIdle: () => {},
          };
        },

        /**
         * OpenClaw protocol: dispatchReplyFromConfig receives dispatcher + replyOptions
         * from the plugin. If the plugin provides protocol callbacks (onPartialReply,
         * sendFinalReply, etc.), we register a pending dispatch and BLOCK until AI
         * completes. The Bridge HTTP endpoints will route streaming events through
         * these callbacks, letting the plugin handle its own rendering (e.g., Feishu
         * StreamingCardController, QQ Bot's delivery, etc.).
         *
         * If no protocol callbacks are provided, falls back to the old bypass path.
         */
        async dispatchReplyFromConfig(params: Record<string, unknown>) {
          const t0 = Date.now();
          console.log(`[compat-timing] dispatchReplyFromConfig ENTER`);
          const ctx = (params.ctx || params) as Record<string, unknown>;

          // Check if plugin provides standard OpenClaw protocol callbacks
          const dispatcher = params.dispatcher as Record<string, (...args: unknown[]) => unknown> | undefined;
          const replyOptions = params.replyOptions as Record<string, (...args: unknown[]) => unknown> | undefined;
          const hasProtocolCallbacks = dispatcher
            && typeof dispatcher.sendFinalReply === 'function'
            && typeof dispatcher.markComplete === 'function'
            && !(dispatcher as Record<string, unknown>)._isStub;

          if (!hasProtocolCallbacks) {
            // Fallback: no protocol callbacks, use old bypass path
            const result = await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({ ctx, cfg: params.cfg as Record<string, unknown> });
            console.log(`[compat-timing] dispatchReplyFromConfig EXIT (fallback) (+${Date.now() - t0}ms)`);
            return result;
          }

          // --- Protocol-standard path ---

          // Extract chatId: ctx.To is the reply destination in OpenClaw protocol.
          let chatId = String(ctx.To || ctx.to || ctx.From || ctx.from || '');
          if (chatId.includes(':')) chatId = chatId.split(':').slice(1).join(':');

          if (!chatId) {
            console.warn('[compat-runtime] dispatchReplyFromConfig: no chatId, falling back');
            const result = await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({ ctx, cfg: params.cfg as Record<string, unknown> });
            return result;
          }

          // Extract fields BEFORE registering pending dispatch (to avoid leak on empty content)
          const text = String(ctx.BodyForAgent || ctx.Body || ctx.body || ctx.RawBody || '');
          const mediaAttachments = await extractMediaAttachments(ctx);
          if (!text.trim() && mediaAttachments.length === 0) {
            console.log('[compat-runtime] Empty message (no text, no media) in protocol path, skipping');
            return { queuedFinal: 0, counts: {}, dispatcher: { waitForIdle: async () => {} } };
          }

          const senderId = String(ctx.SenderId || ctx.senderId || '');
          const senderName = String(ctx.SenderName || ctx.senderName || '');
          const chatType = String(ctx.ChatType || ctx.chatType || 'direct');
          const messageId = String(ctx.MessageSid || ctx.messageSid || ctx.MessageId || '');
          const groupId = String(ctx.QQGroupOpenid || ctx.GroupId || ctx.groupId || '');
          const isMention = ctx.IsMention ?? ctx.WasMentioned ?? ctx.isMention ?? (chatType !== 'group');
          const groupName = String(ctx.GroupSubject || ctx.GroupName || ctx.groupName || '') || undefined;
          const threadId = String(ctx.MessageThreadId || ctx.threadId || '') || undefined;
          const replyToBody = String(ctx.ReplyToBody || ctx.replyToBody || '') || undefined;
          const groupSystemPrompt = String(ctx.GroupSystemPrompt || ctx.groupSystemPrompt || '') || undefined;

          // Build protocol callbacks from the plugin's dispatcher and replyOptions
          const callbacks: PendingDispatchCallbacks = {
            onPartialReply: typeof replyOptions?.onPartialReply === 'function'
              ? replyOptions.onPartialReply.bind(replyOptions) as PendingDispatchCallbacks['onPartialReply']
              : undefined,
            onReasoningStream: typeof replyOptions?.onReasoningStream === 'function'
              ? replyOptions.onReasoningStream.bind(replyOptions) as PendingDispatchCallbacks['onReasoningStream']
              : undefined,
            sendBlockReply: typeof dispatcher.sendBlockReply === 'function'
              ? dispatcher.sendBlockReply.bind(dispatcher) as PendingDispatchCallbacks['sendBlockReply']
              : undefined,
            sendFinalReply: dispatcher.sendFinalReply.bind(dispatcher) as PendingDispatchCallbacks['sendFinalReply'],
          };

          console.log(`[compat-timing] dispatchReplyFromConfig PROTOCOL path: chatId=${chatId} len=${text.length} attachments=${mediaAttachments.length}`);

          // POST the inbound message to Rust BEFORE registering pending dispatch,
          // so that if the POST fails we don't leave an orphaned pending dispatch
          try {
            const resp = await fetch(`${rustBaseUrl}/api/im-bridge/message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                botId,
                pluginId: currentPluginId,
                senderId,
                senderName: senderName || undefined,
                text,
                chatType: chatType === 'group' ? 'group' : 'direct',
                chatId,
                messageId: messageId || undefined,
                groupId: groupId || undefined,
                isMention,
                groupName: groupName || undefined,
                threadId: threadId || undefined,
                replyToBody: replyToBody || undefined,
                groupSystemPrompt: groupSystemPrompt || undefined,
                attachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
              }),
            });
            if (!resp.ok) {
              const body = await resp.text();
              throw new Error(`Rust returned ${resp.status}: ${body}`);
            }
          } catch (err) {
            console.error(`[compat-timing] Rust POST FAILED in protocol path (+${Date.now() - t0}ms):`, err);
            throw err;
          }

          // Register pending dispatch AFTER successful POST (no leak on failure)
          const completionPromise = registerPendingDispatch(chatId, callbacks);

          // Block until AI response completes (resolved by /finalize-stream or /abort-stream)
          try {
            const result = await completionPromise;
            console.log(`[compat-timing] dispatchReplyFromConfig EXIT (protocol) (+${Date.now() - t0}ms)`);
            return result;
          } catch (err) {
            console.error(`[compat-timing] dispatchReplyFromConfig PROTOCOL error (+${Date.now() - t0}ms):`, err);
            throw err;
          }
        },

        /**
         * OpenClaw protocol lifecycle wrapper. Ensures proper cleanup:
         * 1. Calls run() (which triggers dispatchReplyFromConfig → AI processing)
         * 2. In finally: dispatcher.markComplete() → waitForIdle() → onSettled()
         *
         * This matches the real OpenClaw withReplyDispatcher implementation.
         */
        async withReplyDispatcher(params: Record<string, unknown>) {
          const t0 = Date.now();
          console.log(`[compat-timing] withReplyDispatcher ENTER`);
          const dispatcher = params.dispatcher as { markComplete?: () => void; waitForIdle?: () => Promise<void> } | undefined;
          const run = params.run as (() => Promise<unknown>) | undefined;
          const onSettled = params.onSettled as (() => void | Promise<void>) | undefined;

          let result: unknown;
          try {
            if (typeof run === 'function') {
              result = await run();
              console.log(`[compat-timing] withReplyDispatcher run() OK (+${Date.now() - t0}ms)`);
            }
          } finally {
            // Protocol lifecycle: signal completion, wait for delivery queue drain, cleanup
            try {
              dispatcher?.markComplete?.();
              await dispatcher?.waitForIdle?.();
            } catch (err) {
              console.error(`[compat-timing] withReplyDispatcher lifecycle error:`, err);
            } finally {
              try { await onSettled?.(); } catch { /* best-effort */ }
            }
          }
          return result ?? { queuedFinal: 0, counts: {}, dispatcher: { waitForIdle: async () => {} } };
        },

        /**
         * Core interception point: instead of calling `deliver()`, we POST
         * the user's message to Rust's management API.
         */
        async dispatchReplyWithBufferedBlockDispatcher(params: {
          ctx: Record<string, unknown>;
          cfg?: Record<string, unknown>;
          dispatcherOptions?: Record<string, unknown>;
        }) {
          const { ctx } = params;

          const text = String(ctx.BodyForAgent || ctx.Body || ctx.body || ctx.RawBody || '');
          const senderId = String(ctx.SenderId || ctx.senderId || '');
          const senderName = String(ctx.SenderName || ctx.senderName || '');
          const chatType = String(ctx.ChatType || ctx.chatType || 'direct');
          // Chat ID extraction: ctx.To is the REPLY DESTINATION in OpenClaw protocol.
          // ctx.From is the SENDER identity — wrong for group routing.
          // Feishu plugin: To = "chat:oc_xxx" (group) or "user:ou_xxx" (private),
          // From = "feishu:ou_xxx" (always sender). Using From for groups sends replies to private chat.
          let chatId = String(ctx.To || ctx.to || ctx.From || ctx.from || '');
          if (chatId.includes(':')) chatId = chatId.split(':').slice(1).join(':');
          const messageId = String(ctx.MessageSid || ctx.messageSid || ctx.MessageId || '');
          const groupId = String(ctx.QQGroupOpenid || ctx.GroupId || ctx.groupId || '');
          // Default isMention by chatType: private=true (always directed at bot),
          // group=false (conservative — only if plugin explicitly flags it as mention).
          // OpenClaw Feishu plugin sets WasMentioned via mentionedBot(ctx.mentions).
          const isMention = ctx.IsMention ?? ctx.WasMentioned ?? ctx.isMention ?? (chatType !== 'group');

          // Group metadata from OpenClaw plugin dispatch context
          const groupName = String(ctx.GroupSubject || ctx.GroupName || ctx.groupName || '') || undefined;
          const threadId = String(ctx.MessageThreadId || ctx.threadId || '') || undefined;

          // Quoted reply content (for threaded replies)
          const replyToBody = String(ctx.ReplyToBody || ctx.replyToBody || '') || undefined;
          // Group system prompt (plugin-level custom instruction for group chats)
          const groupSystemPrompt = String(ctx.GroupSystemPrompt || ctx.groupSystemPrompt || '') || undefined;

          // Extract media from OpenClaw context (images, files, voice, video)
          const mediaAttachments = await extractMediaAttachments(ctx);

          if (!text.trim() && mediaAttachments.length === 0) {
            console.log('[compat-runtime] Empty message (no text, no media), skipping');
            return { queuedFinal: 0, counts: {}, dispatcher: { waitForIdle: async () => {} } };
          }

          const t0 = Date.now();
          console.log(`[compat-timing] dispatchReplyWithBufferedBlockDispatcher ENTER: sender=${senderId} chat=${chatId} len=${text.length} attachments=${mediaAttachments.length}`);

          try {
            const resp = await fetch(`${rustBaseUrl}/api/im-bridge/message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                botId,
                pluginId: currentPluginId,
                senderId,
                senderName: senderName || undefined,
                text,
                chatType: chatType === 'group' ? 'group' : 'direct',
                chatId,
                messageId: messageId || undefined,
                groupId: groupId || undefined,
                isMention,
                groupName: groupName || undefined,
                threadId: threadId || undefined,
                replyToBody: replyToBody || undefined,
                groupSystemPrompt: groupSystemPrompt || undefined,
                attachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
              }),
            });

            console.log(`[compat-timing] Rust POST completed (+${Date.now() - t0}ms) status=${resp.status}`);
            if (!resp.ok) {
              const body = await resp.text();
              console.error(`[compat-runtime] Rust returned ${resp.status}: ${body}`);
            }
          } catch (err) {
            console.error(`[compat-timing] Rust POST FAILED (+${Date.now() - t0}ms):`, err);
          }

          // Do NOT call the deliver callback — AI reply comes back via /send-text
          return { queuedFinal: 0, counts: {}, dispatcher: { waitForIdle: async () => {} } };
        },
      },

      // ===== Text utilities =====
      text: {
        chunkText,
        chunkByNewline,
        chunkMarkdownText: chunkText,
        chunkMarkdownTextWithMode: (text: string, limit: number) => chunkText(text, limit),
        chunkTextWithMode: (text: string, limit: number) => chunkText(text, limit),
        resolveChunkMode: () => 'markdown' as const,
        resolveTextChunkLimit: () => 2000,
        hasControlCommand: () => false,
        resolveMarkdownTableMode: () => 'preserve' as const,
        convertMarkdownTables: (text: string) => text,
      },

      // ===== Session management =====
      // No-op — Rust layer manages sessions via PeerLock + SessionRouter.
      session: {
        resolveStorePath: () => tmpdir(),
        readSessionUpdatedAt: () => null,
        recordSessionMetaFromInbound: () => {},
        recordInboundSession: () => {},
        updateLastRoute: () => {},
      },

      // ===== Media handling =====
      media: {
        async fetchRemoteMedia(url: string) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const buf = Buffer.from(await resp.arrayBuffer());
            return { buffer: buf, contentType: resp.headers.get('content-type') || 'application/octet-stream' };
          } catch {
            return null;
          }
        },
        /**
         * Save a media buffer to a temp file.
         * OpenClaw signature: saveMediaBuffer(buffer, contentType, subdir, maxBytes, originalFilename)
         * - contentType: MIME type string (e.g. "image/jpeg")
         * - subdir: subdirectory name (e.g. "images")
         * - maxBytes: size limit (ignored in Bridge mode)
         * - originalFilename: original filename for extension inference
         */
        async saveMediaBuffer(
          buffer: Buffer | Uint8Array,
          contentType?: string,
          subdir?: string,
          _maxBytes?: number,
          originalFilename?: string,
        ) {
          // Sanitize subdir to prevent path traversal (strip '..', '/', '\')
          const safeSubdir = (subdir || '').replace(/\.\./g, '').replace(/[/\\]/g, '');
          const dir = join(tmpdir(), 'soagents-media', safeSubdir);
          await mkdir(dir, { recursive: true });
          // Infer extension from originalFilename, then contentType
          let ext = '';
          if (originalFilename) {
            const dotIdx = originalFilename.lastIndexOf('.');
            // Sanitize: only allow alphanumeric + dot in extension (prevent path traversal)
            if (dotIdx >= 0) ext = originalFilename.slice(dotIdx).replace(/[^a-zA-Z0-9.]/g, '');
          }
          if (!ext && contentType) {
            const mimeToExt: Record<string, string> = {
              'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
              'image/webp': '.webp', 'video/mp4': '.mp4', 'audio/wav': '.wav',
              'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/silk': '.silk',
              'application/pdf': '.pdf',
            };
            ext = mimeToExt[contentType] || '';
          }
          const filename = `media-${Date.now()}${ext}`;
          const filepath = join(dir, filename);
          await writeFile(filepath, buffer);
          // OpenClaw SaveMediaFn returns { path: string }, NOT a bare string
          return { path: filepath };
        },
      },

      // ===== Pairing (device binding) =====
      // No-op — MyAgents uses its own allowedUsers mechanism via BIND codes.
      pairing: {
        buildPairingReply: () => { console.log('[compat-timing] pairing.buildPairingReply called'); return ''; },
        readAllowFromStore: async () => [],
        upsertPairingRequest: async () => ({}),
      },

      // ===== Mention handling =====
      mentions: {
        buildMentionRegexes: () => [],
        matchesMentionPatterns: () => false,
        matchesMentionWithExplicit: () => ({ matched: false }),
      },

      // ===== Reactions =====
      reactions: {
        shouldAckReaction: () => false,
        removeAckReactionAfterReply: () => {},
      },

      // ===== Group policies =====
      // MyAgents handles access control at Rust layer (group approval UI).
      // Return allowed=true here so plugin-level gating doesn't block groups
      // before they reach the Rust layer for registration/approval.
      groups: {
        resolveGroupPolicy: () => ({ allowed: true, allowlistEnabled: false }),
        resolveRequireMention: () => false,
      },

      // ===== Inbound debounce =====
      debounce: {
        createInboundDebouncer: () => ({
          debounce: (fn: () => unknown) => fn(),
          cancel: () => {},
        }),
        resolveInboundDebounceMs: () => 0,
      },

      // ===== Commands =====
      commands: {
        resolveCommandAuthorizedFromAuthorizers: () => true,
        isControlCommandMessage: () => false,
        shouldComputeCommandAuthorized: () => false,
        shouldHandleTextCommands: () => false,
      },
    },
  };

  return runtime;
}
