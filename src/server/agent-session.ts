import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { broadcast } from './sse';
import crypto from 'crypto';
import * as SessionStore from './SessionStore';
import * as MCPConfigStore from './MCPConfigStore';
import * as ConfigStore from './ConfigStore';
import { resolveClaudeCodeCli } from './provider-verify';
import type { ProviderEnv, ProviderAuthType } from '../shared/types/config';
import type { PermissionMode } from '../shared/types/permission';

interface ChatImage {
  name: string;
  mimeType: string;
  data: string; // 纯 base64
}

/** OpenAI Bridge 上游配置（当 apiProtocol === 'openai' 时存储） */
export interface OpenAiBridgeConfig {
  baseUrl: string;
  apiKey: string;
  maxOutputTokens?: number;
  upstreamFormat?: 'chat_completions' | 'responses';
}

/** 当前 OpenAI bridge 配置（模块级，供 bridge handler 读取） */
let currentOpenAiBridgeConfig: OpenAiBridgeConfig | null = null;

/** 获取当前 OpenAI bridge 配置 */
export function getOpenAiBridgeConfig(): OpenAiBridgeConfig | null {
  return currentOpenAiBridgeConfig;
}

/** 消息队列项 */
interface QueueItem {
  sdkMessage: SDKUserMessage;
  text: string; // 用于日志和持久化
  queueId: string;
  wasQueued: boolean; // 区分直接发送和排队消息
}

const MAX_QUEUE_SIZE = 10;

/** 会话启动所需的配置快照 */
interface SessionConfig {
  agentDir: string;
  providerEnv?: ProviderEnv;
  model?: string;
  permissionMode: PermissionMode;
  mcpEnabledServerIds?: string[];
}

