import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/env';

export async function getTabServerUrl(tabId: string): Promise<string> {
  if (!isTauri()) return 'http://localhost:3000';
  return invoke<string>('cmd_get_tab_server_url', { tabId });
}

export async function startTabSidecar(tabId: string, agentDir: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_start_tab_sidecar', { tabId, agentDir });
}

export async function stopTabSidecar(tabId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_stop_tab_sidecar', { tabId });
}

export async function startGlobalSidecar(): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_start_global_sidecar');
}

export async function stopAllSidecars(): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_stop_all_sidecars');
}
