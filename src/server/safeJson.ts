/**
 * Safe JSON file I/O utilities with atomic write and recovery.
 *
 * Atomic write: data → .tmp → backup .bak ← copy original → rename .tmp → target
 * Recovery chain: .json (main) → .bak (backup) → .tmp (interrupted write)
 * File lock: mkdir-based lock to prevent concurrent writes
 */
import { writeFileSync, readFileSync, copyFileSync, renameSync, existsSync, mkdirSync, rmdirSync, statSync, unlinkSync } from 'fs';
import { dirname } from 'path';

// ============= File Lock =============

const LOCK_STALE_MS = 30_000;
const LOCK_MAX_RETRIES = 5;
const LOCK_RETRY_WAIT_MS = 50;

function lockPath(filePath: string): string {
  return filePath + '.lock';
}

function acquireLock(filePath: string): boolean {
  const lock = lockPath(filePath);
  // Check stale lock
  if (existsSync(lock)) {
    try {
      const stat = statSync(lock);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        rmdirSync(lock);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
  try {
    mkdirSync(lock);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(filePath: string): void {
  try {
    const lock = lockPath(filePath);
    if (existsSync(lock)) {
      rmdirSync(lock);
    }
  } catch {
    // ignore
  }
}

function withFileLock<T>(filePath: string, fn: () => T): T {
  let retries = 0;
  while (retries < LOCK_MAX_RETRIES) {
    if (acquireLock(filePath)) {
      try {
        return fn();
      } finally {
        releaseLock(filePath);
      }
    }
    retries++;
    const start = Date.now();
    while (Date.now() - start < LOCK_RETRY_WAIT_MS) {
      // busy wait
    }
  }
  // Exceeded retries — degrade: run without lock
  console.warn(`[safeJson] Lock timeout for ${filePath}, proceeding without lock`);
  return fn();
}

// ============= Atomic Write =============

/**
 * Atomically write JSON data to a file with .bak backup.
 *
 * Steps:
 * 1. Write to .tmp (if interrupted here, original file is untouched)
 * 2. Copy current file → .bak (best-effort backup; main file stays intact)
 * 3. Rename .tmp → target (atomic overwrite — main is never absent)
 */
export function safeWriteJsonSync(filePath: string, data: unknown): void {
  withFileLock(filePath, () => {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    const content = JSON.stringify(data, null, 2);

    // 1. Write new data to .tmp
    writeFileSync(tmpPath, content, 'utf-8');

    // 2. Backup current file → .bak (best-effort, copy preserves main)
    try {
      if (existsSync(filePath)) {
        if (existsSync(bakPath)) {
          unlinkSync(bakPath);
        }
        copyFileSync(filePath, bakPath);
      }
    } catch (bakErr) {
      console.warn('[safeJson] Failed to create .bak backup:', bakErr);
    }

    // 3. Atomic overwrite: .tmp → target (main file is never absent)
    renameSync(tmpPath, filePath);
  });
}

// ============= Safe Load =============

/**
 * Load and parse a JSON file with automatic recovery from .bak and .tmp.
 *
 * Recovery chain: .json (main) → .bak (backup) → .tmp (interrupted write)
 * Returns defaultValue if all candidates fail.
 */
export function safeLoadJsonSync<T>(filePath: string, defaultValue: T): T {
  const candidates = [
    { path: filePath, label: 'main' },
    { path: filePath + '.bak', label: 'bak' },
    { path: filePath + '.tmp', label: 'tmp' },
  ];

  for (const { path, label } of candidates) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(content) as T;
      if (label !== 'main') {
        console.warn(`[safeJson] Recovered data from .${label} file: ${filePath}`);
      }
      return parsed;
    } catch (err) {
      console.error(`[safeJson] ${label} file corrupted: ${path}`, err);
    }
  }

  return defaultValue;
}
