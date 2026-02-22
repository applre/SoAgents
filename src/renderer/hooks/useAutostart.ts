import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '../utils/env';

export function useAutostart() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isTauri()) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const { isEnabled: check } = await import('@tauri-apps/plugin-autostart');
        const enabled = await check();
        setIsEnabled(enabled);
      } catch (err) {
        console.error('[useAutostart] Failed to check autostart:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setAutostart = useCallback(async (enabled: boolean) => {
    if (!isTauri()) return;
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setIsEnabled(enabled);
    } catch (err) {
      console.error('[useAutostart] Failed to set autostart:', err);
    }
  }, []);

  return { isEnabled, isLoading, setAutostart };
}
