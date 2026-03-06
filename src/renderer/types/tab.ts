export type TabView = 'launcher' | 'chat' | 'settings' | 'scheduled-tasks';

export interface OpenFile {
  filePath: string;       // 文件路径 或 URL
  title: string;
  mode: 'edit' | 'preview';
  isUrl?: boolean;        // true = URL，用 Tauri WebView 渲染
  isDirty?: boolean;      // true = 有未保存的修改
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
