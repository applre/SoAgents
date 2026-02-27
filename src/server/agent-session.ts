import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { broadcast } from './sse';
import crypto from 'crypto';
import * as SessionStore from './SessionStore';
import * as MCPConfigStore from './MCPConfigStore';
import { resolveClaudeCodeCli } from './provider-verify';
import type { SessionMetadata, SessionMessage } from '../shared/types/session';
import type { ProviderEnv, ProviderAuthType } from '../shared/types/config';
import type { PermissionMode } from '../shared/types/permission';

interface ChatImage {
  name: string;
  mimeType: string;
  data: string; // 纯 base64
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

  return env;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

class AgentSession {
  private sessionId: string = crypto.randomUUID();
  private messages: StoredMessage[] = [];
  private isRunning = false;
  private currentQuery: ReturnType<typeof query> | null = null;
  private pendingPermissions = new Map<string, (allow: boolean) => void>();
  private pendingQuestions = new Map<string, (answers: Record<string, string>) => void>();
  private sdkSessionId: string | null = null;
  private currentSessionId: string | null = null;
  private currentProviderEnv: ProviderEnv | undefined = undefined;
  // sendMessage 完成时 resolve，loadSession 用来等待进行中的 query 结束
  private queryDonePromise: Promise<void> | null = null;
  private queryDoneResolve: (() => void) | null = null;

  async sendMessage(text: string, agentDir: string, providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode, mcpEnabledServerIds?: string[], images?: ChatImage[]): Promise<void> {
    if (this.isRunning) return;

    // 如果没有当前 session，创建一个新的
    if (this.currentSessionId === null) {
      const session = SessionStore.createSession(agentDir, text.slice(0, 50));
      this.currentSessionId = session.id;
    }

    const userMsgId = crypto.randomUUID();
    const userTimestamp = new Date().toISOString();

    // 保存用户消息到 SessionStore
    SessionStore.saveMessage(this.currentSessionId, {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: userTimestamp,
    });

    this.messages.push({
      id: userMsgId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    });

    // 检测 provider 连接配置切换（model 切换不算 provider 切换）
    const providerChanged =
      (providerEnv?.baseUrl ?? '') !== (this.currentProviderEnv?.baseUrl ?? '') ||
      (providerEnv?.apiKey ?? '') !== (this.currentProviderEnv?.apiKey ?? '') ||
      (providerEnv?.authType ?? '') !== (this.currentProviderEnv?.authType ?? '') ||
      (providerEnv?.timeout ?? 0) !== (this.currentProviderEnv?.timeout ?? 0) ||
      !!providerEnv?.disableNonessential !== !!this.currentProviderEnv?.disableNonessential;
    if (providerChanged) {
      // 任何 Provider 切换都不 resume（thinking block 签名不兼容）
      this.sdkSessionId = null;
      this.currentProviderEnv = providerEnv;
    }

    this.isRunning = true;
    let assistantContent = '';
    // 捕获当前 session ID，防止 loadSession 切换后 finally 保存到错误的 session
    const activeSessionId = this.currentSessionId;
    // 设置 queryDone promise，让 loadSession 能等待当前 query 完成
    this.queryDonePromise = new Promise<void>((resolve) => { this.queryDoneResolve = resolve; });

    try {
      const mcpAll = MCPConfigStore.getAll();
      const globalEnabledIds = new Set(MCPConfigStore.getEnabledIds());

      // 双层过滤：全局启用 ∩ 工作区启用
      let mcpFiltered = mcpAll.filter((s) => globalEnabledIds.has(s.id));
      if (mcpEnabledServerIds !== undefined) {
        const workspaceSet = new Set(mcpEnabledServerIds);
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
      const resolvedPermissionMode = permissionMode ?? 'acceptEdits';

      console.log(`[AgentSession] Starting query for: "${text}" in ${agentDir}, mode: ${resolvedPermissionMode}, model: ${model ?? 'default'}, provider: ${providerEnv?.baseUrl ?? 'default(subscription)'}, authType: ${providerEnv?.authType ?? 'N/A'}, apiKey: ${providerEnv?.apiKey ? '***' + providerEnv.apiKey.slice(-4) : 'none'}, images: ${images?.length ?? 0}`);

      const canUseTool = resolvedPermissionMode !== 'bypassPermissions'
        ? async (toolName: string, toolInput: Record<string, unknown>, { toolUseID, signal }: { toolUseID: string; signal?: AbortSignal }) => {
            // AskUserQuestion 拦截 — 广播给前端，等待用户回答
            if (toolName === 'AskUserQuestion') {
              broadcast('question:request', {
                toolUseId: toolUseID,
                questions: toolInput.questions,
              });
              const answers = await new Promise<Record<string, string>>((resolve) => {
                const timeout = setTimeout(() => {
                  this.pendingQuestions.delete(toolUseID);
                  resolve({});
                }, 120000);
                signal?.addEventListener('abort', () => {
                  clearTimeout(timeout);
                  this.pendingQuestions.delete(toolUseID);
                  resolve({});
                });
                this.pendingQuestions.set(toolUseID, (ans: Record<string, string>) => {
                  clearTimeout(timeout);
                  this.pendingQuestions.delete(toolUseID);
                  resolve(ans);
                });
              });
              return { behavior: 'allow' as const, updatedInput: { ...toolInput, answers } };
            }

            broadcast('permission:request', { toolName, toolUseId: toolUseID, toolInput });
            const allowed = await new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => {
                this.pendingPermissions.delete(toolUseID);
                resolve(true);
              }, 30000);
              signal?.addEventListener('abort', () => {
                clearTimeout(timeout);
                this.pendingPermissions.delete(toolUseID);
                resolve(false);
              });
              this.pendingPermissions.set(toolUseID, (allow: boolean) => {
                clearTimeout(timeout);
                this.pendingPermissions.delete(toolUseID);
                resolve(allow);
              });
            });
            return allowed
              ? { behavior: 'allow' as const, updatedInput: toolInput }
              : { behavior: 'deny' as const, message: '用户拒绝' };
          }
        : undefined;