export function buildClaudeSessionEnv(providerEnv?: ProviderEnv): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };

  // 1. ANTHROPIC_BASE_URL
  if (providerEnv?.baseUrl) {
    env.ANTHROPIC_BASE_URL = providerEnv.baseUrl;
    console.log(`[env] ANTHROPIC_BASE_URL set to: ${providerEnv.baseUrl}`);
  } else {
    delete env.ANTHROPIC_BASE_URL;
  }

  // 2. 认证 — 按 authType 四路分支
  if (providerEnv?.apiKey) {
    const authType: ProviderAuthType = providerEnv.authType ?? 'both';
    switch (authType) {
      case 'auth_token':
        env.ANTHROPIC_AUTH_TOKEN = providerEnv.apiKey;
        delete env.ANTHROPIC_API_KEY;
        break;
      case 'api_key':
        delete env.ANTHROPIC_AUTH_TOKEN;
        env.ANTHROPIC_API_KEY = providerEnv.apiKey;
        break;
      case 'auth_token_clear_api_key':
        env.ANTHROPIC_AUTH_TOKEN = providerEnv.apiKey;
        env.ANTHROPIC_API_KEY = '';
        break;
      case 'both':
      default:
        env.ANTHROPIC_AUTH_TOKEN = providerEnv.apiKey;
        env.ANTHROPIC_API_KEY = providerEnv.apiKey;
        break;
    }
  } else {
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.ANTHROPIC_API_KEY;
  }

  // 3. model 由调用方按需设置 ANTHROPIC_MODEL（不在此处 delete）

  // 4. API 超时设置
  if (providerEnv?.timeout) {
    env.API_TIMEOUT_MS = String(providerEnv.timeout);
  } else {
    delete env.API_TIMEOUT_MS;
  }

  // 5. 禁用非必要流量（某些第三方 provider 不支持 SDK 的附加请求）
  if (providerEnv?.disableNonessential) {
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  } else {
    delete env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
  }

  // 6. OpenAI 协议桥接
  if (providerEnv?.apiProtocol === 'openai') {
    const sidecarPort = parseInt(process.env.PORT || '3000', 10);
    if (sidecarPort > 0) {
      // SDK 请求转发到 sidecar 的 loopback 路由，由 sidecar 翻译为 OpenAI 格式
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${sidecarPort}`;
      env.ANTHROPIC_API_KEY = providerEnv.apiKey ?? '';
      delete env.ANTHROPIC_AUTH_TOKEN;

      // 清除代理变量，防止 loopback 请求被路由到系统代理
      for (const proxyVar of [
        'http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY',
        'ALL_PROXY', 'all_proxy', 'no_proxy', 'NO_PROXY',
      ]) {
        delete env[proxyVar];
      }

      // 存储 upstream 配置供 OpenAI bridge handler 读取
      currentOpenAiBridgeConfig = {
        baseUrl: providerEnv.baseUrl ?? '',
        apiKey: providerEnv.apiKey ?? '',
        maxOutputTokens: providerEnv.maxOutputTokens,
        upstreamFormat: providerEnv.upstreamFormat,
      };
      console.log(`[env] OpenAI bridge: ANTHROPIC_BASE_URL → loopback :${sidecarPort}, upstream → ${providerEnv.baseUrl}, proxy vars stripped`);
    } else {
      console.warn('[env] apiProtocol=openai but sidecar port unavailable');
      currentOpenAiBridgeConfig = null;
    }
    return env;
  }

  // 非 OpenAI 协议时清除 bridge 配置
  currentOpenAiBridgeConfig = null;

  // 7. Model aliases (sonnet/opus/haiku → actual model IDs for third-party providers)
  if (providerEnv?.modelAliases) {
    const aliases = providerEnv.modelAliases;
    const parts: string[] = [];
    if (aliases.sonnet) parts.push(`sonnet=${aliases.sonnet}`);
    if (aliases.opus) parts.push(`opus=${aliases.opus}`);
    if (aliases.haiku) parts.push(`haiku=${aliases.haiku}`);
    if (parts.length > 0) {
      env.CLAUDE_CODE_USE_MODEL_ALIASES = parts.join(',');
      console.log(`[env] Model aliases: ${parts.join(', ')}`);
    }
  } else {
    delete env.CLAUDE_CODE_USE_MODEL_ALIASES;
  }

  return env;
}

// ── SessionRunner: 持久会话模式 ──
// subprocess 在首条消息时启动，后续消息通过队列投递，无需重启。
// Provider/Model/PermissionMode 变更时自动重启子进程。

class SessionRunner {
  readonly sessionId: string;

  // ── 会话状态 ──
  private sessionActive = false;   // subprocess 存活中
  private isStreaming = false;     // AI 正在生成回复（前端 isRunning 映射到此）
  private querySession: ReturnType<typeof query> | null = null;
  private sdkSessionId: string | null = null;

  // ── 配置快照（用于变更检测）──
  private providerEnv: ProviderEnv | undefined;
  private currentModel: string | undefined;
  private currentPermissionMode: PermissionMode = 'acceptEdits';
  private sessionConfig: SessionConfig | null = null;

  // ── 持久 Session 门控 ──
  private messageResolver: ((item: QueueItem | null) => void) | null = null;
  private resolveTurnComplete: (() => void) | null = null;
  private shouldAbort = false;
  private sessionTerminationPromise: Promise<void> | null = null;
  private messageQueue: QueueItem[] = [];

  // ── 每轮助手内容 ──
  private turnAssistantContent = '';
  private turnHasStreamedContent = false;
  private currentToolId = '';

  // ── Turn 级 usage 跟踪 ──
  private turnUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, model: undefined as string | undefined, modelUsage: undefined as Record<string, import('../shared/types/session').ModelUsageEntry> | undefined };
  private turnStartTime: number | null = null;
  private turnToolCount = 0;

  // ── 权限/问题处理 ──
  private pendingPermissions = new Map<string, (allow: boolean) => void>();
  private pendingQuestions = new Map<string, (answers: Record<string, string>) => void>();
  private pendingPermissionData = new Map<string, { toolName: string; toolUseId: string; toolInput: Record<string, unknown> }>();
  private pendingQuestionData = new Map<string, { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> }>();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /** 前端通过 /agent/state 读取此值判断 AI 是否在处理 */
  getIsRunning(): boolean {
    return this.isStreaming;
  }

  // ── 消息队列门控 ──

  /** 投递消息到 generator（或推入队列等待） */
  private wakeGenerator(item: QueueItem | null): void {
    if (this.messageResolver) {
      const resolve = this.messageResolver;
      this.messageResolver = null;
      resolve(item);
    } else if (item) {
      this.messageQueue.push(item);
    }
  }

  /** generator 阻塞等待下一条消息 */
  private waitForMessage(): Promise<QueueItem | null> {
    if (this.shouldAbort) return Promise.resolve(null);
    if (this.messageQueue.length > 0) return Promise.resolve(this.messageQueue.shift()!);
    return new Promise(resolve => { this.messageResolver = resolve; });
  }

  /** result 事件到达后解锁 generator 进入下一轮 */
  private signalTurnComplete(): void {
    if (this.resolveTurnComplete) {
      const resolve = this.resolveTurnComplete;
      this.resolveTurnComplete = null;
      resolve();
    }
  }

  /** generator 阻塞等待 AI 回复完成 */
  private waitForTurnComplete(): Promise<void> {
    if (this.shouldAbort) return Promise.resolve();
    return new Promise(resolve => { this.resolveTurnComplete = resolve; });
  }

  /** session 异常死亡时逐条广播 queue:cancelled */
  private drainMessageQueue(): void {
    for (const item of this.messageQueue) {
      if (item.wasQueued) {
        broadcast('queue:cancelled', { sessionId: this.sessionId, queueId: item.queueId });
      }
    }
    this.messageQueue.length = 0;
  }

  /** 中止持久 session：唤醒所有被阻塞的 Promise + 中断 subprocess */
  private abortSession(): void {
    this.shouldAbort = true;
    // 唤醒 generator 的 waitForMessage
    if (this.messageResolver) {
      const resolve = this.messageResolver;
      this.messageResolver = null;
      resolve(null);
    }
    // 唤醒 generator 的 waitForTurnComplete
    this.signalTurnComplete();
    // 中断 SDK subprocess
    if (this.querySession) {
      this.querySession.interrupt().catch(() => {});
    }
  }

  // ── 持久 messageGenerator ──

  private async *messageGenerator(): AsyncGenerator<SDKUserMessage> {
    console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] messageGenerator started (persistent mode)`);

    while (true) {
      const item = await this.waitForMessage();
      if (!item) {
        console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] messageGenerator received null — exiting`);
        return;
      }

      // 排队消息：在 yield 前保存用户消息到 SessionStore 并广播 queue:started
      if (item.wasQueued) {
        SessionStore.saveMessage(this.sessionId, {
          id: crypto.randomUUID(),
          role: 'user',
          content: item.text,
          timestamp: new Date().toISOString(),
        });
        broadcast('queue:started', {
          sessionId: this.sessionId,
          queueId: item.queueId,
          text: item.text,
        });
      }

      // 重置每轮状态
      this.turnAssistantContent = '';
      this.turnHasStreamedContent = false;
      this.currentToolId = '';
      this.turnUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, model: undefined, modelUsage: undefined };
      this.turnStartTime = Date.now();
      this.turnToolCount = 0;
      this.isStreaming = true;

      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] messageGenerator yielding message: "${item.text.slice(0, 50)}" (wasQueued=${item.wasQueued})`);
      yield item.sdkMessage;

      // 等待本轮 AI 回复完成（result 消息到达后解锁）
      await this.waitForTurnComplete();

      if (this.shouldAbort) {
        console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] messageGenerator abort flag set, exiting`);
        return;
      }
    }
  }

  // ── 启动持久会话 ──

  private startSession(config: SessionConfig): void {
    // fire-and-forget: 后台运行事件消费循环
    this.runSession(config).catch((err) => {
      console.error(`[SessionRunner:${this.sessionId.slice(0, 8)}] runSession unexpected error:`, err);
    });
  }

  private async runSession(config: SessionConfig): Promise<void> {
    if (this.sessionTerminationPromise) {
      await this.sessionTerminationPromise;
    }

    if (this.sessionActive) return;

    this.shouldAbort = false;
    this.sessionActive = true;
    this.sessionConfig = config;

    let resolveTermination!: () => void;
    this.sessionTerminationPromise = new Promise(r => { resolveTermination = r; });

    const activeSessionId = this.sessionId;
    const logPrefix = `[SessionRunner:${activeSessionId.slice(0, 8)}]`;

    try {
      // ── 构建 MCP 配置 ──
      const mcpAll = MCPConfigStore.getAll();
      const globalEnabledIds = new Set(MCPConfigStore.getEnabledIds());
      let mcpFiltered = mcpAll.filter((s) => globalEnabledIds.has(s.id));
      if (config.mcpEnabledServerIds !== undefined) {
        const workspaceSet = new Set(config.mcpEnabledServerIds);
        mcpFiltered = mcpFiltered.filter((s) => workspaceSet.has(s.id));
      }

      let mcpServers: Record<string, unknown> | undefined;
      if (mcpFiltered.length > 0) {
        mcpServers = {};
        for (const cfg of mcpFiltered) {
          // Skip MCP servers that require config but aren't configured yet
          if (cfg.requiresConfig?.length) {
            const serverEnv = MCPConfigStore.getServerEnv(cfg.id);
            const missing = cfg.requiresConfig.some((key) => !serverEnv[key]);
            if (missing) continue;
          }

          if (cfg.type === 'stdio') {
            const extraArgs = ConfigStore.readConfig().mcpServerArgs?.[cfg.id];
            const finalArgs = extraArgs?.length ? [...(cfg.args ?? []), ...extraArgs] : cfg.args;

            // Build MCP config with isolated env to prevent proxy interference.
            // The parent Sidecar may have HTTP_PROXY set (injected by Rust at spawn),
            // which leaks into MCP child processes and breaks localhost WebSocket connections
            // (e.g., playwright-core's ws transport to Chrome DevTools gets routed through proxy).
            const mcpEnv: Record<string, string> = {};
            if (cfg.env && Object.keys(cfg.env).length > 0) {
              Object.assign(mcpEnv, cfg.env);
            }
            // Strip proxy env vars from MCP subprocess
            for (const proxyVar of [
              'http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY',
              'ALL_PROXY', 'all_proxy',
            ]) {
              if (!(proxyVar in mcpEnv)) {
                mcpEnv[proxyVar] = '';
              }
            }

            mcpServers[cfg.id] = { type: 'stdio', command: cfg.command, args: finalArgs, env: mcpEnv };
          } else if (cfg.type === 'sse' || cfg.type === 'http') {
            // Expand URL templates like {{TAVILY_API_KEY}}
            let url = cfg.url ?? '';
            if (url.includes('{{')) {
              const serverEnv = MCPConfigStore.getServerEnv(cfg.id);
              url = url.replace(/\{\{(\w+)\}\}/g, (_, key) => serverEnv[key] ?? '');
            }
            mcpServers[cfg.id] = { type: cfg.type, url };
          }
        }
      }

      const resolvedPermissionMode = config.permissionMode;

      // ── 权限处理回调 ──
      const canUseTool = resolvedPermissionMode !== 'bypassPermissions'
        ? async (toolName: string, toolInput: Record<string, unknown>, { toolUseID, signal }: { toolUseID: string; signal?: AbortSignal }) => {
            if (toolName === 'AskUserQuestion') {
              const questionData = {
                toolUseId: toolUseID,
                questions: toolInput.questions as Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>,
              };
              this.pendingQuestionData.set(toolUseID, questionData);
              broadcast('question:request', {
                sessionId: activeSessionId,
                toolUseId: toolUseID,
                questions: toolInput.questions,
              });
              const answers = await new Promise<Record<string, string>>((resolve) => {
                const timeout = setTimeout(() => {
                  this.pendingQuestions.delete(toolUseID);
                  this.pendingQuestionData.delete(toolUseID);
                  resolve({});
                }, 120000);
                signal?.addEventListener('abort', () => {
                  clearTimeout(timeout);
                  this.pendingQuestions.delete(toolUseID);
                  this.pendingQuestionData.delete(toolUseID);
                  resolve({});
                });
                this.pendingQuestions.set(toolUseID, (ans: Record<string, string>) => {
                  clearTimeout(timeout);
                  this.pendingQuestions.delete(toolUseID);
                  this.pendingQuestionData.delete(toolUseID);
                  resolve(ans);
                });
              });
              return { behavior: 'allow' as const, updatedInput: { ...toolInput, answers } };
            }

            this.pendingPermissionData.set(toolUseID, { toolName, toolUseId: toolUseID, toolInput });
            broadcast('permission:request', { sessionId: activeSessionId, toolName, toolUseId: toolUseID, toolInput });
            const allowed = await new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => {
                this.pendingPermissions.delete(toolUseID);
                this.pendingPermissionData.delete(toolUseID);
                resolve(true);
              }, 30000);
              signal?.addEventListener('abort', () => {
                clearTimeout(timeout);
                this.pendingPermissions.delete(toolUseID);
                this.pendingPermissionData.delete(toolUseID);
                resolve(false);
              });
              this.pendingPermissions.set(toolUseID, (allow: boolean) => {
                clearTimeout(timeout);
                this.pendingPermissions.delete(toolUseID);
                this.pendingPermissionData.delete(toolUseID);
                resolve(allow);
              });
            });
            return allowed
              ? { behavior: 'allow' as const, updatedInput: toolInput }
              : { behavior: 'deny' as const, message: '用户拒绝' };
          }
        : undefined;

      console.log(`${logPrefix} Starting subprocess, cwd=${config.agentDir}, mode=${resolvedPermissionMode}, model=${config.model ?? 'default'}, provider=${config.providerEnv?.baseUrl ?? 'default(subscription)'}, resume=${this.sdkSessionId ? 'yes' : 'no'}`);

      // ── 创建 query（子进程在此启动）──
      const q = query({
        prompt: this.messageGenerator(),
        options: {
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          cwd: config.agentDir,
          systemPrompt: `当前工作目录为：${config.agentDir}\n所有创建、修改或写入的文件，必须放置在此目录或其子目录内，不得操作此目录之外的文件。`,
          permissionMode: resolvedPermissionMode,
          ...(resolvedPermissionMode === 'bypassPermissions'
            ? { allowDangerouslySkipPermissions: true } : {}),
          model: config.model,
          env: buildClaudeSessionEnv(config.providerEnv),
          pathToClaudeCodeExecutable: resolveClaudeCodeCli(),
          executable: 'bun',
          stderr: (message: string) => { console.error(`${logPrefix} SDK stderr: ${message}`); },
          settingSources: ['project'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mcpServers: mcpServers as any,
          includePartialMessages: true,
          resume: this.sdkSessionId ?? undefined,
          canUseTool,
        },
      });
      this.querySession = q;

      // ── 消费流事件（持久循环，直到 generator return 或 abort）──
      for await (const event of q) {
        this.handleStreamEvent(event as SDKMessage, activeSessionId);
      }

    } catch (err: unknown) {
      const e = err as Error;
      console.error(`${logPrefix} Error:`, err);
      if (e?.name !== 'AbortError') {
        broadcast('chat:message-error', { sessionId: activeSessionId, error: String(err) });
      }
      // 确保当前轮有 complete 事件
      if (this.isStreaming) {
        broadcast('chat:message-complete', { sessionId: activeSessionId });
        this.saveTurnAssistantContent(activeSessionId);
      }
    } finally {
      this.sessionActive = false;
      this.isStreaming = false;
      this.querySession = null;
      this.sessionConfig = null;

      // 清理阻塞的 gate
      if (this.messageResolver) {
        const resolve = this.messageResolver;
        this.messageResolver = null;
        resolve(null);
      }
      this.signalTurnComplete();

      // Drain：逐条广播 queue:cancelled
      this.drainMessageQueue();

      console.log(`${logPrefix} Subprocess terminated`);
      resolveTermination();
    }
  }

  /** 处理单个 SDK 流事件 */
  private handleStreamEvent(msg: SDKMessage, activeSessionId: string): void {
    const logTag = `[SessionRunner:${activeSessionId.slice(0, 8)}]`;

    if (msg.type === 'stream_event') {
      const streamEvent = msg.event as {
        type: string;
        delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
        content_block?: { type: string; name?: string; id?: string };
        message?: { model?: string; id?: string };
      };

      if (streamEvent.type === 'message_start' && streamEvent.message) {
        console.log(`${logTag} API responded with model: ${streamEvent.message.model}, msg_id: ${streamEvent.message.id}`);
        if (streamEvent.message.model) {
          this.turnUsage.model = streamEvent.message.model;
        }
      }

      if (streamEvent.type === 'content_block_delta') {
        const delta = streamEvent.delta;
        if (delta?.type === 'text_delta' && delta.text) {
          this.turnHasStreamedContent = true;
          this.turnAssistantContent += delta.text;
          broadcast('chat:message-chunk', { sessionId: activeSessionId, text: delta.text });
        } else if (delta?.type === 'thinking_delta' && delta.thinking) {
          broadcast('chat:thinking-chunk', { sessionId: activeSessionId, thinking: delta.thinking });
        } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
          broadcast('chat:tool-input-delta', { sessionId: activeSessionId, id: this.currentToolId, partial_json: delta.partial_json });
        }
      } else if (streamEvent.type === 'content_block_start') {
        const block = streamEvent.content_block;
        console.log(`${logTag} content_block_start: type=${block?.type}, name=${block?.name ?? '-'}, id=${block?.id ?? '-'}`);
        if (block?.type === 'tool_use') {
          this.currentToolId = block.id ?? '';
          this.turnToolCount++;
          broadcast('chat:tool-use-start', { sessionId: activeSessionId, name: block.name, id: block.id });
        }
      } else if (streamEvent.type === 'content_block_stop') {
        console.log(`${logTag} content_block_stop`);
      } else if (streamEvent.type === 'message_stop') {
        console.log(`${logTag} message_stop`);
      }
    } else if (msg.type === 'assistant') {
      const betaMsg = msg.message as { content: Array<{ type: string; text?: string }> };
      const blockTypes = betaMsg.content.map(b => b.type).join(',');
      console.log(`${logTag} assistant message: blocks=[${blockTypes}], streamed=${this.turnHasStreamedContent}`);
      for (const block of betaMsg.content) {
        if (block.type === 'text' && block.text) {
          if (!this.turnHasStreamedContent) {
            this.turnAssistantContent += block.text;
            broadcast('chat:message-chunk', { sessionId: activeSessionId, text: block.text });
            console.log(`${logTag} assistant fallback broadcast: ${block.text.length} chars`);
          }
        }
      }
    } else if (msg.type === 'user') {
      const userMsg = msg.message as { content: Array<{ type: string; tool_use_id?: string; content?: string; is_error?: boolean }> };
      const blockTypes = (userMsg.content ?? []).map(b => b.type).join(',');
      console.log(`${logTag} user message (tool results): blocks=[${blockTypes}]`);
      for (const block of userMsg.content ?? []) {
        if (block.type === 'tool_result') {
          broadcast('chat:tool-result', {
            sessionId: activeSessionId,
            id: block.tool_use_id ?? '',
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
            isError: block.is_error ?? false,
          });
        }
      }
    } else if (msg.type === 'result') {
      console.log(`${logTag} result event received, turnContent=${this.turnAssistantContent.length} chars`);
      // 提取 sdkSessionId 用于恢复，并持久化到 SessionStore
      if ((msg as SDKMessage & { session_id?: string }).session_id) {
        this.sdkSessionId = (msg as SDKMessage & { session_id?: string }).session_id!;
        SessionStore.saveSdkSessionId(activeSessionId, this.sdkSessionId!);
      }

      // 提取 token usage：优先 modelUsage（per-model），fallback usage（aggregate）
      const resultMsg = msg as SDKMessage & {
        usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
        modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }>;
      };

      if (resultMsg.modelUsage) {
        let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreation = 0;
        let primaryModel: string | undefined;
        let maxModelTokens = 0;
        const modelUsageMap: Record<string, import('../shared/types/session').ModelUsageEntry> = {};

        for (const [model, stats] of Object.entries(resultMsg.modelUsage) as [string, { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }][]) {
          const mi = stats.inputTokens ?? 0;
          const mo = stats.outputTokens ?? 0;
          const mcr = stats.cacheReadInputTokens ?? 0;
          const mcc = stats.cacheCreationInputTokens ?? 0;
          totalInput += mi; totalOutput += mo; totalCacheRead += mcr; totalCacheCreation += mcc;
          modelUsageMap[model] = { inputTokens: mi, outputTokens: mo, cacheReadTokens: mcr || undefined, cacheCreationTokens: mcc || undefined };
          const total = mi + mo;
          if (total > maxModelTokens) { maxModelTokens = total; primaryModel = model; }
        }
        this.turnUsage = { inputTokens: totalInput, outputTokens: totalOutput, cacheReadTokens: totalCacheRead, cacheCreationTokens: totalCacheCreation, model: primaryModel, modelUsage: modelUsageMap };
        console.log(`${logTag} Token usage from modelUsage: input=${totalInput}, output=${totalOutput}, models=${Object.keys(modelUsageMap).join(', ')}`);
      } else if (resultMsg.usage) {
        this.turnUsage.inputTokens = resultMsg.usage.input_tokens ?? 0;
        this.turnUsage.outputTokens = resultMsg.usage.output_tokens ?? 0;
        this.turnUsage.cacheReadTokens = resultMsg.usage.cache_read_input_tokens ?? 0;
        this.turnUsage.cacheCreationTokens = resultMsg.usage.cache_creation_input_tokens ?? 0;
        console.log(`${logTag} Token usage from usage: input=${this.turnUsage.inputTokens}, output=${this.turnUsage.outputTokens}`);
      }

      const durationMs = this.turnStartTime ? Date.now() - this.turnStartTime : undefined;

      // 保存助手消息（含 usage）并通知前端
      this.saveTurnAssistantContent(activeSessionId, durationMs);
      broadcast('chat:message-complete', {
        sessionId: activeSessionId,
        model: this.turnUsage.model,
        inputTokens: this.turnUsage.inputTokens,
        outputTokens: this.turnUsage.outputTokens,
        cacheReadTokens: this.turnUsage.cacheReadTokens,
        cacheCreationTokens: this.turnUsage.cacheCreationTokens,
        toolCount: this.turnToolCount,
        durationMs,
      });

      // 标记流式结束，解锁 generator 进入下一轮
      this.isStreaming = false;
      this.signalTurnComplete();
    } else {
      console.log(`${logTag} unhandled event type: ${msg.type}`);
    }
  }

  /** 保存当前轮的助手内容到 SessionStore */
  private saveTurnAssistantContent(sessionId: string, durationMs?: number): void {
    if (this.turnAssistantContent) {
      const hasUsage = this.turnUsage.inputTokens > 0 || this.turnUsage.outputTokens > 0;
      SessionStore.saveMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: this.turnAssistantContent,
        timestamp: new Date().toISOString(),
        ...(hasUsage ? {
          usage: {
            inputTokens: this.turnUsage.inputTokens,
            outputTokens: this.turnUsage.outputTokens,
            cacheReadTokens: this.turnUsage.cacheReadTokens || undefined,
            cacheCreationTokens: this.turnUsage.cacheCreationTokens || undefined,
            model: this.turnUsage.model,
            modelUsage: this.turnUsage.modelUsage,
          },
        } : {}),
        ...(this.turnToolCount > 0 ? { toolCount: this.turnToolCount } : {}),
        ...(durationMs ? { durationMs } : {}),
      });
      this.turnAssistantContent = '';
    }
  }

  // ── 配置变更检测 ──

  /** 检测是否需要重启会话 */
  private needsSessionRestart(providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode): boolean {
    const resolvedMode = permissionMode ?? 'acceptEdits';

    // Provider 变更
    const providerChanged =
      (providerEnv?.baseUrl ?? '') !== (this.providerEnv?.baseUrl ?? '') ||
      (providerEnv?.apiKey ?? '') !== (this.providerEnv?.apiKey ?? '') ||
      (providerEnv?.authType ?? '') !== (this.providerEnv?.authType ?? '') ||
      (providerEnv?.timeout ?? 0) !== (this.providerEnv?.timeout ?? 0) ||
      !!providerEnv?.disableNonessential !== !!this.providerEnv?.disableNonessential;

    // Model 变更
    const modelChanged = (model ?? '') !== (this.currentModel ?? '');

    // PermissionMode 变更
    const modeChanged = resolvedMode !== this.currentPermissionMode;

    if (providerChanged) {
      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] Provider changed, session restart required`);
      // Provider 切换不 resume（thinking block 签名不兼容）
      this.sdkSessionId = null;
    }
    if (modelChanged) {
      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] Model changed: ${this.currentModel} → ${model}, session restart required`);
    }
    if (modeChanged) {
      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] PermissionMode changed: ${this.currentPermissionMode} → ${resolvedMode}, session restart required`);
    }

    return providerChanged || modelChanged || modeChanged;
  }

  // ── 公共 API ──

  async sendMessage(text: string, agentDir: string, providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode, mcpEnabledServerIds?: string[], images?: ChatImage[]): Promise<{ ok: boolean; queued?: boolean; queueId?: string; error?: string }> {
    const activeSessionId = this.sessionId;
    const queueId = crypto.randomUUID();

    // 如果正在 streaming，排队而不是拒绝
    if (this.isStreaming) {
      if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
        return { ok: false, error: 'queue_full' };
      }

      // 构建 SDK 用户消息用于排队
      const sdkSid = this.sdkSessionId ?? crypto.randomUUID();
      const messageContent = this.buildMessageContent(text, images);
      const queueItem: QueueItem = {
        sdkMessage: {
          type: 'user' as const,
          message: messageContent,
          parent_tool_use_id: null,
          session_id: sdkSid,
        } as SDKUserMessage,
        text,
        queueId,
        wasQueued: true,
      };

      this.messageQueue.push(queueItem);
      broadcast('queue:added', { sessionId: activeSessionId, queueId, text });
      console.log(`[SessionRunner:${activeSessionId.slice(0, 8)}] Message queued (${this.messageQueue.length}/${MAX_QUEUE_SIZE}): "${text.slice(0, 50)}"`);
      return { ok: true, queued: true, queueId };
    }

    // 保存用户消息到 SessionStore
    SessionStore.saveMessage(activeSessionId, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    });

    // 检测是否需要重启
    const needsRestart = this.sessionActive && this.needsSessionRestart(providerEnv, model, permissionMode);
    if (needsRestart) {
      this.abortSession();
      if (this.sessionTerminationPromise) {
        await this.sessionTerminationPromise;
      }
    }

    // 更新配置快照
    this.providerEnv = providerEnv;
    this.currentModel = model;
    this.currentPermissionMode = permissionMode ?? 'acceptEdits';

    const resolvedMode = permissionMode ?? 'acceptEdits';

    console.log(`[SessionRunner:${activeSessionId.slice(0, 8)}] sendMessage: "${text.slice(0, 50)}" in ${agentDir}, mode: ${resolvedMode}, model: ${model ?? 'default'}, provider: ${providerEnv?.baseUrl ?? 'default(subscription)'}, authType: ${providerEnv?.authType ?? 'N/A'}, apiKey: ${providerEnv?.apiKey ? '***' + providerEnv.apiKey.slice(-4) : 'none'}, images: ${images?.length ?? 0}, sessionActive: ${this.sessionActive}`);

    // 构建 SDK 用户消息
    if (!this.sdkSessionId) {
      this.sdkSessionId = SessionStore.getSdkSessionId(activeSessionId) ?? null;
    }
    const sdkSid = this.sdkSessionId ?? crypto.randomUUID();
    const messageContent = this.buildMessageContent(text, images);

    const queueItem: QueueItem = {
      sdkMessage: {
        type: 'user' as const,
        message: messageContent,
        parent_tool_use_id: null,
        session_id: sdkSid,
      } as SDKUserMessage,
      text,
      queueId,
      wasQueued: false,
    };

    // 启动会话（如果未运行）
    if (!this.sessionActive) {
      const config: SessionConfig = {
        agentDir,
        providerEnv,
        model,
        permissionMode: resolvedMode,
        mcpEnabledServerIds,
      };
      // 先投递消息，再启动会话（确保 generator 能立即取到）
      this.wakeGenerator(queueItem);
      this.startSession(config);
    } else {
      // 会话已运行，直接投递
      this.wakeGenerator(queueItem);
    }

    return { ok: true, queued: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildMessageContent(text: string, images?: ChatImage[]): { role: 'user'; content: any } {
    if (images && images.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlocks: any[] = [];
      if (text) {
        contentBlocks.push({ type: 'text', text });
      }
      for (const img of images) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.data },
        });
      }
      return { role: 'user' as const, content: contentBlocks };
    }
    return { role: 'user' as const, content: text };
  }

  cancelQueueItem(queueId: string): { ok: boolean; text?: string } {
    const idx = this.messageQueue.findIndex((item) => item.queueId === queueId);
    if (idx === -1) return { ok: false };
    const [removed] = this.messageQueue.splice(idx, 1);
    broadcast('queue:cancelled', { sessionId: this.sessionId, queueId });
    console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] Queue item cancelled: "${removed.text.slice(0, 50)}"`);
    return { ok: true, text: removed.text };
  }

  forceExecuteQueueItem(queueId: string): boolean {
    const idx = this.messageQueue.findIndex((item) => item.queueId === queueId);
    if (idx === -1) return false;
    // 移到队首
    const [item] = this.messageQueue.splice(idx, 1);
    this.messageQueue.unshift(item);
    // 中断当前回复
    if (this.querySession) {
      this.querySession.interrupt().catch(() => {});
    }
    console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] Force executing queue item: "${item.text.slice(0, 50)}"`);
    return true;
  }

  getQueueStatus(): { queueId: string; text: string }[] {
    return this.messageQueue
      .filter((item) => item.wasQueued)
      .map((item) => ({ queueId: item.queueId, text: item.text }));
  }

  stop(): void {
    this.abortSession();
  }

  respondPermission(toolUseId: string, allow: boolean): boolean {
    const resolve = this.pendingPermissions.get(toolUseId);
    if (resolve) {
      this.pendingPermissionData.delete(toolUseId);
      resolve(allow);
      return true;
    }
    return false;
  }

  respondQuestion(toolUseId: string, answers: Record<string, string>): boolean {
    const resolve = this.pendingQuestions.get(toolUseId);
    if (resolve) {
      this.pendingQuestionData.delete(toolUseId);
      resolve(answers);
      return true;
    }
    return false;
  }

  getPendingState(): {
    permission: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> } | null;
    question: { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> } | null;
  } {
    const permission = this.pendingPermissionData.size > 0
      ? this.pendingPermissionData.values().next().value ?? null
      : null;
    const question = this.pendingQuestionData.size > 0
      ? this.pendingQuestionData.values().next().value ?? null
      : null;
    return { permission, question };
  }
}

