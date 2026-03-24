export interface SkillFrontmatter {
  name: string;
  description?: string;
  author?: string;
  'user-invocable'?: boolean;
  'disable-model-invocation'?: boolean;
  'allowed-tools'?: string;
  context?: string;
  agent?: string;
  'argument-hint'?: string;
}

export interface SkillItem {
  name: string;
  folderName: string;
  description: string;
  source: 'user' | 'project';
  isBuiltin: boolean;
  enabled: boolean;
  userInvocable: boolean;
}

export interface SkillDetail extends SkillItem {
  body: string;
  rawContent: string;
  path: string;
  frontmatter: SkillFrontmatter;
}
