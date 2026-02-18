export type TabView = 'launcher' | 'chat' | 'settings';

export interface OpenFile {
  filePath: string;
  title: string;
  mode: 'edit' | 'preview';
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
