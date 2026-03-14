export interface McpServerDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  isBuiltin: boolean;
  isFree?: boolean;
  requiresConfig?: string[];   // e.g. ['GEMINI_API_KEY']
  configHint?: string;         // UI hint for config
  websiteUrl?: string;         // where to get API key
}
