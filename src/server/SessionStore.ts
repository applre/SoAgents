import { mkdirSync, existsSync, appendFileSync, readFileSync, statSync, rmdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import crypto from 'node:crypto';
import type { SessionMetadata, SessionMessage, SessionStats, ModelUsageEntry, SessionDetailedStats, GlobalStats } from '../shared/types/session';
import { safeWriteJsonSync, safeLoadJsonSync } from './safeJson';

const SOAGENTS_DIR = join(homedir(), '.soagents');
const SESSIONS_DIR = join(SOAGENTS_DIR, 'sessions');
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
  });
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

export function listSessions(): SessionMetadata[] {
  ensureDirs();
  const sessions = withLock(() => readIndex());
  return sessions.sort((a, b) => {
    return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
  });
}

export function updateSessionStats(sessionId: string, delta: Partial<SessionStats>): void {
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

export function updateTitle(sessionId: string, title: string): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  withLock(() => {
    const sessions = readIndex();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].title = title;
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

export function deleteSession(sessionId: string): void {
  if (!isValidId(sessionId)) throw new Error('Invalid session ID');
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
  lineCountCache.delete(sessionId);
  withLock(() => {
    const sessions = readIndex();
    const filtered = sessions.filter(s => s.id !== sessionId);
    writeIndex(filtered);
  });
}
