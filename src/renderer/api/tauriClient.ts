import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/env';

export async function getSessionServerUrl(sessionId: string): Promise<string> {
  if (!isTauri()) return 'http://localhost:3000';
  return invoke<string>('cmd_get_session_server_url', { sessionId });
}

export async function startSessionSidecar(sessionId: string, agentDir: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_start_session_sidecar', { sessionId, agentDir });
}

export async function stopSessionSidecar(sessionId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_stop_session_sidecar', { sessionId });
}

export async function startGlobalSidecar(): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_start_global_sidecar');
}

export async function stopAllSidecars(): Promise<void> {
  if (!isTauri()) return;
  return invoke('cmd_stop_all_sidecars');
}

export interface RunningSidecar {
  sessionId: string;
  agentDir: string | null;
  port: number;
}

export async function listRunningSidecars(): Promise<RunningSidecar[]> {
  if (!isTauri()) return [];
  const raw = await invoke<[string, string | null, number][]>('cmd_list_running_sidecars');
  return raw.map(([sessionId, agentDir, port]) => ({ sessionId, agentDir, port }));
}

export async function getDefaultWorkspace(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string>('cmd_get_default_workspace');
}

// ── Global Sidecar Ready Promise ──
// Blocks API calls until global sidecar is confirmed running.

let _readyResolve: (() => void) | null = null;
let _readyPromise: Promise<void> | null = null;

export function initGlobalSidecarReadyPromise(): void {
  _readyPromise = new Promise((resolve) => { _readyResolve = resolve; });
}

export function markGlobalSidecarReady(): void {
  _readyResolve?.();
  _readyResolve = null;
}

export async function waitForGlobalSidecar(): Promise<void> {
  if (!_readyPromise) return;
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Global sidecar ready timeout (60s)')), 60000)
  );
  return Promise.race([_readyPromise, timeout]);
}

// ── Global Server URL cache (updated on restart) ──

let _globalServerUrl: string | null = null;

export function updateGlobalServerUrl(url: string): void {
  _globalServerUrl = url;
}

export function getCachedGlobalServerUrl(): string | null {
  return _globalServerUrl;
}

export function clearCachedGlobalServerUrl(): void {
  _globalServerUrl = null;
}
