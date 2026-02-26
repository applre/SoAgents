import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '../utils/env';

export interface CheckUpdateResult {
  status: 'no-update' | 'downloading' | 'ready' | 'error';
  version?: string;
  error?: string;
}

interface UpdateReadyPayload {
  version: string;
}

export function useUpdater() {
  const [updateReady, setUpdateReady] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Listen for Rust-side "updater:ready-to-restart" event
  useEffect(() => {
    if (!isTauri()) return;

    const unlisten = listen<UpdateReadyPayload>('updater:ready-to-restart', (event) => {
      console.log('[useUpdater] Update ready to restart:', event.payload);
      setUpdateReady(true);
      setUpdateVersion(event.payload.version);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Periodic silent check every 30 minutes
  useEffect(() => {
    if (!isTauri()) return;

    const interval = setInterval(() => {
      if (!updateReady) {
        invoke('check_and_download_update').catch((err) => {
          console.error('[useUpdater] Periodic check failed:', err);
        });
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [updateReady]);

  // Manual check (for Settings page)
  const checkForUpdate = useCallback(async (): Promise<CheckUpdateResult> => {
    if (!isTauri()) return { status: 'error', error: 'Not running in Tauri' };

    setChecking(true);
    try {
      const hasUpdate = await invoke<boolean>('check_and_download_update');
      if (hasUpdate) {
        // The event listener will pick up the version
        return { status: 'ready' };
      }
      return { status: 'no-update' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', error: message };
    } finally {
      setChecking(false);
    }
  }, []);

  // Restart to apply update
  const restartAndUpdate = useCallback(async () => {
    if (!isTauri()) return;

    try {
      // Stop all sidecars first
      await invoke('cmd_shutdown_for_update');
    } catch (err) {
      console.error('[useUpdater] Failed to stop sidecars:', err);
    }

    try {
      await invoke('restart_app');
    } catch (err) {
      console.error('[useUpdater] Failed to restart:', err);
    }
  }, []);

  return {
    updateReady,
    updateVersion,
    checking,
    checkForUpdate,
    restartAndUpdate,
  };
}
