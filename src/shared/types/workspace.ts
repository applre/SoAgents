import type { PermissionMode } from './permission';

export interface WorkspaceEntry {
  path: string;                     // agentDir（唯一键）
  /** @deprecated Use AgentConfig.providerId. Kept for migration period. */
  providerId?: string;
  /** @deprecated Use AgentConfig.model. Kept for migration period. */
  modelId?: string;
  /** @deprecated Use AgentConfig.permissionMode. Kept for migration period. */
  permissionMode?: PermissionMode;
  /** @deprecated Use AgentConfig.mcpEnabledServers. Kept for migration period. */
  mcpEnabledServers?: string[];
  customPermissions?: {             // 自定义工具权限规则（预留，暂无 UI）
    allow: string[];
    deny: string[];
  };
  agentId?: string;                 // 关联的 AgentConfig ID
  lastOpenedAt: number;             // 时间戳，用于排序"最近工作区"
  displayName?: string;             // 自定义显示名称（默认用文件夹名）
  icon?: string;                    // 自定义图标 ID 或 emoji
  internal?: boolean;               // true = 隐藏（如诊断工作区）
}
