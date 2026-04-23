import { mkdirSync, existsSync, appendFileSync, readFileSync, writeFileSync, statSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import crypto from 'node:crypto';
import type { SessionMetadata, SessionMessage, SessionStats, SessionDetailedStats, GlobalStats } from '../shared/types/session';
import { safeWriteJsonSync, safeLoadJsonSync } from './safeJson';

const SOAGENTS_DIR = join(homedir(), '.soagents');
const SESSIONS_DIR = join(SOAGENTS_DIR, 'sessions');
const ATTACHMENTS_DIR = join(SOAGENTS_DIR, 'attachments');
const SESSIONS_INDEX = join(SOAGENTS_DIR, 'sessions.json');
const SESSIONS_LOCK = join(SOAGENTS_DIR, 'sessions.lock');
const LOCK_MAX_RETRIES = 3;
const LOCK_STALE_MS = 30000;

function ensureDirs(): void {
  if (!existsSync(SOAGENTS_DIR)) mkdirSync(SOAGENTS_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function acquireLock(): boolean {
  ensureDirs();
  // 检查陈旧锁
  if (existsSync(SESSIONS_LOCK)) {
    try {
      const stat = statSync(SESSIONS_LOCK);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        rmdirSync(SESSIONS_LOCK);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
  try {
    mkdirSync(SESSIONS_LOCK);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(): void {
  try {
    if (existsSync(SESSIONS_LOCK)) {
      rmdirSync(SESSIONS_LOCK);
    }
  } catch {
    // ignore
  }
}

function withLock<T>(fn: () => T): T {
  let retries = 0;
  while (retries < LOCK_MAX_RETRIES) {
    if (acquireLock()) {
      try {
        return fn();
      } finally {
        releaseLock();
      }
    }
    retries++;
    // 同步等待一段时间（简单自旋）
    const start = Date.now();
    while (Date.now() - start < 50) {
      // busy wait
    }
  }
  // 超出重试次数，强制执行（降级，不加锁）
  return fn();
}

function readIndex(): SessionMetadata[] {
  return safeLoadJsonSync<SessionMetadata[]>(SESSIONS_INDEX, []);
}

function writeIndex(sessions: SessionMetadata[]): void {
  ensureDirs();
  safeWriteJsonSync(SESSIONS_INDEX, sessions);
}

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(id) && id.length > 0 && id.length < 100;
}

const lineCountCache = new Map<string, number>();

export function createSession(agentDir: string, title?: string): SessionMetadata {
  ensureDirs();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session: SessionMetadata = {
    id,
    agentDir,
    title: title ?? 'New Session',
    createdAt: now,
    lastActiveAt: now,
    stats: {
      messageCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
  };
  withLock(() => {
    const sessions = readIndex();
    sessions.push(session);
    writeIndex(sessions);
  });
  return session;
}

export function saveMessage(sessionId: string, msg: SessionMessage): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  ensureDirs();
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  appendFileSync(filePath, JSON.stringify(msg) + '\n', 'utf8');

  // 更新行数缓存
  const prev = lineCountCache.get(sessionId) ?? 0;
  lineCountCache.set(sessionId, prev + 1);

  // 更新 stats
  updateSessionStats(sessionId, {
    messageCount: 1,
    totalInputTokens: msg.usage?.inputTokens ?? 0,
    totalOutputTokens: msg.usage?.outputTokens ?? 0,
    totalCacheReadTokens: msg.usage?.cacheReadTokens ?? 0,
    totalCacheCreationTokens: msg.usage?.cacheCreationTokens ?? 0,
  }, msg.role as 'user' | 'assistant');
}

/**
 * Back-fill a message's `sdkUuid` in persisted JSONL.
 *
 * Used by SessionRunner after the Claude Agent SDK replies with its own UUID
 * for a user/assistant message (needed for Rewind / Fork). Reads the whole
 * file, patches the matching line by `msg.id`, and rewrites.
 *
 * O(n) per call; acceptable at per-turn frequency. If a session grows huge
 * and this becomes hot, move to an index file keyed by messageId.
 */
export function updateMessageSdkUuid(
  sessionId: string,
  messageId: string,
  sdkUuid: string,
): void {
  if (!isValidId(sessionId)) return;
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return;
  return withLock(() => {
    const raw = readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');
    let dirty = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as SessionMessage;
        if (msg.id === messageId && !msg.sdkUuid) {
          msg.sdkUuid = sdkUuid;
          lines[i] = JSON.stringify(msg);
          dirty = true;
          break;
        }
      } catch {
        // Malformed line — skip.
      }
    }
    if (dirty) {
      writeFileSync(filePath, lines.join('\n'), 'utf8');
    }
  });
}

/**
 * Truncate a session's JSONL to remove `messageId` and everything after.
 *
 * Returns the removed user message's content + attachments (used by Rewind
 * to restore the input field). If the target isn't a user message the
 * returned content is empty but truncation still proceeds.
 */
export function truncateMessagesAfter(
  sessionId: string,
  messageId: string,
): { truncatedUserContent: string; truncatedAttachments: SessionMessage['attachments'] } | null {
  if (!isValidId(sessionId)) return null;
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return null;
  return withLock(() => {
    const raw = readFileSync(filePath, 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    let targetIdx = -1;
    let truncatedContent = '';
    let truncatedAttachments: SessionMessage['attachments'];
    for (let i = 0; i < lines.length; i++) {
      try {
        const msg = JSON.parse(lines[i]) as SessionMessage;
        if (msg.id === messageId) {
          targetIdx = i;
          if (msg.role === 'user') {
            truncatedContent = msg.content;
            truncatedAttachments = msg.attachments;
          }
          break;
        }
      } catch {
        /* skip malformed */
      }
    }
    if (targetIdx < 0) return null;
    const kept = lines.slice(0, targetIdx);
    writeFileSync(filePath, kept.length > 0 ? kept.join('\n') + '\n' : '', 'utf8');
    lineCountCache.set(sessionId, kept.length);
    return { truncatedUserContent: truncatedContent, truncatedAttachments };
  });
}

/**
 * Clone a session's messages up to (and including) `upToMessageId` into a
 * brand new session. The new session has its own id/metadata; source session
 * is untouched. Used by Fork.
 */
export function cloneSession(
  sourceSessionId: string,
  upToMessageId: string,
  options?: { titlePrefix?: string },
): { newSessionId: string; agentDir: string; title: string } | null {
  if (!isValidId(sourceSessionId)) return null;
  const srcMeta = readIndex().find((s) => s.id === sourceSessionId);
  if (!srcMeta) return null;
  const srcPath = join(SESSIONS_DIR, `${sourceSessionId}.jsonl`);
  if (!existsSync(srcPath)) return null;

  const raw = readFileSync(srcPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  let cutoff = -1;
  for (let i = 0; i < lines.length; i++) {
    try {
      const msg = JSON.parse(lines[i]) as SessionMessage;
      if (msg.id === upToMessageId) {
        cutoff = i;
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (cutoff < 0) return null;

  const prefix = options?.titlePrefix ?? '🌿 ';
  const newSession = createSession(
    srcMeta.agentDir,
    `${prefix}${srcMeta.title ?? '对话'}`,
  );

  const kept = lines.slice(0, cutoff + 1); // include fork point
  const newPath = join(SESSIONS_DIR, `${newSession.id}.jsonl`);
  writeFileSync(newPath, kept.join('\n') + '\n', 'utf8');
  lineCountCache.set(newSession.id, kept.length);

  // Aggregate stats from copied messages so the new session shows accurate counts.
  let msgCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const line of kept) {
    try {
      const m = JSON.parse(line) as SessionMessage;
      msgCount += 1;
      inputTokens += m.usage?.inputTokens ?? 0;
      outputTokens += m.usage?.outputTokens ?? 0;
    } catch {
      /* skip */
    }
  }
  updateSessionStats(newSession.id, {
    messageCount: msgCount,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
  });

  return { newSessionId: newSession.id, agentDir: srcMeta.agentDir, title: newSession.title ?? '' };
}

export function getSessionMessages(sessionId: string): SessionMessage[] {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const messages: SessionMessage[] = [];
    for (const line of lines) {
      try {
        messages.push(JSON.parse(line) as SessionMessage);
      } catch {
        // skip bad lines
      }
    }
    return messages;
  } catch {
    return [];
  }
}

export function listSessions(filter?: { archived?: boolean }): SessionMetadata[] {
  ensureDirs();
  let sessions = withLock(() => readIndex());
  if (filter?.archived !== undefined) {
    sessions = sessions.filter(s => (s.archived ?? false) === filter.archived);
  }
  return sessions.sort((a, b) => {
    return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
  });
}

export function updateSessionStats(sessionId: string, delta: Partial<SessionStats>, lastMessageRole?: 'user' | 'assistant'): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    const session = sessions[idx];
    if (!session.stats) {
      session.stats = { messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0 };
    }
    if (delta.messageCount !== undefined) {
      session.stats.messageCount += delta.messageCount;
    }
    if (delta.totalInputTokens !== undefined) {
      session.stats.totalInputTokens += delta.totalInputTokens;
    }
    if (delta.totalOutputTokens !== undefined) {
      session.stats.totalOutputTokens += delta.totalOutputTokens;
    }
    if (delta.totalCacheReadTokens) {
      session.stats.totalCacheReadTokens = (session.stats.totalCacheReadTokens ?? 0) + delta.totalCacheReadTokens;
    }
    if (delta.totalCacheCreationTokens) {
      session.stats.totalCacheCreationTokens = (session.stats.totalCacheCreationTokens ?? 0) + delta.totalCacheCreationTokens;
    }
    if (lastMessageRole) {
      session.lastMessageRole = lastMessageRole;
    }
    session.lastActiveAt = new Date().toISOString();
    sessions[idx] = session;
    writeIndex(sessions);
  });
}

export function touchSession(sessionId: string): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].lastActiveAt = new Date().toISOString();
    writeIndex(sessions);
  });
}

