// Workspace service for managing per-workspace configuration
// Falls back to localStorage in browser development mode

import type { WorkspaceEntry } from '../../shared/types/workspace';
import { isTauri } from '../utils/env';

// ============= Async Mutex Lock =============

function createAsyncLock() {
  let queue: Promise<void> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = queue;
    queue = next;
    return prev.then(fn).finally(() => release!());
  };
}

const withWorkspaceLock = createAsyncLock();

const CONFIG_DIR_NAME = '.soagents';
const WORKSPACES_FILE = 'workspaces.json';
const STORAGE_KEY = 'soagents:workspaces';
const LEGACY_RECENT_DIRS_KEY = 'soagents:recent-dirs';

// ============= Safe File I/O (mirrors configService pattern) =============

async function safeWriteJson(filePath: string, data: unknown): Promise<void> {
  const { writeTextFile, exists, remove, rename } = await import(
    '@tauri-apps/plugin-fs'
  );

  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';
  const content = JSON.stringify(data, null, 2);

  await writeTextFile(tmpPath, content);

  try {
    if (await exists(filePath)) {
      if (await exists(bakPath)) {
        await remove(bakPath);
      }
      await rename(filePath, bakPath);
    }
  } catch (bakErr) {
    console.warn('[workspaceService] Failed to create .bak backup:', bakErr);
  }

  try {
    await rename(tmpPath, filePath);
  } catch (renameErr) {
    try {
      if ((await exists(bakPath)) && !(await exists(filePath))) {
        await rename(bakPath, filePath);
      }
    } catch {
      /* best-effort rollback */
    }
    throw renameErr;
  }
}

async function safeLoadJson<T>(
  filePath: string,
  validate?: (data: unknown) => data is T,
): Promise<T | null> {
  const { exists, readTextFile, rename, writeTextFile } = await import(
    '@tauri-apps/plugin-fs'
  );

  const candidates = [
    { path: filePath, label: 'main' },
    { path: filePath + '.bak', label: 'bak' },
    { path: filePath + '.tmp', label: 'tmp' },
  ];

  for (const { path, label } of candidates) {
    if (!(await exists(path))) continue;
    try {
      const content = await readTextFile(path);
      const parsed = JSON.parse(content);
      if (validate && !validate(parsed)) {
        console.error(
          `[workspaceService] ${label} file has invalid structure, skipping`,
        );
        continue;
      }
      if (label !== 'main') {
        console.warn(
          `[workspaceService] Recovered data from .${label} file, restoring...`,
        );
        if (label === 'tmp') {
          await rename(path, filePath);
        } else {
          const restorePath = filePath + '.restore';
          await writeTextFile(restorePath, content);
          await rename(restorePath, filePath);
        }
      }
      return parsed as T;
    } catch (err) {
      console.error(
        `[workspaceService] ${label} file corrupted or unreadable:`,
        err,
      );
    }
  }
  return null;
}

// ============= Directory Management =============

let configDirPath: string | null = null;

async function getConfigDir(): Promise<string> {
  if (configDirPath) return configDirPath;
  const { homeDir, join } = await import('@tauri-apps/api/path');
  const home = await homeDir();
  configDirPath = await join(home, CONFIG_DIR_NAME);
  return configDirPath;
}

async function ensureConfigDir(): Promise<void> {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
  const dir = await getConfigDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

// ============= Validation =============

function isValidWorkspaces(data: unknown): data is WorkspaceEntry[] {
  return Array.isArray(data);
}

// ============= localStorage Fallback =============

function localStorageLoad(): WorkspaceEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function localStorageSave(workspaces: WorkspaceEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

// ============= Migration from legacy recent-dirs =============

function migrateLegacyRecentDirs(): WorkspaceEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_RECENT_DIRS_KEY);
    if (!raw) return [];
    const dirs = JSON.parse(raw) as string[];
    if (!Array.isArray(dirs) || dirs.length === 0) return [];
    const now = Date.now();
    const entries: WorkspaceEntry[] = dirs.map((path, i) => ({
      path,
      lastOpenedAt: now - i * 1000, // preserve order: first = most recent
    }));
    console.log(`[workspaceService] Migrated ${entries.length} entries from localStorage:soagents:recent-dirs`);
    return entries;
  } catch {
    return [];
  }
}

// ============= Public API =============

export async function loadWorkspaces(): Promise<WorkspaceEntry[]> {
  if (!isTauri()) {
    let ws = localStorageLoad();
    if (ws.length === 0) {
      ws = migrateLegacyRecentDirs();
      if (ws.length > 0) {
        localStorageSave(ws);
      }
    }
    return ws;
  }

  try {
    await ensureConfigDir();
    const { join } = await import('@tauri-apps/api/path');
    const dir = await getConfigDir();
    const filePath = await join(dir, WORKSPACES_FILE);

    let loaded = await safeLoadJson<WorkspaceEntry[]>(filePath, isValidWorkspaces);
    if (loaded && loaded.length > 0) return loaded;

    // Auto-migrate from legacy localStorage
    const migrated = migrateLegacyRecentDirs();
    if (migrated.length > 0) {
      await safeWriteJson(filePath, migrated);
      return migrated;
    }
    return [];
  } catch (error) {
    console.error('[workspaceService] Failed to load workspaces:', error);
    return [];
  }
}

export async function atomicModifyWorkspaces(
  modifier: (workspaces: WorkspaceEntry[]) => WorkspaceEntry[],
): Promise<WorkspaceEntry[]> {
  if (!isTauri()) {
    const latest = localStorageLoad();
    const modified = modifier(latest);
    localStorageSave(modified);
    return modified;
  }

  return withWorkspaceLock(async () => {
    await ensureConfigDir();
    const { join } = await import('@tauri-apps/api/path');
    const dir = await getConfigDir();
    const filePath = await join(dir, WORKSPACES_FILE);

    const latest = await safeLoadJson<WorkspaceEntry[]>(filePath, isValidWorkspaces) ?? [];
    const modified = modifier(latest);
    await safeWriteJson(filePath, modified);
    return modified;
  });
}
