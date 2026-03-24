export interface AgentFrontmatter {
  name: string;
  description?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  tools?: string;
  disallowedTools?: string;
  permissionMode?: string;
  skills?: string[];
  maxTurns?: number;
}

export interface AgentMeta {
  displayName?: string;
  icon?: string;
  color?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentItem {
  name: string;
  folderName: string;
  description: string;
  model?: string;
  source: 'user' | 'project';
  enabled: boolean;
  meta?: AgentMeta;
}

export interface AgentDetail extends AgentItem {
  body: string;
  rawContent: string;
  path: string;
  frontmatter: AgentFrontmatter;
}

export interface AgentWorkspaceConfig {
  local: Record<string, { enabled: boolean }>;
  global_refs: Record<string, { enabled: boolean }>;
}
