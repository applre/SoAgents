import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { broadcast } from './sse';
import crypto from 'crypto';
import * as SessionStore from './SessionStore';
import * as MCPConfigStore from './MCPConfigStore';
import type { SessionMetadata, SessionMessage } from '../shared/types/session';
import type { ProviderEnv, ProviderAuthType } from '../shared/types/config';
import type { PermissionMode } from '../shared/types/permission';

function buildClaudeSessionEnv(providerEnv?: ProviderEnv): Record<string, string | undefined> {
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

  // 3. 不通过环境变量传 model（改用 options.model）
  delete env.ANTHROPIC_MODEL;

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

  async sendMessage(text: string, agentDir: string, providerEnv?: ProviderEnv, model?: string, permissionMode?: PermissionMode): Promise<void> {
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

    // 检测 provider 切换（仅比较 baseUrl 和 apiKey，model 切换不算 provider 切换）
    const providerChanged =
      (providerEnv?.baseUrl ?? '') !== (this.currentProviderEnv?.baseUrl ?? '') ||
      (providerEnv?.apiKey ?? '') !== (this.currentProviderEnv?.apiKey ?? '');
    if (providerChanged) {
      // 任何 Provider 切换都不 resume（thinking block 签名不兼容）
      this.sdkSessionId = null;
      this.currentProviderEnv = providerEnv;
    }

    this.isRunning = true;
    let assistantContent = '';

    try {
      const mcpAll = MCPConfigStore.getAll();
      let mcpServers: Record<string, unknown> | undefined;
      if (Object.keys(mcpAll).length > 0) {
        mcpServers = {};
        for (const [id, cfg] of Object.entries(mcpAll)) {
          if (cfg.type === 'stdio') {
            mcpServers[id] = { type: 'stdio', command: cfg.command, args: cfg.args, env: cfg.env };
          } else if (cfg.type === 'sse') {
            mcpServers[id] = { type: 'sse', url: cfg.url };
          } else {
            mcpServers[id] = { type: 'http', url: cfg.url };
          }
        }
      }
      const resolvedPermissionMode = permissionMode ?? 'acceptEdits';

      console.log(`[AgentSession] Starting query for: "${text}" in ${agentDir}, mode: ${resolvedPermissionMode}`);

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

      const q = query({
        prompt: text,
        options: {
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          cwd: agentDir,
          systemPrompt: `当前工作目录为：${agentDir}\n所有创建、修改或写入的文件，必须放置在此目录或其子目录内，不得操作此目录之外的文件。`,
          permissionMode: resolvedPermissionMode,
          ...(resolvedPermissionMode === 'bypassPermissions'
            ? { allowDangerouslySkipPermissions: true } : {}),
          model,
          env: buildClaudeSessionEnv(providerEnv),
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
          const streamEvent = msg.event as { type: string; delta?: { type: string; text?: string; thinking?: string; partial_json?: string }; content_block?: { type: string; name?: string; id?: string } };

          if (streamEvent.type === 'content_block_delta') {
            const delta = streamEvent.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              hasStreamedContent = true;
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
          // full assistant message — accumulate for storage; if no streaming, also broadcast
          const betaMsg = msg.message as { content: Array<{ type: string; text?: string }> };
          for (const block of betaMsg.content) {
            if (block.type === 'text' && block.text) {
              assistantContent += block.text;
              if (!hasStreamedContent) {
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
      if (assistantContent) {
        const assistantMsgId = crypto.randomUUID();
        this.messages.push({
          id: assistantMsgId,
          role: 'assistant',
          content: assistantContent,
          createdAt: Date.now(),
        });
        // 保存 assistant 消息到 SessionStore
        if (this.currentSessionId) {
          SessionStore.saveMessage(this.currentSessionId, {
            id: assistantMsgId,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString(),
          });
        }
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

  loadSession(sessionId: string): void {
    this.stop();
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
