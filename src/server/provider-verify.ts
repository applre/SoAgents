/**
 * Provider verification via SDK
 * 通过真实 SDK 对话验证 API Key，确保验证路径 = 使用路径
 */

import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildClaudeSessionEnv } from './agent-session';
import type { ProviderAuthType } from '../shared/types/config';

/**
 * 解析 Claude Code CLI 路径
 */
export function resolveClaudeCodeCli(): string {
  // 尝试通过 require.resolve 找到 SDK 的 cli.js
  try {
    const cliPath = require.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
    return cliPath;
  } catch {
    // Fallback: 从 cwd 下查找
    const bundledPath = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
    throw new Error('Cannot resolve @anthropic-ai/claude-agent-sdk/cli.js');
  }
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

        // assistant 消息也确认 API 响应正常
        if (message.type === 'assistant') {
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
): Promise<{ success: boolean; error?: string }> {
  console.log(`[provider/verify] Starting SDK verification for ${baseUrl}, model=${model ?? 'default'}, authType=${authType}`);
  const env = buildClaudeSessionEnv({
    baseUrl,
    apiKey,
    authType: authType as ProviderAuthType,
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