export function updateTitle(sessionId: string, title: string, manuallyRenamed?: boolean): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].title = title;
    if (manuallyRenamed !== undefined) {
      sessions[idx].manuallyRenamed = manuallyRenamed;
    }
    sessions[idx].lastActiveAt = new Date().toISOString();
    writeIndex(sessions);
  });
}

export function saveSdkSessionId(sessionId: string, sdkSessionId: string): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].sdkSessionId = sdkSessionId;
    writeIndex(sessions);
  });
}

export function getSdkSessionId(sessionId: string): string | undefined {
  if (!isValidId(sessionId)) return undefined;
  const sessions = readIndex();
  return sessions.find(s => s.id === sessionId)?.sdkSessionId;
}

export function updateSessionSource(sessionId: string, source: string): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    if (sessions[idx].source) return; // already set
    sessions[idx].source = source;
    writeIndex(sessions);
  });
}

export function markViewed(sessionId: string): void {
  if (!isValidId(sessionId)) return;
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].lastViewedAt = new Date().toISOString();
    writeIndex(sessions);
  });
}

// ── 统计 API ──

function aggregateByModel(
  byModel: Record<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; count: number }>,
  msg: SessionMessage,
): void {
  if (!msg.usage) return;
  if (msg.usage.modelUsage) {
    for (const [model, mu] of Object.entries(msg.usage.modelUsage)) {
      if (!byModel[model]) byModel[model] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, count: 0 };
      byModel[model].inputTokens += mu.inputTokens ?? 0;
      byModel[model].outputTokens += mu.outputTokens ?? 0;
      byModel[model].cacheReadTokens += mu.cacheReadTokens ?? 0;
      byModel[model].cacheCreationTokens += mu.cacheCreationTokens ?? 0;
      byModel[model].count++;
    }
  } else {
    const model = msg.usage.model || 'unknown';
    if (!byModel[model]) byModel[model] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, count: 0 };
    byModel[model].inputTokens += msg.usage.inputTokens ?? 0;
    byModel[model].outputTokens += msg.usage.outputTokens ?? 0;
    byModel[model].cacheReadTokens += msg.usage.cacheReadTokens ?? 0;
    byModel[model].cacheCreationTokens += msg.usage.cacheCreationTokens ?? 0;
    byModel[model].count++;
  }
}