      // 构建 prompt：有图片时使用多模态 AsyncIterable<SDKUserMessage>，否则纯文本
      let prompt: string | AsyncIterable<SDKUserMessage>;
      if (images && images.length > 0) {
        const sessionId = this.sdkSessionId ?? crypto.randomUUID();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentBlocks: any[] = [];
        // 用户文本优先（session 标题取前 50 字符）
        if (text) {
          contentBlocks.push({ type: 'text', text });
        }
        for (const img of images) {
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: img.mimeType, data: img.data },
          });
        }
        prompt = (async function* () {
          yield {
            type: 'user' as const,
            message: { role: 'user' as const, content: contentBlocks },
            parent_tool_use_id: null,
            session_id: sessionId,
          } as SDKUserMessage;
        })();
      } else {
        prompt = text;
      }

      const q = query({
        prompt,
        options: {
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          cwd: agentDir,
          systemPrompt: `当前工作目录为：${agentDir}\n所有创建、修改或写入的文件，必须放置在此目录或其子目录内，不得操作此目录之外的文件。`,
          permissionMode: resolvedPermissionMode,
          ...(resolvedPermissionMode === 'bypassPermissions'
            ? { allowDangerouslySkipPermissions: true } : {}),
          model,
          env: buildClaudeSessionEnv(providerEnv),
          // 指定 CLI 路径和运行时，防止 SDK 使用全局安装的 CLI（可能携带 OAuth 凭证）
          pathToClaudeCodeExecutable: resolveClaudeCodeCli(),
          executable: 'bun',
          stderr: (message: string) => { console.error(`[AgentSession] SDK stderr: ${message}`); },
          // 仅用 project 级 settings，不读 ~/.claude/ 用户配置
          // 避免 OAuth 凭证覆盖 env 传入的第三方 provider 配置
          settingSources: ['project'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mcpServers: mcpServers as any,
          includePartialMessages: true,
          resume: this.sdkSessionId ?? undefined,
          canUseTool,
        },
      });
      this.currentQuery = q;

      let hasStreamedContent = false;
      let currentToolId = '';

      for await (const event of q) {
        const msg = event as SDKMessage;

        if (msg.type === 'stream_event') {
          // streaming chunks — broadcast only, don't accumulate (assistant msg handles storage)
          const streamEvent = msg.event as { type: string; delta?: { type: string; text?: string; thinking?: string; partial_json?: string }; content_block?: { type: string; name?: string; id?: string }; message?: { model?: string; id?: string } };

          // 捕获 message_start 中的实际模型名
          if (streamEvent.type === 'message_start' && streamEvent.message) {
            console.log(`[AgentSession] API responded with model: ${streamEvent.message.model}, msg_id: ${streamEvent.message.id}`);
          }

          if (streamEvent.type === 'content_block_delta') {
            const delta = streamEvent.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              hasStreamedContent = true;
              assistantContent += delta.text;
              broadcast('chat:message-chunk', { text: delta.text });
            } else if (delta?.type === 'thinking_delta' && delta.thinking) {
              broadcast('chat:thinking-chunk', { thinking: delta.thinking });
            } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
              broadcast('chat:tool-input-delta', { id: currentToolId, partial_json: delta.partial_json });
            }
          } else if (streamEvent.type === 'content_block_start') {
            const block = streamEvent.content_block;
            if (block?.type === 'tool_use') {
              currentToolId = block.id ?? '';
              broadcast('chat:tool-use-start', { name: block.name, id: block.id });
            }
          }
        } else if (msg.type === 'assistant') {
          // full assistant message — 仅在无 streaming 时才累加（streaming 已在 delta 中累加）
          const betaMsg = msg.message as { content: Array<{ type: string; text?: string }> };
          for (const block of betaMsg.content) {
            if (block.type === 'text' && block.text) {
              if (!hasStreamedContent) {
                assistantContent += block.text;
                broadcast('chat:message-chunk', { text: block.text });
              }
            }
          }
        } else if (msg.type === 'user') {
          const userMsg = msg.message as { content: Array<{ type: string; tool_use_id?: string; content?: string; is_error?: boolean }> };
          for (const block of userMsg.content ?? []) {
            if (block.type === 'tool_result') {
              broadcast('chat:tool-result', {
                id: block.tool_use_id ?? '',
                content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                isError: block.is_error ?? false,
              });
            }
          }
        } else if (msg.type === 'result') {
          // 提取 sdkSessionId
          if ((msg as SDKMessage & { session_id?: string }).session_id) {
            this.sdkSessionId = (msg as SDKMessage & { session_id?: string }).session_id!;
          }
          broadcast('chat:message-complete', null);
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error('[AgentSession] Error:', err);
      if (e?.name !== 'AbortError') {
        broadcast('chat:message-error', { error: String(err) });
      }
      broadcast('chat:message-complete', null);
    } finally {
      this.isRunning = false;
      this.currentQuery = null;
      if (assistantContent && activeSessionId) {
        const assistantMsgId = crypto.randomUUID();
        const assistantMsg: StoredMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: assistantContent,
          createdAt: Date.now(),
        };
        // 始终保存到正确的 session（用捕获的 activeSessionId）
        SessionStore.saveMessage(activeSessionId, {
          id: assistantMsgId,
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
        });
        // 仅在没有切换 session 时更新内存消息列表
        if (this.currentSessionId === activeSessionId) {
          this.messages.push(assistantMsg);
        }
      }
      // 通知等待者 query 已完成
      if (this.queryDoneResolve) {
        this.queryDoneResolve();
        this.queryDoneResolve = null;
        this.queryDonePromise = null;
      }
    }
  }

  respondPermission(toolUseId: string, allow: boolean): void {
    const resolve = this.pendingPermissions.get(toolUseId);
    if (resolve) resolve(allow);
  }

  respondQuestion(toolUseId: string, answers: Record<string, string>): void {
    const resolve = this.pendingQuestions.get(toolUseId);
    if (resolve) resolve(answers);
  }

  stop(): void {
    if (this.currentQuery) {
      this.currentQuery.interrupt().catch(() => {});
    }
  }

  reset(): void {
    this.stop();
    this.messages = [];
    this.sessionId = crypto.randomUUID();
    this.isRunning = false;
    this.currentQuery = null;
    this.currentSessionId = null;
    this.sdkSessionId = null;
  }

  async loadSession(sessionId: string): Promise<void> {
    // 先中断进行中的 query，等其 finally 完成保存后再切换
    if (this.isRunning) {
      this.stop();
      if (this.queryDonePromise) {
        await this.queryDonePromise;
      }
    }
    this.isRunning = false;
    this.currentSessionId = sessionId;
    this.sdkSessionId = null;
    const storedMessages = SessionStore.getSessionMessages(sessionId);
    this.messages = storedMessages.map((m: SessionMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.timestamp).getTime(),
    }));
    SessionStore.touchSession(sessionId);
  }

  getSessions(): SessionMetadata[] {
    return SessionStore.listSessions();
  }

  getCurrentMessages(): StoredMessage[] {
    return this.messages;
  }

  getState() {
    return { sessionId: this.sessionId, isRunning: this.isRunning };
  }

  getMessages() {
    return this.messages;
  }
}

export const agentSession = new AgentSession();