// ── 模块级单 Runner 管理（每个 Sidecar 只服务一个 Session）──

let runner: SessionRunner | null = null;
let currentSessionId: string | null = null;

export function getOrCreateRunner(sid: string): SessionRunner {
  if (runner && currentSessionId === sid) return runner;
  // 如果之前有不同 session 的 runner，先停掉
  if (runner && currentSessionId !== sid) {
    runner.stop();
  }
  runner = new SessionRunner(sid);
  currentSessionId = sid;
  return runner;
}

export function getRunner(): SessionRunner | null {
  return runner;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

export function resetState(): void {
  if (runner) {
    runner.stop();
  }
  runner = null;
  currentSessionId = null;
}

export function removeRunner(): void {
  if (runner) {
    runner.stop();
    runner = null;
    currentSessionId = null;
  }
}

export function isRunning(): boolean {
  return runner?.getIsRunning() ?? false;
}

/**
 * Hot-reload proxy configuration into the current process environment.
 * Mutates process.env so that subsequent SDK subprocess spawns inherit the new proxy.
 * Triggers session restart when the effective proxy URL actually changed.
 */
export function setProxyConfig(proxySettings: {
  enabled: boolean;
  protocol?: string;
  host?: string;
  port?: number;
} | null): void {
  const PROXY_VARS = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
  const NO_PROXY_VAL = 'localhost,localhost.localdomain,127.0.0.1,127.0.0.0/8,::1,[::1]';

  // Compute the new effective proxy URL for change detection
  const oldProxyUrl = process.env.HTTP_PROXY || '';
  const newProxyUrl = proxySettings?.enabled
    ? `${proxySettings.protocol || 'http'}://${proxySettings.host || '127.0.0.1'}:${proxySettings.port || 7890}`
    : '';
  const proxyChanged = oldProxyUrl !== newProxyUrl;

  if (proxySettings?.enabled) {
    process.env.HTTP_PROXY = newProxyUrl;
    process.env.HTTPS_PROXY = newProxyUrl;
    process.env.http_proxy = newProxyUrl;
    process.env.https_proxy = newProxyUrl;
    process.env.NO_PROXY = NO_PROXY_VAL;
    process.env.no_proxy = NO_PROXY_VAL;
    delete process.env.ALL_PROXY;
    delete process.env.all_proxy;
    console.log(`[agent] Proxy hot-reloaded: ${newProxyUrl}`);
  } else {
    for (const v of PROXY_VARS) delete process.env[v];
    console.log('[agent] Proxy cleared (direct connection)');
  }

  if (!proxyChanged) {
    console.log('[agent] Proxy config unchanged, skipping session restart');
    return;
  }

  // Restart running session so new subprocess picks up the new proxy env
  if (runner) {
    console.log('[agent] Proxy changed, restarting session');
    runner.stop();
  }
}

export function getPendingState() {
  return runner?.getPendingState() ?? { permission: null, question: null };
}
