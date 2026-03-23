// Hook for handling system tray events and window close behavior
// Manages minimize-to-tray functionality and exit confirmation

import { useEffect, useCallback, useRef } from 'react';
import { isTauri } from '../utils/env';

interface TrayEventsOptions {
  /** Whether minimize to tray is enabled */
  minimizeToTray: boolean;
  /** Callback when settings should be opened */
  onOpenSettings?: () => void;
  /** Callback when exit is requested (for confirmation if cron tasks are running) */
  onExitRequested?: () => Promise<boolean>;
}

export function useTrayEvents(options: TrayEventsOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Handle window hide (minimize to tray)
  const hideWindow = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.hide();
      console.log('[useTrayEvents] Window hidden to tray');
    } catch (error) {
      console.error('[useTrayEvents] Failed to hide window:', error);
    }
  }, []);

  // Handle window close (either hide or exit)
  const closeWindow = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error('[useTrayEvents] Failed to close window:', error);
    }
  }, []);

  // Confirm and exit the app
  const confirmExit = useCallback(async () => {
    if (!isTauri()) return;

    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('tray:confirm-exit');
    } catch (error) {
      console.error('[useTrayEvents] Failed to emit exit event:', error);
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenCloseRequested: (() => void) | null = null;
    let unlistenOpenSettings: (() => void) | null = null;
    let unlistenExitRequested: (() => void) | null = null;
    let unlistenFocusChanged: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const window = getCurrentWindow();

        // Listen for window focus changes
        unlistenFocusChanged = await window.onFocusChanged(({ payload: focused }) => {
          console.debug('[useTrayEvents] Window focus changed:', focused);
        });

        // Listen for window close request (X button)
        unlistenCloseRequested = await listen('window:close-requested', async () => {
          console.log('[useTrayEvents] Window close requested');
          const { minimizeToTray } = optionsRef.current;

          if (minimizeToTray) {
            // Hide to tray instead of closing
            const window = getCurrentWindow();
            await window.hide();
            console.log('[useTrayEvents] Window hidden to tray');
          } else {
            // Check if exit callback returns true (can exit)
            const { onExitRequested } = optionsRef.current;
            if (onExitRequested) {
              const canExit = await onExitRequested();
              if (canExit) {
                const { emit } = await import('@tauri-apps/api/event');
                await emit('tray:confirm-exit');
              }
            } else {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('tray:confirm-exit');
            }
          }
        });

        // Listen for tray "open settings" menu click
        unlistenOpenSettings = await listen('tray:open-settings', () => {
          console.log('[useTrayEvents] Open settings from tray');
          const { onOpenSettings } = optionsRef.current;
          if (onOpenSettings) {
            onOpenSettings();
          }
        });

        // Listen for tray "exit" menu click
        unlistenExitRequested = await listen('tray:exit-requested', async () => {
          console.log('[useTrayEvents] Exit requested from tray');
          const { onExitRequested } = optionsRef.current;
          if (onExitRequested) {
            const canExit = await onExitRequested();
            if (canExit) {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('tray:confirm-exit');
            }
          } else {
            const { emit } = await import('@tauri-apps/api/event');
            await emit('tray:confirm-exit');
          }
        });

        console.log('[useTrayEvents] Event listeners setup complete');
      } catch (error) {
        console.error('[useTrayEvents] Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenCloseRequested) unlistenCloseRequested();
      if (unlistenOpenSettings) unlistenOpenSettings();
      if (unlistenExitRequested) unlistenExitRequested();
      if (unlistenFocusChanged) unlistenFocusChanged();
    };
  }, []);

  return {
    hideWindow,
    closeWindow,
    confirmExit,
  };
}
