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
    isFree: true,
  },
  {
    id: 'playwright',
    name: 'Playwright 浏览器',
    description: '浏览器自动化能力，支持网页浏览、截图、表单填写等',
    type: 'stdio',
    command: 'npx',
    args: ['@playwright/mcp@latest'],
    isBuiltin: true,
    isFree: true,
  },
  {
    id: 'ddg-search',
    name: 'DuckDuckGo 搜索引擎',
    description: '无需 API Key。受 DuckDuckGo 频率限制（≤1次/秒），高频使用可能返回 400 错误',
    type: 'stdio',
    command: 'uvx',
    args: ['duckduckgo-mcp-server'],
    isBuiltin: true,
    isFree: true,
  },
  {
    id: 'tavily-search',
    name: 'Tavily 搜索引擎',
    description: '专为 AI 优化的全网搜索，返回结构化结果。免费 1000 次/月，无需信用卡',
    type: 'http',
    url: 'https://mcp.tavily.com/mcp/?tavilyApiKey={{TAVILY_API_KEY}}',
    isBuiltin: true,
    requiresConfig: ['TAVILY_API_KEY'],
    websiteUrl: 'https://app.tavily.com/home',
    configHint: '免费注册即可获取 API Key（1000 次/月，无需信用卡）',
  },
];

export const MCP_DISCOVERY_LINKS = [
  { name: 'mcp.so', url: 'https://mcp.so/' },
  { name: 'smithery.ai', url: 'https://smithery.ai/' },
];
