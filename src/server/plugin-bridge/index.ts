/**
 * OpenClaw Channel Plugin Bridge
 *
 * Independent Bun process that loads an OpenClaw channel plugin and bridges
 * communication between the plugin and Rust (management API).
 *
 * CLI args:
 *   --plugin-dir <path>   Plugin installation directory
 *   --port <number>       HTTP server port for Rust → Bridge communication
 *   --rust-port <number>  Management API port for Bridge → Rust communication
 *   --bot-id <string>     Bot ID for message routing
 *
 * Env:
 *   BRIDGE_PLUGIN_CONFIG  Plugin configuration JSON (env var to avoid leaking secrets in `ps`)
 */

import { createCompatApi, type CapturedPlugin, type CapturedTool } from './compat-api';
import { createCompatRuntime } from './compat-runtime';
import { FeishuStreamingSession } from './streaming-adapter';
import { createMcpHandler } from './mcp-handler';
import { getPendingDispatch, resolvePendingDispatch, rejectPendingDispatch, clearAllPendingDispatches } from './pending-dispatch';
import { parseArgs } from 'util';

// Parse CLI arguments
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  strict: false,
  options: {
    'plugin-dir': { type: 'string' },
    'port': { type: 'string' },
    'rust-port': { type: 'string' },
    'bot-id': { type: 'string' },
  },
});

const pluginDir = args['plugin-dir'] as string | undefined;
const port = parseInt((args['port'] as string) || '0', 10);
const rustPort = parseInt((args['rust-port'] as string) || '0', 10);
const botId = (args['bot-id'] as string) || '';
// Read config from env var (not CLI arg) to avoid leaking secrets in process listing
const pluginConfig = JSON.parse(process.env.BRIDGE_PLUGIN_CONFIG || '{}');

if (!pluginDir || !port || !rustPort || !botId) {
  console.error('[plugin-bridge] Missing required args: --plugin-dir, --port, --rust-port, --bot-id');
  process.exit(1);
}

console.log(`[plugin-bridge] Starting: plugin-dir=${pluginDir} port=${port} rust-port=${rustPort} bot-id=${botId}`);

let capturedPlugin: CapturedPlugin | null = null;
let pluginName = 'unknown';
let gatewayError: string | null = null;
let gatewayStarted = false; // true once startAccount() has been invoked
let waitingForQrLogin = false; // true when plugin supports QR login but isn't configured yet

// Streaming sessions (keyed by streamId)
const streamingSessions = new Map<string, FeishuStreamingSession>();
let streamIdCounter = 0;

// MCP handler — initialized after plugin loads and captures tools
let mcpHandler: ReturnType<typeof createMcpHandler> | null = null;
let getCapturedToolsFn: (() => CapturedTool[]) | null = null;
let getCapturedCommandsFn: (() => import('./compat-api').CapturedCommand[]) | null = null;
/** OpenClaw-format config (channels.{brand}.{...}), set during loadPlugin() */
let loadedOpenclawConfig: Record<string, unknown> = {};
/** Compat runtime — created in loadPlugin(), shared with gateway ctx for startAccount/restart */
let loadedRuntime: unknown = null;
/** Current resolved account — shared by sendText/sendMedia closures, updated by /restart-gateway */
let currentAccount: Record<string, unknown> = {};
/**
 * Plugin's withTicket() function for AsyncLocalStorage context injection.
 * Discovered after plugin loads — allows MCP tool calls to access the
 * request-level ticket (senderOpenId, chatId, accountId) needed for
 * OAuth Device Flow auto-auth and account routing.
 */
let pluginWithTicket: ((ticket: Record<string, unknown>, fn: () => Promise<unknown>) => Promise<unknown>) | null = null;

