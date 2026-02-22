// Config service for managing app configuration using Tauri FS plugin
// Falls back to localStorage in browser development mode

import type { AppConfig } from '../../shared/types/config';
import { DEFAULT_CONFIG } from '../../shared/providers';
import { isTauri } from '../utils/env';

// ============= Async Mutex Lock =============
// Serializes read-modify-write operations to prevent concurrent corruption.
// NOTE: NOT reentrant. Functions holding the lock must use _writeAppConfigLocked()
// instead of saveAppConfig() to avoid deadlock.

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

const withConfigLock = createAsyncLock();

const CONFIG_DIR_NAME = '.soagents';
const CONFIG_FILE = 'config.json';
const STORAGE_KEY = 'soagents:config';

// ============= Safe File I/O Utilities =============
// Atomic write with .bak backup and multi-source recovery chain.

/**
 * Atomically write JSON data to a file with .bak backup.
 *
 * Steps:
 * 1. Write to .tmp (if interrupted here, original file is untouched)
 * 2. Rename current file → .bak (preserves last known good version)
 * 3. Rename .tmp → target (atomic replacement)
 */
async function safeWriteJson(filePath: string, data: unknown): Promise<void> {
  const { writeTextFile, exists, remove, rename } = await import(
    '@tauri-apps/plugin-fs'
  );

  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';
  const content = JSON.stringify(data, null, 2);

  // 1. Write new data to .tmp
  await writeTextFile(tmpPath, content);

  // 2. Backup current file → .bak (best-effort)
  try {
    if (await exists(filePath)) {
      if (await exists(bakPath)) {
        await remove(bakPath);
      }
      await rename(filePath, bakPath);
    }
  } catch (bakErr) {
    console.warn('[configService] Failed to create .bak backup:', bakErr);
  }

  // 3. Atomic replace: .tmp → target
  try {
    await rename(tmpPath, filePath);
  } catch (renameErr) {
    // Rollback: restore .bak → main
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

/**
 * Load and parse a JSON file with automatic recovery from .bak and .tmp.
 *
 * Recovery chain (in order of trust):
 * 1. Main file — the current version
 * 2. .bak — the previous known-good version
 * 3. .tmp — an in-progress write that may contain newer data
 */
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
          `[configService] ${label} file has invalid structure, skipping`,
        );
        continue;
      }
      if (label !== 'main') {
        console.warn(
          `[configService] Recovered data from .${label} file, restoring...`,
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
        `[configService] ${label} file corrupted or unreadable:`,
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
    console.log('[configService] Creating config directory:', dir);
    await mkdir(dir, { recursive: true });
  }
}

// ============= Validation =============

function isValidAppConfig(data: unknown): data is AppConfig {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

// ============= Browser localStorage Fallback =============

function localStorageLoad(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, apiKeys: parsed.apiKeys ?? {} };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function localStorageSave(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ============= Public API =============

/**
 * Load app config from disk (Tauri) or localStorage (browser).
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (!isTauri()) {
    return localStorageLoad();
  }

  try {
    await ensureConfigDir();
    const { join } = await import('@tauri-apps/api/path');
    const dir = await getConfigDir();
    const configPath = await join(dir, CONFIG_FILE);

    const loaded = await safeLoadJson<AppConfig>(configPath, isValidAppConfig);
    if (loaded) {
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_CONFIG, ...loaded, apiKeys: loaded.apiKeys ?? {} };
    }
    return { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error('[configService] Failed to load app config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save app config to disk (Tauri) or localStorage (browser).
 * Serialized under withConfigLock to prevent concurrent writes.
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  if (!isTauri()) {
    localStorageSave(config);
    return;
  }

  return withConfigLock(async () => {
    try {
      await _writeAppConfigLocked(config);
    } catch (error) {
      console.error('[configService] Failed to save app config:', error);
      throw error;
    }
  });
}

/**
 * Atomically read-modify-write the app config.
 * The modifier receives the latest config from disk and returns the modified version.
 * Both read and write happen inside withConfigLock, preventing races.
 *
 * Returns the final config so callers can update React state.
 */
export async function atomicModifyConfig(
  modifier: (config: AppConfig) => AppConfig,
): Promise<AppConfig> {
  if (!isTauri()) {
    const latest = localStorageLoad();
    const modified = modifier(latest);
    localStorageSave(modified);
    return modified;
  }

  return withConfigLock(async () => {
    const latest = await loadAppConfig();
    const modified = modifier(latest);
    await _writeAppConfigLocked(modified);
    return modified;
  });
}

/**
 * Internal: write config to disk without acquiring withConfigLock.
 * MUST only be called from within a withConfigLock block.
 */
async function _writeAppConfigLocked(config: AppConfig): Promise<void> {
  if (!isTauri()) {
    localStorageSave(config);
    return;
  }
  await ensureConfigDir();
  const { join } = await import('@tauri-apps/api/path');
  const dir = await getConfigDir();
  const configPath = await join(dir, CONFIG_FILE);
  await safeWriteJson(configPath, config);
}
