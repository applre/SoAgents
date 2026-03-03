import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { broadcast } from './sse';
import crypto from 'crypto';
import * as SessionStore from './SessionStore';
import * as MCPConfigStore from './MCPConfigStore';
import { resolveClaudeCodeCli } from './provider-verify';
import type { ProviderEnv, ProviderAuthType } from '../shared/types/config';
import type { PermissionMode } from '../shared/types/permission';

interface ChatImage {
  name: string;
  mimeType: string;
  data: string; // 纯 base64
}

/** 消息队列项 */
interface QueueItem {
  sdkMessage: SDKUserMessage;
  text: string; // 用于日志和持久化
}

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

  // 6. OpenAI 协议桥接 — TODO: 需要移植 openai-bridge 模块实现回环翻译
  // 目前仅记录日志，实际 bridge 功能待后续实现
  if (providerEnv?.apiProtocol === 'openai') {
    console.warn('[env] apiProtocol=openai detected but bridge not yet implemented');
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

      // 重置每轮状态
      this.turnAssistantContent = '';
      this.turnHasStreamedContent = false;
      this.currentToolId = '';
      this.isStreaming = true;

      console.log(`[SessionRunner:${this.sessionId.slice(0, 8)}] messageGenerator yielding message: "${item.text.slice(0, 50)}"`);
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
          if (cfg.type === 'stdio') {
            mcpServers[cfg.id] = { type: 'stdio', command: cfg.command, args: cfg.args, env: cfg.env };
          } else if (cfg.type === 'sse') {
            mcpServers[cfg.id] = { type: 'sse', url: cfg.url };
          } else {
            mcpServers[cfg.id] = { type: 'http', url: cfg.url };
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

      // 清空队列中未处理的消息
      this.messageQueue.length = 0;

      console.log(`${logPrefix} Subprocess terminated`);
      resolveTermination();
    }
  }

  /** 处理单个 SDK 流事件 */
  private handleStreamEvent(msg: SDKMessage, activeSessionId: string): void {
    if (msg.type === 'stream_event') {
      const streamEvent = msg.event as {
        type: string;
        delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
        content_block?: { type: string; name?: string; id?: string };
        message?: { model?: string; id?: string };
      };

      if (streamEvent.type === 'message_start' && streamEvent.message) {
        console.log(`[SessionRunner:${activeSessionId.slice(0, 8)}] API responded with model: ${streamEvent.message.model}, msg_id: ${streamEvent.message.id}`);
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
        if (block?.type === 'tool_use') {
          this.currentToolId = block.id ?? '';
          broadcast('chat:tool-use-start', { sessionId: activeSessionId, name: block.name, id: block.id });
        }
      }
    } else if (msg.type === 'assistant') {
      const betaMsg = msg.message as { content: Array<{ type: string; text?: string }> };
      for (const block of betaMsg.content) {
        if (block.type === 'text' && block.text) {
          if (!this.turnHasStreamedContent) {
            this.turnAssistantContent += block.text;
            broadcast('chat:message-chunk', { sessionId: activeSessionId, text: block.text });
          }
        }
      }
    } else if (msg.type === 'user') {
      const userMsg = msg.message as { content: Array<{ type: string; tool_use_id?: string; content?: string; is_error?: boolean }> };
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
      // 提取 sdkSessionId 用于恢复
      if ((msg as SDKMessage & { session_id?: string }).session_id) {
        this.sdkSessionId = (msg as SDKMessage & { session_id?: string }).session_id!;
      }

      // 保存助手消息并通知前端
      this.saveTurnAssistantContent(activeSessionId);
      broadcast('chat:message-complete', { sessionId: activeSessionId });

      // 标记流式结束，解锁 generator 进入下一轮
      this.isStreaming = false;
      this.signalTurnComplete();
    }
  }

  /** 保存当前轮的助手内容到 SessionStore */
  private saveTurnAssistantContent(sessionId: string): void {
    if (this.turnAssistantContent) {
      SessionStore.saveMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: this.turnAssistantContent,
        timestamp: new Date().toISOString(),
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

  async sendMessage(text: string, agentDir: string, providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode, mcpEnabledServerIds?: string[], images?: ChatImage[]): Promise<void> {
    // 如果正在 streaming，拒绝新消息（保持当前语义）
    if (this.isStreaming) return;

    const activeSessionId = this.sessionId;

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
    // generator 模式下 message 必须是 MessageParam 对象（不能是裸字符串）
    const sdkSid = this.sdkSessionId ?? crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let messageContent: { role: 'user'; content: any };

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
      messageContent = { role: 'user' as const, content: contentBlocks };
    } else {
      messageContent = { role: 'user' as const, content: text };
    }

    const queueItem: QueueItem = {
      sdkMessage: {
        type: 'user' as const,
        message: messageContent,
        parent_tool_use_id: null,
        session_id: sdkSid,
      } as SDKUserMessage,
      text,
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

export function getPendingState() {
  return runner?.getPendingState() ?? { permission: null, question: null };
}
