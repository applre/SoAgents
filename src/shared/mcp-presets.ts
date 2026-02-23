import type { McpServerDefinition } from './types/mcp';

export const PRESET_MCP_SERVERS: McpServerDefinition[] = [
  {
    id: 'context7',
    name: 'Context7 文档上下文',
    description: '自动为 LLM 提供最新的库和框架文档，避免幻觉和过时代码',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    isBuiltin: true,
  },
  {
    id: 'filesystem',
    name: '文件系统',
    description: '提供安全的文件系统读写能力，支持文件搜索、目录列表等操作',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    isBuiltin: true,
  },
];
