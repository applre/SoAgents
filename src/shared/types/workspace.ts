import type { PermissionMode } from './permission';

export interface WorkspaceEntry {
  path: string;                     // agentDir（唯一键）
  providerId?: string;              // per-workspace provider 覆盖
  modelId?: string;                 // per-workspace model 覆盖
  permissionMode?: PermissionMode;  // per-workspace 权限模式覆盖
  mcpEnabledServers?: string[];     // 启用的 MCP 服务器 ID 列表（undefined = 全部启用）
  customPermissions?: {             // 自定义工具权限规则（预留，暂无 UI）
    allow: string[];
    deny: string[];
  };
  lastOpenedAt: number;             // 时间戳，用于排序"最近工作区"
}
