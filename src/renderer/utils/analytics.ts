/**
 * Frontend Analytics utility.
 *
 * Triple-check before tracking:
 * 1. Environment variable SOAGENTS_ANALYTICS_ENABLED=true (checked server-side)
 * 2. Config file ~/.soagents/analytics_config.json exists and enabled (checked server-side)
 * 3. Endpoint exists in config (checked server-side)
 *
 * Frontend only calls /api/analytics/status to check, and /api/analytics/track to send.
 * No hardcoded endpoints — fork-safe.
 */

import { globalApiGetJson, globalApiPostJson } from '../api/apiFetch';

let analyticsEnabled: boolean | null = null;

export async function isAnalyticsEnabled(): Promise<boolean> {
  if (analyticsEnabled !== null) return analyticsEnabled;
  try {
    const result = await globalApiGetJson<{ enabled: boolean }>('/api/analytics/status');
    analyticsEnabled = result.enabled;
    return analyticsEnabled;
  } catch {
    analyticsEnabled = false;
    return false;
  }
}

export async function trackEvent(
  event: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): Promise<void> {
  if (!(await isAnalyticsEnabled())) return;
  try {
    await globalApiPostJson('/api/analytics/track', { event, params });
  } catch {
    // Silent failure
  }
}