export function getSessionDetailedStats(sessionId: string): SessionDetailedStats | null {
  if (!isValidId(sessionId)) return null;
  const messages = getSessionMessages(sessionId);
  if (messages.length === 0) return null;

  const sessions = readIndex();
  const session = sessions.find(s => s.id === sessionId);
  const summary: SessionStats = session?.stats ?? { messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0 };

  const byModel: SessionDetailedStats['byModel'] = {};
  const messageDetails: SessionDetailedStats['messageDetails'] = [];
  let currentUserQuery = '';

  for (const msg of messages) {
    if (msg.role === 'user') {
      currentUserQuery = msg.content.slice(0, 100);
    } else if (msg.role === 'assistant' && msg.usage) {
      aggregateByModel(byModel, msg);
      messageDetails.push({
        userQuery: currentUserQuery,
        inputTokens: msg.usage.inputTokens ?? 0,
        outputTokens: msg.usage.outputTokens ?? 0,
        cacheReadTokens: (msg.usage.cacheReadTokens ?? 0) + (msg.usage.cacheCreationTokens ?? 0),
        cacheCreationTokens: 0,
        toolCount: msg.toolCount ?? 0,
        durationMs: msg.durationMs ?? 0,
      });
    }
  }

  return { summary, byModel, messageDetails };
}

