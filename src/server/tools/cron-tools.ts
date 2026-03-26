// src/server/tools/cron-tools.ts
// In-process MCP server providing exit_cron_task tool.
// Auto-injected via Pattern 1 (context-injected) in buildSdkMcpServers()
// when the session has active cron context with aiCanExit: true.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

type CallToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

// ===== Cron Context =====

interface CronContext {
  taskId: string;
  canExit: boolean;
}

const cronContextMap = new Map<string, CronContext>();

export function setCronTaskContext(sessionId: string, taskId: string, canExit: boolean): void {
  cronContextMap.set(sessionId, { taskId, canExit });
}

export function clearCronTaskContext(sessionId: string): void {
  cronContextMap.delete(sessionId);
}

export function getCronTaskContext(sessionId: string): CronContext | undefined {
  return cronContextMap.get(sessionId);
}

export const CRON_TASK_EXIT_TEXT = '@@CRON_TASK_EXIT@@';

// ===== Exit Status =====

let exitRequested = false;

export function isCronExitRequested(): boolean {
  return exitRequested;
}

export function resetCronExitStatus(): void {
  exitRequested = false;
}

// ===== Current Session =====

let currentSessionId: string | undefined;

export function setCurrentSessionId(sessionId: string): void {
  currentSessionId = sessionId;
}

// ===== Tool Handler =====

async function exitCronTaskHandler(args: { reason: string }): Promise<CallToolResult> {
  if (!currentSessionId) {
    return { isError: true, content: [{ type: 'text', text: 'Not running in a cron task context.' }] };
  }
  const ctx = cronContextMap.get(currentSessionId);
  if (!ctx) {
    return { isError: true, content: [{ type: 'text', text: 'No cron task context found for this session.' }] };
  }
  if (!ctx.canExit) {
    return { isError: true, content: [{ type: 'text', text: 'This cron task does not allow AI-initiated exit (aiCanExit is false).' }] };
  }

  console.log(`[cron-tools] AI requested exit for task ${ctx.taskId}: ${args.reason}`);
  exitRequested = true;

  return {
    content: [{
      type: 'text',
      text: `${CRON_TASK_EXIT_TEXT}. Reason: ${args.reason}. The task will be stopped after this response completes.`,
    }],
  };
}

// ===== MCP Server =====

export function createCronToolsServer() {
  return createSdkMcpServer({
    name: 'cron-tools',
    version: '1.0.0',
    tools: [
      tool(
        'exit_cron_task',
        `Exit the current scheduled (cron) task. Only available when running inside a cron task with aiCanExit enabled. Call this when you determine the task objective has been fully achieved and no further scheduled runs are needed.`,
        {
          reason: z.string().describe('Brief explanation of why the task should stop.'),
        },
        exitCronTaskHandler,
      ),
    ],
  });
}

export const cronToolsServer = createCronToolsServer();
