import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync, statSync, rmdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import crypto from 'node:crypto';
import type { SessionMetadata, SessionMessage, SessionStats } from '../shared/types/session';

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
  if (!existsSync(SESSIONS_INDEX)) return [];
  try {
    const content = readFileSync(SESSIONS_INDEX, 'utf8');
    return JSON.parse(content) as SessionMetadata[];
  } catch {
    return [];
  }
}

function writeIndex(sessions: SessionMetadata[]): void {
  ensureDirs();
  writeFileSync(SESSIONS_INDEX, JSON.stringify(sessions, null, 2), 'utf8');
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
