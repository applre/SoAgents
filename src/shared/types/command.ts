export interface CommandItem {
  name: string;
  fileName: string;
  description: string;
  source: 'user' | 'project';
}

export interface CommandDetail extends CommandItem {
  body: string;
  rawContent: string;
  path: string;
  author?: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  source: 'builtin' | 'custom' | 'skill';
  scope?: 'user' | 'project';
  path?: string;
  folderName?: string;
}
