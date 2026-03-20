/**
 * Provider verification via SDK
 * 通过真实 SDK 对话验证 API Key，确保验证路径 = 使用路径
 */

import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const requireModule = createRequire(import.meta.url);
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildClaudeSessionEnv } from './agent-session';
import type { ProviderAuthType } from '../shared/types/config';

// ── Subscription types ──

export interface SubscriptionInfo {
  accountUuid?: string;
  email?: string;
  displayName?: string;
  organizationName?: string;
}

export interface SubscriptionStatus {
  available: boolean;
  path?: string;
  info?: SubscriptionInfo;
}

/**
 * 解析 Claude Code CLI 路径
 */
export function resolveClaudeCodeCli(): string {
  const t0 = Date.now();
  // Check bundled path FIRST to avoid bun's auto-install behavior.
  // In production builds, require.resolve() can't find the SDK in node_modules
  // (it doesn't exist in the app bundle). Bun then attempts to auto-install
  // the package from npm, which blocks the event loop for 10+ minutes.
  // By checking the bundled path first, we skip the costly require.resolve entirely.
  const cwd = process.cwd();
  const bundledPath = join(cwd, 'claude-agent-sdk', 'cli.js');
  if (existsSync(bundledPath)) {
    console.log(`[sdk] CLI resolved via bundled path in ${Date.now() - t0}ms: ${bundledPath}`);
    return bundledPath;
  }
  console.warn(`[sdk] Bundled SDK not found at ${bundledPath} (cwd=${cwd}), falling back to require.resolve`);

  // Development: resolve from node_modules
  try {
    const cliPath = requireModule.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
    console.log(`[sdk] CLI resolved via require.resolve in ${Date.now() - t0}ms: ${cliPath}`);
    return cliPath;
  } catch (error) {
    console.error(`[sdk] CLI resolve FAILED in ${Date.now() - t0}ms. Bundled: ${bundledPath}, cwd: ${cwd}`, error);
    throw error;
  }
}

// Subscription 验证错误解析
function parseSubscriptionError(errorText: string): string {
  if (errorText.includes('authentication') || errorText.includes('login') || errorText.includes('/login')) {
    return '登录已过期，请重新登录 (claude --login)';
  } else if (errorText.includes('forbidden') || errorText.includes('403')) {
    return '登录已过期，请重新登录 (claude --login)';
  } else if (errorText.includes('rate limit') || errorText.includes('429')) {
    return '请求频率限制，请稍后再试';
  } else if (errorText.includes('network') || errorText.includes('connect')) {
    return '网络连接失败';
  }
  return errorText.slice(0, 100) || '验证失败';
}

// Provider 验证错误解析
function parseProviderError(errorText: string): string {
  const text = errorText.toLowerCase();
  if (text.includes('authentication') || text.includes('unauthorized') || text.includes('401')) {
    return 'API Key 无效或已过期';
  } else if (text.includes('forbidden') || text.includes('403')) {
    return '访问被拒绝，请检查 API Key 权限';
  } else if (text.includes('rate limit') || text.includes('429')) {
    return '请求频率限制，请稍后再试';
  } else if (text.includes('network') || text.includes('connect') || text.includes('econnrefused')) {
    return '网络连接失败，请检查 Base URL';
  } else if (text.includes('not found') || text.includes('404')) {
    return '模型不存在或 API 地址错误';
  }
  return errorText.slice(0, 100) || '验证失败';
}

/**
 * SDK 验证核心：启动 SDK 子进程发送一条测试消息
 */
