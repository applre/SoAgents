export type TabView = 'launcher' | 'chat' | 'settings';

export interface Tab {
  id: string;
  title: string;
  view: TabView;
  agentDir: string | null;
  sessionId: string | null;
  isGenerating?: boolean;
}
