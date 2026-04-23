export interface OpenClawPluginApi {
  registerChannel(plugin: any): void;
  registerTool?(factory: any, opts?: any): void;
  registerCli?(factory: any, opts?: any): void;
  registerCommand?(cmd: any): void;
  registerAgent?(): void;
  registerSkill?(): void;
  registerHook?(): void;
  registerAction?(): void;
  registerProvider?(): void;
  registerMcpServer?(server: any): void;
  on?(event: string, handler: (...args: any[]) => void): void;
  config: any;
  logger: any;
  runtime: any;
  registrationMode?: string;
}

export interface OpenClawPluginDefinition {
  id: string;
  name: string;
  description: string;
  kind?: 'channel' | 'extension' | 'tool';
  configSchema?: any;
  register: (api: OpenClawPluginApi) => void;
}

export type OpenClawPluginConfigSchema = Record<string, any>;

export interface DefinedPluginEntry {
  id: string;
  name: string;
  description: string;
  kind: string;
  configSchema: any;
  register: (api: OpenClawPluginApi) => void;
}

export function definePluginEntry(entry: OpenClawPluginDefinition): DefinedPluginEntry;