async function verifyViaSdk(
  env: NodeJS.ProcessEnv,
  opts: {
    model?: string;
    sessionId: string;
    logPrefix: string;
    parseError: (text: string) => string;
    settingSources: ('user' | 'project')[];
  },
): Promise<{ success: boolean; error?: string }> {
  const TIMEOUT_MS = 30000;
  const startTime = Date.now();
  const stderrMessages: string[] = [];
  const { logPrefix, parseError } = opts;

  try {
    const cliPath = resolveClaudeCodeCli();
    // 使用 ~/.soagents/projects/ 作为 cwd，避免权限和 .claude/ 配置问题
    const cwd = join(homedir(), '.soagents', 'projects');
    mkdirSync(cwd, { recursive: true });

    async function* simplePrompt() {
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content: 'It\'s a test, directly reply "1"' },
        parent_tool_use_id: null,
        session_id: opts.sessionId,
      };
    }

    const testQuery = query({
      prompt: simplePrompt(),
      options: {
        maxTurns: 1,
        sessionId: opts.sessionId,
        cwd,
        settingSources: opts.settingSources,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        pathToClaudeCodeExecutable: cliPath,
        executable: 'bun',
        env,
        stderr: (message: string) => {
          console.error(`[${logPrefix}] stderr:`, message);
          stderrMessages.push(message);
        },
        systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const },
        includePartialMessages: true,
        persistSession: false,
        mcpServers: {},
        ...(opts.model ? { model: opts.model } : {}),
      },
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
      timeoutId = setTimeout(() => {
        const stderrHint = stderrMessages.length > 0
          ? ` (stderr: ${stderrMessages.join('; ').slice(0, 200)})`
          : '';
        resolve({ success: false, error: `验证超时，请检查网络连接${stderrHint}` });
      }, TIMEOUT_MS);
    });

    const verifyPromise = (async (): Promise<{ success: boolean; error?: string }> => {
      for await (const message of testQuery) {
        if (message.type === 'system') continue;

        // stream_event 中的 message_start 表示 API 接受了请求，验证成功
        if (message.type === 'stream_event') {
          const streamMsg = message as { event?: { type?: string } };
          if (streamMsg.event?.type === 'message_start') {
            const elapsed = Date.now() - startTime;
            console.log(`[${logPrefix}] verification successful (${elapsed}ms)`);
            return { success: true };
          }
          continue;
        }

        // assistant 消息：先检查 SDK 包装的错误（API 返回 403/401 时 SDK 会包装成带 error 字段的 assistant 消息）
        if (message.type === 'assistant') {
          const assistantMsg = message as { error?: string; message?: { content?: Array<{ text?: string }> } };
          if (assistantMsg.error) {
            const errorDetail = assistantMsg.message?.content?.[0]?.text ?? assistantMsg.error;
            console.error(`[${logPrefix}] auth error: ${errorDetail}`);
            return { success: false, error: parseError(errorDetail.toLowerCase()) };
          }
          const elapsed = Date.now() - startTime;
          console.log(`[${logPrefix}] verification successful (${elapsed}ms)`);
          return { success: true };
        }

        if (message.type === 'result') {
          const resultMsg = message as { subtype?: string; errors?: string[] };

          if (resultMsg.subtype === 'success') {
            console.log(`[${logPrefix}] verification successful`);
            return { success: true };
          }

          const errorsArray = resultMsg.errors;
          const errorText = (errorsArray && errorsArray.length > 0)
            ? errorsArray.join('; ')
            : resultMsg.subtype || '验证失败';
          console.error(`[${logPrefix}] error: ${errorText} (subtype: ${resultMsg.subtype})`);
          const stderrHint = stderrMessages.length > 0
            ? ` (详情: ${stderrMessages.join('; ').slice(0, 100)})`
            : '';
          return { success: false, error: parseError(errorText) + stderrHint };
        }
      }

      const stderrHint = stderrMessages.length > 0
        ? `: ${stderrMessages.join('; ').slice(0, 200)}`
        : '';
      return { success: false, error: `验证未返回结果${stderrHint}` };
    })();

    try {
      return await Promise.race([verifyPromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${logPrefix}] SDK exception: ${errorMsg}`);
    const stderrHint = stderrMessages.length > 0
      ? ` (详情: ${stderrMessages.join('; ').slice(0, 200)})`
      : '';
    return { success: false, error: parseError(errorMsg) + stderrHint };
  }
}

/**
 * 验证第三方 Provider API Key
 * 使用 SDK 子进程发真实对话，确保验证路径 = 使用路径
 */
export async function verifyProviderViaSdk(
  baseUrl: string,
  apiKey: string,
  authType: string,
  model?: string,
  apiProtocol?: 'anthropic' | 'openai',
  maxOutputTokens?: number,
  upstreamFormat?: 'chat_completions' | 'responses',
): Promise<{ success: boolean; error?: string }> {
  console.log(`[provider/verify] Starting SDK verification for ${baseUrl}, model=${model ?? 'default'}, authType=${authType}, apiProtocol=${apiProtocol ?? 'anthropic'}, maxOutputTokens=${maxOutputTokens ?? 'none'}`);
  const env = buildClaudeSessionEnv({
    baseUrl,
    apiKey,
    authType: authType as ProviderAuthType,
    apiProtocol,
    maxOutputTokens,
    upstreamFormat,
  });
  return verifyViaSdk(env as NodeJS.ProcessEnv, {
    model,
    sessionId: randomUUID(),
    logPrefix: 'provider/verify',
    parseError: parseProviderError,
    // 用 'project' 避免读 ~/.claude/settings.json 中的 plugins 导致超时
    settingSources: ['project'],
  });
}

/**
 * 检测本地 Anthropic 订阅凭证
 * Claude CLI 将 OAuth 账户信息存储在 ~/.claude.json
 */
export function checkAnthropicSubscription(): SubscriptionStatus {
  const claudeJsonPath = join(homedir(), '.claude.json');

  if (!existsSync(claudeJsonPath)) {
    return { available: false };
  }

  try {
    const content = readFileSync(claudeJsonPath, 'utf-8');
    const config = JSON.parse(content);

    if (config.oauthAccount && config.oauthAccount.accountUuid) {
      return {
        available: true,
        path: claudeJsonPath,
        info: {
          accountUuid: config.oauthAccount.accountUuid,
          email: config.oauthAccount.emailAddress,
          displayName: config.oauthAccount.displayName,
          organizationName: config.oauthAccount.organizationName,
        },
      };
    }
  } catch { /* ignore */ }

  return { available: false };
}

/**
 * 验证 Anthropic 订阅（通过 SDK 发测试请求）
 */
export async function verifySubscription(): Promise<{ success: boolean; error?: string }> {
  console.log('[subscription/verify] Starting SDK verification...');
  const env = buildClaudeSessionEnv(); // 无 provider 覆盖 = 默认 Anthropic OAuth
  return verifyViaSdk(env as NodeJS.ProcessEnv, {
    sessionId: randomUUID(),
    logPrefix: 'subscription/verify',
    parseError: parseSubscriptionError,
    // Subscription 需要 'user' 来读取 ~/.claude/ OAuth 凭证
    settingSources: ['user'],
  });
}
