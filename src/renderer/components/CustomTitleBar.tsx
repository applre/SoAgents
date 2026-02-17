import { useEffect, useState, type ReactNode } from 'react';

// 检测是否在 Tauri 环境中
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface Props {
  children: ReactNode;
}

export default function CustomTitleBar({ children }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      setIsFullscreen(await win.isFullscreen());

      unlisten = await win.onResized(async () => {
        setIsFullscreen(await win.isFullscreen());
      });
    };

    setup();
    return () => { unlisten?.(); };
  }, []);

  // macOS 且非全屏时，为交通灯留出 70px 空间
  const trafficLightWidth = isTauri() && !isFullscreen ? 70 : 0;

  return (
    <div
      className="flex h-10 shrink-0 items-stretch overflow-hidden bg-[var(--paper-dark)]"
      data-tauri-drag-region
    >
      {/* 交通灯占位区域（不可拖拽内容，仅空间） */}
      {trafficLightWidth > 0 && (
        <div
          style={{ width: trafficLightWidth, minWidth: trafficLightWidth }}
          data-tauri-drag-region
        />
      )}
      {children}
    </div>
  );
}
