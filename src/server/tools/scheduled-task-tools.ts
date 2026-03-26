// src/server/tools/scheduled-task-tools.ts
// In-process MCP server providing exit_scheduled_task tool.
// Auto-injected via Pattern 1 (context-injected) in buildSdkMcpServers()
// when the session has active scheduled task context with aiCanExit: true.
//
// Module-level state (scheduledTaskContextMap, exitRequested, currentSessionId)
// is safe because each session runs in its own Bun sidecar process
// (SidecarOwner::Session). If this assumption changes (e.g. shared sidecar),
// this must be refactored to per-session state.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

type CallToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

// ===== Scheduled Task Context =====

interface ScheduledTaskToolContext {
  taskId: string;
  canExit: boolean;
}

const scheduledTaskContextMap = new Map<string, ScheduledTaskToolContext>();

export function setScheduledTaskContext(sessionId: string, taskId: string, canExit: boolean): void {
  scheduledTaskContextMap.set(sessionId, { taskId, canExit });
}

export function clearScheduledTaskContext(sessionId: string): void {
  scheduledTaskContextMap.delete(sessionId);
}

export function getScheduledTaskContext(sessionId: string): ScheduledTaskToolContext | undefined {
  return scheduledTaskContextMap.get(sessionId);
}

export const SCHEDULED_TASK_EXIT_TEXT = '@@SCHEDULED_TASK_EXIT@@';

// ===== Exit Status =====

let exitRequested = false;

export function isScheduledTaskExitRequested(): boolean {
  return exitRequested;
}

export function resetScheduledTaskExitStatus(): void {
  exitRequested = false;
}

// ===== Current Session =====

let currentSessionId: string | undefined;

export function setCurrentSessionId(sessionId: string): void {
  currentSessionId = sessionId;
}

// ===== Tool Handler =====

async function exitScheduledTaskHandler(args: { reason: string }): Promise<CallToolResult> {
  if (!currentSessionId) {
    return { isError: true, content: [{ type: 'text', text: 'Not running in a scheduled task context.' }] };
  }
  const ctx = scheduledTaskContextMap.get(currentSessionId);
  if (!ctx) {
    return { isError: true, content: [{ type: 'text', text: 'No scheduled task context found for this session.' }] };
  }
  if (!ctx.canExit) {
    return { isError: true, content: [{ type: 'text', text: 'This scheduled task does not allow AI-initiated exit (aiCanExit is false).' }] };
  }

  console.log(`[scheduled-task-tools] AI requested exit for task ${ctx.taskId}: ${args.reason}`);
  exitRequested = true;

  return {
    content: [{
      type: 'text',
      text: `${SCHEDULED_TASK_EXIT_TEXT}. Reason: ${args.reason}. The task will be stopped after this response completes.`,
    }],
  };
}

// ===== MCP Server =====

export function createScheduledTaskToolsServer() {
  return createSdkMcpServer({
    name: 'scheduled-task-tools',
    version: '1.0.0',
    tools: [
      tool(
        'exit_scheduled_task',
        `Exit the current scheduled task. Only available when running inside a scheduled task with aiCanExit enabled. Call this when you determine the task objective has been fully achieved and no further scheduled runs are needed.`,
        {
          reason: z.string().describe('Brief explanation of why the task should stop.'),
        },
        exitScheduledTaskHandler,
      ),
    ],
  });
}

export const scheduledTaskToolsServer = createScheduledTaskToolsServer();
