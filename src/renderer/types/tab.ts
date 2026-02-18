export type TabView = 'launcher' | 'chat' | 'settings' | 'editor';

export interface Tab {
  id: string;
  title: string;
  view: TabView;
  agentDir: string | null;
  sessionId: string | null;
  filePath: string | null;
  isGenerating?: boolean;
}
