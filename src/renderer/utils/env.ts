export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 在 Tauri 环境下拖动窗口，调用于 onMouseDown 事件 */
export const startWindowDrag = async (e: React.MouseEvent) => {
  if (e.button !== 0) return; // 只响应左键
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().startDragging().catch(console.error);
};