function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getGlobalStats(range: '7d' | '30d' | '60d'): GlobalStats {
  const allSessions = listSessions();
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 60;
  const cutoff = Date.now() - rangeDays * 86400_000;
  const sessions = allSessions.filter(s => new Date(s.lastActiveAt).getTime() >= cutoff);

  let messageCount = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCacheReadTokens = 0, totalCacheCreationTokens = 0;
  for (const s of sessions) {
    if (s.stats) {
      messageCount += s.stats.messageCount ?? 0;
      totalInputTokens += s.stats.totalInputTokens ?? 0;
      totalOutputTokens += s.stats.totalOutputTokens ?? 0;
      totalCacheReadTokens += s.stats.totalCacheReadTokens ?? 0;
      totalCacheCreationTokens += s.stats.totalCacheCreationTokens ?? 0;
    }
  }

  const dailyMap: Record<string, { inputTokens: number; outputTokens: number; messageCount: number }> = {};
  const byModel: GlobalStats['byModel'] = {};

  for (const s of sessions) {
    const messages = getSessionMessages(s.id);
    let lastDate = toLocalDate(s.createdAt);
    for (const msg of messages) {
      if (msg.role === 'user') {
        lastDate = msg.timestamp ? toLocalDate(msg.timestamp) : lastDate;
      } else if (msg.role === 'assistant' && msg.usage) {
        const date = msg.timestamp ? toLocalDate(msg.timestamp) : lastDate;
        if (!dailyMap[date]) dailyMap[date] = { inputTokens: 0, outputTokens: 0, messageCount: 0 };
        dailyMap[date].inputTokens += msg.usage.inputTokens ?? 0;
        dailyMap[date].outputTokens += msg.usage.outputTokens ?? 0;
        dailyMap[date].messageCount++;
        aggregateByModel(byModel, msg);
      }
    }
  }

  const daily = Object.entries(dailyMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    summary: { totalSessions: sessions.length, messageCount, totalInputTokens, totalOutputTokens, totalCacheReadTokens, totalCacheCreationTokens },
    daily,
    byModel,
  };
}

export function archiveSession(sessionId: string): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].archived = true;
    writeIndex(sessions);
  });
}

export function unarchiveSession(sessionId: string): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].archived = false;
    writeIndex(sessions);
  });
}

// ── 附件 API ──

export function saveAttachment(
  sessionId: string,
  attachmentId: string,
  _fileName: string,
  base64Data: string,
  mimeType: string,
): string {
  const sessionAttachmentsDir = join(ATTACHMENTS_DIR, sessionId);
  if (!existsSync(sessionAttachmentsDir)) {
    mkdirSync(sessionAttachmentsDir, { recursive: true });
  }
  const ext = mimeType.split('/')[1] || 'bin';
  const safeFileName = `${attachmentId}.${ext}`;
  const filePath = join(sessionAttachmentsDir, safeFileName);
  const buffer = Buffer.from(base64Data, 'base64');
  writeFileSync(filePath, buffer);
  return `${sessionId}/${safeFileName}`;
}

export function getAttachmentPath(relativePath: string): string {
  return join(ATTACHMENTS_DIR, relativePath);
}

export function getAttachmentDataUrl(relativePath: string, mimeType: string): string | null {
  try {
    const filePath = getAttachmentPath(relativePath);
    if (!existsSync(filePath)) return null;
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}
