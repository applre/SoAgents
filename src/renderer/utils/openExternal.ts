import { isTauri } from './env';

export async function openExternal(target: string): Promise<void> {
  if (!target?.trim()) return;

  const url = target.trim();

  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch (error) {
      console.error('[openExternal] Failed to open:', error);
      if (isExternalUrl(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  } else if (isExternalUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function isExternalUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:');
}