async function loadPlugin() {
  // Find the plugin entry point FIRST — we need the module name to infer the channel brand
  const pkgJsonPath = `${pluginDir}/package.json`;
  const pkgJson = await Bun.file(pkgJsonPath).json().catch(() => ({}));

  // Find installed packages (look in node_modules for packages with openclaw metadata)
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  let entryModule: string | null = null;

  for (const depName of Object.keys(deps || {})) {
    if (depName === 'openclaw') continue; // Skip the shim
    try {
      const depPkg = await Bun.file(`${pluginDir}/node_modules/${depName}/package.json`).json();
      if (depPkg.openclaw || depPkg.keywords?.includes('openclaw')) {
        entryModule = depName;
        pluginName = depPkg.name || depName;
        break;
      }
    } catch {
      // Not an openclaw plugin, skip
    }
  }

  if (!entryModule) {
    throw new Error('No OpenClaw channel plugin found in dependencies');
  }

  console.log(`[plugin-bridge] Loading plugin: ${entryModule}`);

  // Infer channel brand from module name — needed to build OpenClaw-format config
  // before register(). Plugin tools (e.g. getEnabledLarkAccounts) look for
  // cfg.channels.feishu, not a flat {appId, appSecret} object.
  let channelKey = entryModule.replace(/^@[^/]+\//, ''); // strip scope
  if (/lark|feishu/i.test(entryModule)) {
    channelKey = 'feishu';
  } else if (/qqbot|qq/i.test(entryModule)) {
    channelKey = 'qqbot';
  } else if (/dingtalk/i.test(entryModule)) {
    channelKey = 'dingtalk';
  } else if (/telegram/i.test(entryModule)) {
    channelKey = 'telegram';
  }

  // Build OpenClaw-format config BEFORE register() so plugin tools can discover accounts.
  // The flat pluginConfig {appId, appSecret, ...} must be nested under channels.<brand>.
  const openclawConfig: Record<string, unknown> = {
    channels: {
      [channelKey]: {
        enabled: true,
        ...pluginConfig,
        dmPolicy: 'open',
        groupPolicy: 'open',
      },
    },
  };

  // Create compat API with properly structured config
  loadedOpenclawConfig = openclawConfig;
  const compatApi = createCompatApi(openclawConfig);
  // Runtime must be created early — plugins call setRuntime(api.runtime) during register()
  const runtime = createCompatRuntime(rustPort, botId, 'unknown');
  compatApi.runtime = runtime;
  loadedRuntime = runtime;

  // CRITICAL: Patch axios BEFORE importing the plugin.
  // @larksuiteoapi/node-sdk creates `defaultHttpInstance = axios.create()` at import time.
  // Bun's default axios http adapter has a compatibility bug where connections are silently
  // closed after ~30s, causing all SDK API calls to hang. Setting a 10s timeout prevents
  // the 30s hang and lets the plugin's error handling (retry/fallback) kick in faster.
  try {
    const axiosModule = await import(`${pluginDir}/node_modules/axios`);
    const axios = axiosModule.default || axiosModule;
    if (typeof axios?.create === 'function') {
      const origCreate = axios.create.bind(axios);
      axios.create = (...args: unknown[]) => {
        const instance = origCreate(...(args as [Record<string, unknown>]));
        if (!instance.defaults.timeout || instance.defaults.timeout > 10000) {
          instance.defaults.timeout = 10000;
        }
        return instance;
      };
      console.log('[plugin-bridge] Patched axios.create with 10s timeout for Bun compatibility');
    }
  } catch {
    // axios not installed in plugin dir — no patch needed
  }

  // Import the plugin module.
  // Prefer the `module` field (ESM entry) over `main` (CJS entry) when available.
  // Some plugins ship both CJS and ESM, but their CJS bundles `require()` ESM-only
  // dependencies (e.g. file-type v21+) which fails in Bun. Using the ESM entry
  // avoids this CJS→ESM incompatibility.
  let importPath = `${pluginDir}/node_modules/${entryModule}`;
  try {
    const pluginPkg = await Bun.file(`${pluginDir}/node_modules/${entryModule}/package.json`).json();
    if (pluginPkg.module) {
      importPath = `${pluginDir}/node_modules/${entryModule}/${pluginPkg.module}`;
      console.log(`[plugin-bridge] Using ESM entry: ${pluginPkg.module}`);
    }
  } catch { /* use default resolution */ }
  const pluginModule = await import(importPath);

  // Plugins can export their registration in several patterns:
  //   1. default export = { register(api) { ... } }  (OpenClaw standard)
  //   2. default export = function(api) { ... }       (simple)
  //   3. module.default.default                       (double-wrapped ESM)
  const exported = pluginModule.default || pluginModule;
  if (typeof exported === 'object' && typeof exported.register === 'function') {
    await exported.register(compatApi);
  } else if (typeof exported === 'function') {
    await exported(compatApi);
  } else if (typeof exported === 'object' && typeof exported.default?.register === 'function') {
    await exported.default.register(compatApi);
  }

  capturedPlugin = compatApi.getCapturedPlugin();

  if (!capturedPlugin) {
    throw new Error('Plugin did not register a channel via registerChannel()');
  }

  console.log(`[plugin-bridge] Plugin registered: ${capturedPlugin.id} (${capturedPlugin.name})`);

  // Update runtime with actual plugin ID (was 'unknown' at creation time)
  if (runtime && typeof (runtime as Record<string, unknown>).setPluginId === 'function') {
    (runtime as Record<string, unknown> & { setPluginId: (id: string) => void }).setPluginId(capturedPlugin.id);
  }

  // Set up MCP handler with captured tools (use openclawConfig so tools resolve accounts)
  getCapturedToolsFn = () => compatApi.getCapturedTools();
  getCapturedCommandsFn = () => compatApi.getCapturedCommands();
  mcpHandler = createMcpHandler(getCapturedToolsFn, openclawConfig, channelKey);
  const toolCount = compatApi.getCapturedTools().length;
  if (toolCount > 0) {
    console.log(`[plugin-bridge] MCP handler initialized with ${toolCount} captured tool factories`);
  }

  // Discover plugin's withTicket() for AsyncLocalStorage context injection.
  // The Feishu plugin uses LarkTicket (via AsyncLocalStorage) to propagate
  // message context (senderOpenId, chatId, accountId) through async call chains.
  // MCP tool calls arrive as separate HTTP requests — outside the original
  // withTicket() scope — so we must re-inject the ticket before tool.execute().
  //
  // NOTE: require.resolve() with subpath fails because the plugin's package.json
  // "exports" field only exposes ".". Use absolute path require() instead —
  // verified to share the same AsyncLocalStorage instance as the plugin's own code.
  if (entryModule && /lark|feishu/i.test(entryModule)) {
    try {
      const ticketPath = `${pluginDir}/node_modules/${entryModule}/src/core/lark-ticket.js`;
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- runtime dynamic load, must share AsyncLocalStorage instance
      const ticketMod = require(ticketPath);
      if (typeof ticketMod.withTicket === 'function') {
        pluginWithTicket = ticketMod.withTicket;
        console.log('[plugin-bridge] Discovered withTicket() for LarkTicket context injection');
      }
    } catch {
      console.log('[plugin-bridge] No LarkTicket module found (withTicket injection unavailable)');
    }
  }

  // Add plugin ID as additional channel key if it differs from inferred brand
  // (e.g., plugin.id="openclaw-lark" but tools need channels.feishu)
  const openclawCfg = openclawConfig;
  if (capturedPlugin.id !== channelKey) {
    (openclawCfg.channels as Record<string, unknown>)[capturedPlugin.id] =
      (openclawCfg.channels as Record<string, unknown>)[channelKey];
  }

  // Resolve account using the plugin's own config.resolveAccount if available
  // Pass accountId from pluginConfig (persisted after QR login) so plugins like
  // WeChat can find credentials saved under that specific accountId on disk.
  const configAccessor = capturedPlugin.raw?.config as Record<string, unknown> | undefined;
  const persistedAccountId = pluginConfig.accountId as string | undefined;
  let account: Record<string, unknown> = currentAccount;
  if (typeof configAccessor?.resolveAccount === 'function') {
    try {
      account = (configAccessor.resolveAccount as (cfg: unknown, id?: string) => Record<string, unknown>)(openclawCfg, persistedAccountId);
    } catch (err) {
      console.warn(`[plugin-bridge] resolveAccount failed, using flat config:`, err);
      account = { accountId: persistedAccountId || 'default', enabled: true, ...pluginConfig };
    }
  } else {
    account = { accountId: 'default', enabled: true, ...pluginConfig };
  }

  currentAccount = account; // Share with /restart-gateway and sendText/sendMedia closures

  // Log account with secrets redacted
  const redactedAccount = Object.fromEntries(
    Object.entries(account).map(([k, v]) =>
      /secret|token|password|key/i.test(k) && typeof v === 'string'
        ? [k, v.slice(0, 4) + '***']
        : [k, v]
    )
  );
  console.log(`[plugin-bridge] Resolved account:`, JSON.stringify(redactedAccount));

  // Wrap outbound.sendText/sendMedia if top-level handlers are missing
  // OpenClaw plugins put send functions under plugin.outbound with signature:
  //   outbound.sendText({ to, text, accountId, replyToId, cfg })
  // We need to wrap them to match our CapturedPlugin interface:
  //   sendText(chatId, text) → outbound.sendText({ to: chatId, text, cfg })
  const outbound = capturedPlugin.raw?.outbound as Record<string, unknown> | undefined;
  if (!capturedPlugin.sendText && typeof outbound?.sendText === 'function') {
    const outboundSendText = outbound.sendText as (params: Record<string, unknown>) => Promise<{ messageId?: string; error?: Error }>;
    capturedPlugin.sendText = async (chatId: string, text: string) => {
      const result = await outboundSendText({ to: chatId, text, accountId: currentAccount.accountId || 'default', cfg: openclawCfg });
      if (result?.error) throw result.error;
      return { messageId: result?.messageId };
    };
    console.log('[plugin-bridge] Wrapped outbound.sendText as sendText handler');
  }
  if (!capturedPlugin.sendMedia && typeof outbound?.sendMedia === 'function') {
    const outboundSendMedia = outbound.sendMedia as (params: Record<string, unknown>) => Promise<{ messageId?: string; error?: Error }>;
    capturedPlugin.sendMedia = async (params: Record<string, unknown>) => {
      const result = await outboundSendMedia({ ...params, accountId: currentAccount.accountId || 'default', cfg: openclawCfg });
      if (result?.error) throw result.error;
      return { messageId: result?.messageId };
    };
    console.log('[plugin-bridge] Wrapped outbound.sendMedia as sendMedia handler');
  }
  // Store textChunkLimit from outbound config for max_message_length
  if (outbound?.textChunkLimit && typeof outbound.textChunkLimit === 'number') {
    console.log(`[plugin-bridge] Plugin textChunkLimit: ${outbound.textChunkLimit}`);
  }

  // Validate credentials before starting gateway
  // Check if the plugin's isConfigured function reports the account as configured
  const configAccessorForCheck = capturedPlugin.raw?.config as Record<string, unknown> | undefined;
  const supportsQrLogin = typeof capturedPlugin.gateway?.loginWithQrStart === 'function';
  if (typeof configAccessorForCheck?.isConfigured === 'function') {
    // OpenClaw signature: isConfigured(account, cfg) → boolean | Promise<boolean>
    const configuredResult = (configAccessorForCheck.isConfigured as (a: unknown, c: unknown) => boolean | Promise<boolean>)(account, openclawCfg);
    const configured = configuredResult instanceof Promise ? await configuredResult : configuredResult;
    if (!configured) {
      if (supportsQrLogin) {
        // QR login plugins: isConfigured=false is expected (user hasn't scanned yet).
        // Keep Bridge alive and healthy — QR login endpoints will handle authentication.
        waitingForQrLogin = true;
        console.log('[plugin-bridge] Account not configured, but plugin supports QR login — waiting for /qr-login-start');
        return; // Skip gateway start — /restart-gateway will start it after QR login
      } else {
        const errMsg = 'Plugin reports account is not configured (missing required credentials)';
        console.error(`[plugin-bridge] ${errMsg}`);
        gatewayError = errMsg;
        return; // Don't start gateway — credentials are missing
      }
    }
  }

  // Start the plugin's gateway
  const startAccount = capturedPlugin.gateway?.startAccount;
  if (typeof startAccount === 'function') {
    const abortController = new AbortController();
    let status: Record<string, unknown> = { running: false, connected: false };

    const resolvedAccountId = (account.accountId as string) || persistedAccountId || 'default';
    const ctx = {
      account,
      accountId: resolvedAccountId,
      abortSignal: abortController.signal,
      log: console,
      runtime,
      cfg: openclawCfg,
      getStatus: () => status,
      setStatus: (s: Record<string, unknown>) => { status = s; },
    };

    // Don't await — let the gateway run in background (it may be long-lived)
    gatewayStarted = true;
    // Store context for stopAccount() — OpenClaw expects same context shape
    (globalThis as Record<string, unknown>).__bridgeGatewayCtx = ctx;
    (startAccount as (ctx: Record<string, unknown>) => Promise<void>)(ctx)
      .then(() => console.log(`[plugin-bridge] Plugin gateway started`))
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[plugin-bridge] Gateway error:`, errMsg);
        gatewayError = errMsg;
      });

    // Store abort controller for graceful shutdown
    (globalThis as Record<string, unknown>).__bridgeAbort = abortController;
  } else {
    // No gateway — plugin is a send-only channel, mark as ready immediately
    gatewayStarted = true;
  }
}

// Start HTTP server for Rust → Bridge communication
const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/health') {
      return Response.json({ ok: true, pluginName });
    }

    if (path === '/status') {
      return Response.json({
        ok: !gatewayError,
        pluginName,
        pluginId: capturedPlugin?.id || 'unknown',
        // Ready when: gateway running OR waiting for QR login (plugin loaded, endpoints available)
        ready: !!capturedPlugin && !gatewayError && (gatewayStarted || waitingForQrLogin),
        error: gatewayError || undefined,
        waitingForQrLogin,
      });
    }

    if (path === '/capabilities') {
      const outbound = capturedPlugin?.raw?.outbound as Record<string, unknown> | undefined;
      const capabilities = capturedPlugin?.raw?.capabilities as Record<string, unknown> | undefined;
      const hasCardKitStreaming = !!(pluginConfig.appId && pluginConfig.appSecret);
      const toolGroups = mcpHandler ? mcpHandler.getToolGroups() : [];
      const hasTools = getCapturedToolsFn ? getCapturedToolsFn().length > 0 : false;
      const commands = getCapturedCommandsFn
        ? getCapturedCommandsFn().map(c => ({ name: c.name, description: c.description }))
        : [];
      const supportsQrLogin = typeof capturedPlugin?.gateway?.loginWithQrStart === 'function';
      return Response.json({
        pluginId: capturedPlugin?.id || 'unknown',
        textChunkLimit: outbound?.textChunkLimit ?? 4096,
        chunkerMode: outbound?.chunkerMode ?? 'text',
        deliveryMode: outbound?.deliveryMode ?? 'direct',
        capabilities: {
          chatTypes: capabilities?.chatTypes ?? ['direct'],
          media: capabilities?.media ?? false,
          reactions: capabilities?.reactions ?? false,
          threads: capabilities?.threads ?? false,
          edit: !!capturedPlugin?.editMessage || !!(capabilities?.edit),
          blockStreaming: capabilities?.blockStreaming ?? false,
          streaming: hasCardKitStreaming,
          streamingCardKit: hasCardKitStreaming,
          hasTools,
          toolGroups,
          commands,
          supportsQrLogin,
        },
      });
    }

    if (path === '/send-text' && req.method === 'POST') {
      const body = await req.json() as { chatId: string; text: string };
      const { chatId, text } = body;

      if (!capturedPlugin?.sendText) {
        return Response.json({ ok: false, error: 'Plugin has no sendText handler' }, { status: 501 });
      }

      try {
        const result = await capturedPlugin.sendText(chatId, text);
        const messageId = result?.messageId;
        if (!messageId) {
          console.warn(`[plugin-bridge] sendText returned empty messageId for chatId=${chatId} — the platform API may have rejected the request. result:`, JSON.stringify(result));
        }
        return Response.json({ ok: true, messageId: messageId || undefined });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/edit-message' && req.method === 'POST') {
      const body = await req.json() as { chatId: string; messageId: string; text: string };
      const { chatId, messageId, text } = body;

      if (!capturedPlugin?.editMessage) {
        return Response.json({ ok: false, error: 'Not supported' }, { status: 501 });
      }

      try {
        await capturedPlugin.editMessage(chatId, messageId, text);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/delete-message' && req.method === 'POST') {
      const body = await req.json() as { chatId: string; messageId: string };
      const { chatId, messageId } = body;

      if (!capturedPlugin?.deleteMessage) {
        return Response.json({ ok: false, error: 'Not supported' }, { status: 501 });
      }

      try {
        await capturedPlugin.deleteMessage(chatId, messageId);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/send-media' && req.method === 'POST') {
      const body = await req.json() as Record<string, unknown>;

      if (!capturedPlugin?.sendMedia) {
        return Response.json({ ok: false, error: 'Not supported' }, { status: 501 });
      }

      try {
        const result = await capturedPlugin.sendMedia(body);
        return Response.json({ ok: true, messageId: result?.messageId });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/validate-credentials' && req.method === 'POST') {
      // Generic credential validation using the plugin's own isConfigured() check
      if (!capturedPlugin) {
        return Response.json({ ok: false, error: 'Plugin not loaded yet' }, { status: 503 });
      }
      const configCheck = capturedPlugin.raw?.config as Record<string, unknown> | undefined;
      if (typeof configCheck?.isConfigured !== 'function') {
        // Plugin has no isConfigured — assume credentials are fine if plugin loaded
        return Response.json({ ok: true, message: 'Plugin has no credential validator (assumed valid)' });
      }
      try {
        const body = await req.json() as Record<string, unknown>;
        // Build a temporary account-like object from the provided credentials
        const tempAccount = { accountId: 'default', enabled: true, ...body };
        // OpenClaw signature: isConfigured(account, cfg) → boolean | Promise<boolean>
        const configuredResult = (configCheck.isConfigured as (a: unknown, c: unknown) => boolean | Promise<boolean>)(tempAccount, loadedOpenclawConfig);
        const configured = configuredResult instanceof Promise ? await configuredResult : configuredResult;
        if (configured) {
          return Response.json({ ok: true, message: 'Credentials valid (isConfigured passed)' });
        } else {
          return Response.json({ ok: false, error: 'Plugin reports credentials incomplete' });
        }
      } catch (err) {
        return Response.json({ ok: false, error: `Validation error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
      }
    }

    // ===== Streaming endpoints (CardKit streaming cards) =====

    if (path === '/start-stream' && req.method === 'POST') {
      const body = await req.json() as {
        chatId: string;
        initialContent?: string;
        streamMode?: 'text' | 'cardkit';
        receiveIdType?: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id';
        replyToMessageId?: string;
        replyInThread?: boolean;
        rootId?: string;
        header?: { title: string; template?: string };
      };

      // Protocol path: plugin's StreamingCardController will create its own card
      // via onPartialReply — we just return a synthetic streamId for Rust to track
      const pending = getPendingDispatch(body.chatId);
      if (pending) {
        const streamId = `pending_${++streamIdCounter}_${Date.now()}`;
        console.log(`[plugin-bridge] /start-stream: using protocol dispatch for chatId=${body.chatId}, streamId=${streamId}`);
        return Response.json({ ok: true, streamId, pendingDispatch: true });
      }

      // Fallback: no pending dispatch, use our FeishuStreamingSession
      if (!pluginConfig.appId || !pluginConfig.appSecret) {
        return Response.json({ ok: false, error: 'CardKit streaming requires appId and appSecret in plugin config' }, { status: 400 });
      }

      const creds = {
        appId: String(pluginConfig.appId),
        appSecret: String(pluginConfig.appSecret),
        domain: (pluginConfig.domain as string) || undefined,
      };

      const session = new FeishuStreamingSession(creds, (msg) => console.log(`[streaming] ${msg}`));

      try {
        // Auto-detect receive_id_type from ID prefix: ou_=open_id, oc_=chat_id, on_=union_id
        const autoIdType = body.chatId.startsWith('ou_') ? 'open_id'
          : body.chatId.startsWith('on_') ? 'union_id'
          : 'chat_id';
        await session.start(body.chatId, body.receiveIdType || autoIdType, {
          replyToMessageId: body.replyToMessageId,
          replyInThread: body.replyInThread,
          rootId: body.rootId,
          header: body.header,
        });

        // If initial content provided, send first update
        if (body.initialContent) {
          await session.update(body.initialContent);
        }

        const streamId = `stream_${++streamIdCounter}_${Date.now()}`;
        streamingSessions.set(streamId, session);

        const state = session.getState();
        return Response.json({
          ok: true,
          streamId,
          cardId: state?.cardId,
          messageId: state?.messageId,
        });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/stream-chunk' && req.method === 'POST') {
      const body = await req.json() as {
        chatId?: string;
        streamId: string;
        content: string;
        sequence?: number;
        isThinking?: boolean;
      };

      // Protocol path: route through plugin's own callbacks
      const pending = body.chatId ? getPendingDispatch(body.chatId) : undefined;
      if (pending) {
        try {
          if (body.isThinking) {
            pending.callbacks.onReasoningStream?.({ text: body.content || '' });
          } else {
            pending.callbacks.onPartialReply?.({ text: body.content });
          }
          return Response.json({ ok: true });
        } catch (err) {
          console.error(`[plugin-bridge] /stream-chunk protocol callback error for chatId=${body.chatId}:`, err);
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      }

      // Fallback: FeishuStreamingSession
      const session = streamingSessions.get(body.streamId);
      if (!session) {
        return Response.json({ ok: false, error: 'Stream not found' }, { status: 404 });
      }
      if (!session.isActive()) {
        return Response.json({ ok: false, error: 'Stream is no longer active' }, { status: 409 });
      }

      try {
        if (body.isThinking) {
          return Response.json({ ok: true });
        }
        await session.update(body.content);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/finalize-stream' && req.method === 'POST') {
      const body = await req.json() as { chatId?: string; streamId: string; finalContent?: string };

      // Protocol path: deliver final text through plugin's dispatcher, then resolve pending dispatch
      const pending = body.chatId ? getPendingDispatch(body.chatId) : undefined;
      if (pending) {
        try {
          const finalText = body.finalContent || '';
          // Always call sendFinalReply — it signals the plugin to close the streaming card
          pending.callbacks.sendFinalReply({ text: finalText });
          // Resolve the pending dispatch — dispatchReplyFromConfig will return,
          // then withReplyDispatcher's finally block calls markComplete + waitForIdle
          resolvePendingDispatch(body.chatId!, { queuedFinal: 1, counts: { final: 1 } });
          return Response.json({ ok: true });
        } catch (err) {
          console.error(`[plugin-bridge] /finalize-stream protocol error:`, err);
          rejectPendingDispatch(body.chatId!, err instanceof Error ? err : new Error(String(err)));
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      }

      // Fallback: FeishuStreamingSession
      const session = streamingSessions.get(body.streamId);
      if (!session) {
        return Response.json({ ok: false, error: 'Stream not found' }, { status: 404 });
      }

      try {
        await session.close(body.finalContent);
        streamingSessions.delete(body.streamId);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/abort-stream' && req.method === 'POST') {
      const body = await req.json() as { chatId?: string; streamId: string };

      // Protocol path: reject pending dispatch — plugin's error handler shows abort card
      const pending = body.chatId ? getPendingDispatch(body.chatId) : undefined;
      if (pending) {
        rejectPendingDispatch(body.chatId!, new Error('AI generation aborted'));
        return Response.json({ ok: true });
      }

      // Fallback: FeishuStreamingSession
      const session = streamingSessions.get(body.streamId);
      if (!session) {
        return Response.json({ ok: false, error: 'Stream not found' }, { status: 404 });
      }

      try {
        await session.close('[Aborted]');
        streamingSessions.delete(body.streamId);
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // ===== MCP tool proxy endpoints =====

    if (path === '/mcp/tools' && req.method === 'GET') {
      if (!mcpHandler) {
        return Response.json({ ok: false, error: 'MCP handler not initialized (no tools captured)' }, { status: 503 });
      }

      const groupsParam = url.searchParams.get('groups');
      const enabledGroups = groupsParam ? groupsParam.split(',').map((g) => g.trim()).filter(Boolean) : undefined;

      try {
        const tools = mcpHandler.resolveTools(enabledGroups);
        return Response.json({ ok: true, tools });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/mcp/call-tool' && req.method === 'POST') {
      if (!mcpHandler) {
        return Response.json({ ok: false, error: 'MCP handler not initialized (no tools captured)' }, { status: 503 });
      }

      const body = await req.json() as {
        toolName: string;
        args: Record<string, unknown>;
        userId?: string;
        isOwner?: boolean;
        enabledGroups?: string[];
        // Ticket context for AsyncLocalStorage injection (Feishu OAuth auto-auth)
        chatId?: string;
        chatType?: string;
        accountId?: string;
      };

      if (!body.toolName) {
        return Response.json({ ok: false, error: 'Missing required field: toolName' }, { status: 400 });
      }

      // Enforce tool group restrictions: only allow tools in enabled groups
      if (body.enabledGroups && body.enabledGroups.length > 0) {
        const allowedTools = mcpHandler.resolveTools(body.enabledGroups);
        const isAllowed = allowedTools.some(t => t.name === body.toolName);
        if (!isAllowed) {
          return Response.json({ ok: false, error: `Tool "${body.toolName}" is not in the enabled tool groups` }, { status: 403 });
        }
      }

      try {
        // Wrap tool execution in plugin's withTicket() if available.
        // This injects the LarkTicket context so the plugin's auto-auth
        // (handleInvokeErrorWithAutoAuth) can find the sender and chat to
        // send OAuth Device Flow cards. Without this, getTicket() returns
        // undefined and auto-auth silently falls back to error propagation.
        const doCall = () => mcpHandler!.callTool(body.toolName, body.args || {}, body.userId, body.isOwner);

        let result: unknown;
        if (pluginWithTicket && body.userId) {
          const ticket = {
            senderOpenId: body.userId,
            chatId: body.chatId || body.userId,
            chatType: body.chatType || 'p2p',
            accountId: body.accountId || 'default',
            messageId: `bridge-mcp-${Date.now()}`,
            startTime: Date.now(),
          };
          result = await pluginWithTicket(ticket, doCall);
        } else {
          result = await doCall();
        }
        // Ensure result is never undefined — JSON.stringify omits undefined keys,
        // causing downstream MCP SDK validation to fail (text: undefined)
        return Response.json({ ok: true, result: result ?? null });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // ===== Plugin command execution =====

    if (path === '/execute-command' && req.method === 'POST') {
      const body = await req.json() as { command: string; args?: string; userId?: string; chatId?: string };
      if (!body.command) {
        return Response.json({ ok: false, error: 'Missing required field: command' }, { status: 400 });
      }

      const commands = getCapturedCommandsFn ? getCapturedCommandsFn() : [];
      const cmd = commands.find(c => c.name === body.command);
      if (!cmd) {
        return Response.json({ ok: false, error: `Unknown command: /${body.command}` }, { status: 404 });
      }

      try {
        const result = await cmd.execute({
          args: body.args || '',
          userId: body.userId,
          chatId: body.chatId,
          config: loadedOpenclawConfig,
        });
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return Response.json({ ok: true, result: text });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // ===== QR Login endpoints (generic OpenClaw gateway protocol) =====

    if (path === '/qr-login-start' && req.method === 'POST') {
      const loginWithQrStart = capturedPlugin?.gateway?.loginWithQrStart;
      if (typeof loginWithQrStart !== 'function') {
        return Response.json({ ok: false, error: 'Plugin does not support QR login' }, { status: 501 });
      }
      try {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const result = await (loginWithQrStart as (params: Record<string, unknown>) => Promise<Record<string, unknown>>)(body);
        // qrDataUrl can be:
        // 1. data:image/png;base64,... (WhatsApp) — pass through, frontend renders as <img>
        // 2. https://... (WeChat) — a URL to be QR-encoded, NOT an image to download.
        //    The frontend will use the `qrcode` library to encode this URL into a QR image.
        //    WeChat's qrcode_img_content is a web page URL, not a direct image.
        // Both cases: return as-is. Frontend handles rendering.
        return Response.json({ ok: true, ...result });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/qr-login-wait' && req.method === 'POST') {
      const loginWithQrWait = capturedPlugin?.gateway?.loginWithQrWait;
      if (typeof loginWithQrWait !== 'function') {
        return Response.json({ ok: false, error: 'Plugin does not support QR login' }, { status: 501 });
      }
      try {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        // loginWithQrWait may long-poll (up to 35s for WeChat), so no timeout here
        const result = await (loginWithQrWait as (params: Record<string, unknown>) => Promise<Record<string, unknown>>)(body);
        return Response.json({ ok: true, ...result });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    if (path === '/restart-gateway' && req.method === 'POST') {
      // After QR login success, restart the gateway with fresh credentials
      if (!capturedPlugin) {
        return Response.json({ ok: false, error: 'No plugin loaded' }, { status: 500 });
      }
      try {
        // 1. Stop current gateway gracefully (abort + explicit stopAccount)
        const abortCtrl = (globalThis as Record<string, unknown>).__bridgeAbort as AbortController | undefined;
        if (abortCtrl) abortCtrl.abort();
        const stopAccount = capturedPlugin.gateway?.stopAccount;
        if (typeof stopAccount === 'function') {
          try { await (stopAccount as () => Promise<void>)(); } catch { /* best-effort */ }
        }

        // 2. Re-resolve account with fresh credentials
        // CRITICAL: pass accountId from QR login result — plugins like WeChat require
        // accountId to look up the newly-saved credentials on disk
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const qrAccountId = body.accountId as string | undefined;
        const resolveAccount = capturedPlugin.raw?.config as Record<string, unknown> | undefined;
        let account: Record<string, unknown> = pluginConfig;
        if (typeof resolveAccount?.resolveAccount === 'function') {
          try {
            account = await (resolveAccount.resolveAccount as (cfg: unknown, id?: string) => Promise<Record<string, unknown>>)(loadedOpenclawConfig, qrAccountId) || pluginConfig;
          } catch (err) {
            console.warn('[plugin-bridge] resolveAccount failed after QR login:', err);
            // If resolve failed but we have an accountId, try building a minimal account
            if (qrAccountId) {
              account = { accountId: qrAccountId, enabled: true, configured: true, ...pluginConfig };
            }
          }
        }

        // 3. Check if now configured
        // OpenClaw signature: isConfigured(account, cfg) → boolean | Promise<boolean>
        const isConfigured = resolveAccount;
        if (typeof isConfigured?.isConfigured === 'function') {
          const configuredResult = (isConfigured.isConfigured as (a: unknown, c: unknown) => boolean | Promise<boolean>)(account, loadedOpenclawConfig);
          const configured = configuredResult instanceof Promise ? await configuredResult : configuredResult;
          if (!configured) {
            return Response.json({ ok: false, error: 'Account still not configured after QR login' }, { status: 400 });
          }
        }

        // 4. Update shared account (sendText/sendMedia closures use currentAccount)
        currentAccount = account;
        waitingForQrLogin = false; // QR login complete, transitioning to running state

        // 5. Start gateway with new account
        const startAccount = capturedPlugin.gateway?.startAccount;
        if (typeof startAccount === 'function') {
          const newAbort = new AbortController();
          let status: Record<string, unknown> = { running: false, connected: false };
          const restartAccountId = (account.accountId as string) || qrAccountId || 'default';
          const ctx = {
            account,
            accountId: restartAccountId,
            abortSignal: newAbort.signal,
            log: console,
            runtime: loadedRuntime,
            cfg: loadedOpenclawConfig,
            getStatus: () => status,
            setStatus: (s: Record<string, unknown>) => { status = s; },
          };
          gatewayError = null;
          gatewayStarted = true;
          // Store context for stopAccount()
          (globalThis as Record<string, unknown>).__bridgeGatewayCtx = ctx;
          (startAccount as (ctx: Record<string, unknown>) => Promise<void>)(ctx)
            .then(() => console.log('[plugin-bridge] Gateway restarted after QR login'))
            .catch((err: unknown) => {
              gatewayError = err instanceof Error ? err.message : String(err);
              console.error('[plugin-bridge] Gateway restart error:', gatewayError);
            });
          (globalThis as Record<string, unknown>).__bridgeAbort = newAbort;
        }
        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // ===== Lifecycle endpoints =====

    if (path === '/stop' && req.method === 'POST') {
      console.log('[plugin-bridge] Received stop signal');
      // Clean up pending protocol dispatches
      clearAllPendingDispatches();
      // Close any active streaming sessions before shutdown
      for (const [id, session] of streamingSessions) {
        try {
          if (session.isActive()) await session.close('[Bridge stopping]');
        } catch { /* best-effort */ }
        streamingSessions.delete(id);
      }
      // Abort the gateway via AbortController
      const abortCtrl = (globalThis as Record<string, unknown>).__bridgeAbort as AbortController | undefined;
      if (abortCtrl) abortCtrl.abort();
      // Also try calling stopAccount if available — OpenClaw expects same context as startAccount
      const stopAccount = capturedPlugin?.gateway?.stopAccount;
      if (typeof stopAccount === 'function') {
        try {
          const gatewayCtx = (globalThis as Record<string, unknown>).__bridgeGatewayCtx as Record<string, unknown> | undefined;
          await (stopAccount as (ctx?: Record<string, unknown>) => Promise<void>)(gatewayCtx);
        } catch (err) {
          console.error('[plugin-bridge] Error stopping plugin gateway:', err);
        }
      }
      // Graceful shutdown
      setTimeout(() => process.exit(0), 500);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(`[plugin-bridge] HTTP server listening on port ${server.port}`);

// Load the plugin
loadPlugin().catch((err) => {
  console.error('[plugin-bridge] Failed to load plugin:', err);
  process.exit(1);
});
