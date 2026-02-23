export type TabView = 'launcher' | 'chat' | 'settings';

export interface OpenFile {
  filePath: string;       // 文件路径 或 URL
  title: string;
  mode: 'edit' | 'preview';
  isUrl?: boolean;        // true = URL，用 Tauri WebView 渲染
}

export interface Tab {
  id: string;
  title: string;
  view: TabView;
  agentDir: string | null;
  sessionId: string | null;
  isGenerating?: boolean;
  openFiles: OpenFile[];
  activeSubTab: 'chat' | string; // string = filePath
}
