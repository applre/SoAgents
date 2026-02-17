import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/env';
import { getTabServerUrl } from './tauriClient';

// 通过 Rust 代理发送 HTTP 请求（避免 CORS）
async function proxyFetch(url: string, options: RequestInit = {}): Promise<string> {
  if (isTauri()) {
    const method = options.method ?? 'GET';
    const body = options.body ? String(options.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    return invoke<string>('cmd_proxy_http', { method, url, headers, body });
  } else {
    const resp = await fetch(url, options);
    return resp.text();
  }
}

// Tab 级别 API（通过 tabId 找到对应 Sidecar 的 URL）
export async function apiGetJson<T>(baseUrl: string, path: string): Promise<T> {
  const text = await proxyFetch(`${baseUrl}${path}`);
  return JSON.parse(text) as T;
}

export async function apiPostJson<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const text = await proxyFetch(`${baseUrl}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return JSON.parse(text) as T;
}

// 全局 Sidecar API（Settings/Launcher 页面使用）
// GLOBAL_SERVER_URL 在运行时从 Rust 获取
let _globalUrl: string | null = null;
async function getGlobalUrl(): Promise<string> {
  if (!_globalUrl) {
    _globalUrl = await getTabServerUrl('__global__');
  }
  return _globalUrl;
}

export async function globalApiGetJson<T>(path: string): Promise<T> {
  const url = await getGlobalUrl();
  return apiGetJson<T>(url, path);
}

export async function globalApiPostJson<T>(path: string, body: unknown): Promise<T> {
  const url = await getGlobalUrl();
  return apiPostJson<T>(url, path, body);
}
