# Plan: 分离 workspaceDir 和 agentDir

## 目标

将 SoAgents 的目录设计从"单一 agentDir"改为"workspaceDir + agentDir 分离"，对齐 OpenClaw 的架构设计。

## 背景

**当前状态**：`agentDir` 同时承担两个职责
- 用户项目目录（文件操作范围）
- Agent 状态目录（session、memory、auth）

**目标状态**：
- `workspaceDir` — 用户打开的项目目录，文件操作在这里
- `agentDir` — Agent 状态目录，固定在 `~/.soagents/agents/<id>/`

## 设计决策

### 1. agentDir 路径生成策略

**选项 A**：基于 workspaceDir 的 hash
```
~/.soagents/agents/<sha256(workspaceDir).slice(0,12)>/
```
- ✅ 同一项目总是对应同一个 Agent
- ❌ 删除项目后 agentDir 成为孤儿

**选项 B**：自增 ID
```
~/.soagents/agents/agent-001/
~/.soagents/agents/agent-002/
```
- ✅ 简单
- ❌ 无法关联到 workspaceDir

**选项 C**：存储映射表 ✅ 推荐
```
~/.soagents/workspace-mapping.json
{
  "/Users/xxx/projects/my-app": "agent-abc123",
  "/Users/xxx/projects/other": "agent-def456"
}
```
- ✅ 灵活，支持重命名、移动
- ✅ 可以手动编辑映射

### 2. 目录结构

```
~/.soagents/
├── workspace-mapping.json    # workspaceDir → agentId 映射
├── agents/
│   ├── agent-abc123/
│   │   ├── sessions/         # 会话历史
│   │   ├── memory/           # 记忆文件
│   │   ├── auth.json         # 认证信息
│   │   └── config.json       # Agent 配置
│   └── agent-def456/
│       └── ...
└── config.json               # 全局配置
```

## 实现计划

### Phase 1: 类型定义更新

**文件**: `src/renderer/types/tab.ts`

```typescript
export interface Tab {
  id: string;
  title: string;
  view: TabView;
  workspaceDir: string | null;  // 新增：项目目录
  agentDir: string | null;       // 保留：Agent 状态目录
  agentId: string | null;        // 新增：Agent 唯一标识
  sessionId: string | null;
  isGenerating?: boolean;
  openFiles: OpenFile[];
  activeSubTab: 'chat' | string;
}
```

**任务**:
- [ ] 更新 Tab interface
- [ ] 更新 createNewTab() 函数
- [ ] 更新 INITIAL_TAB 常量

### Phase 2: 映射管理模块

**新文件**: `src/main/workspace-mapping.ts`

```typescript
interface WorkspaceMapping {
  workspaceDir: string;
  agentId: string;
  createdAt: number;
  lastAccessedAt: number;
}

export async function getOrCreateAgentForWorkspace(workspaceDir: string): Promise<{
  agentId: string;
  agentDir: string;
}>;

export async function listWorkspaceMappings(): Promise<WorkspaceMapping[]>;

export async function removeWorkspaceMapping(workspaceDir: string): Promise<void>;
```

**任务**:
- [ ] 实现映射文件读写
- [ ] 实现 agentId 生成（nanoid 或 uuid）
- [ ] 实现 agentDir 初始化（创建目录结构）
- [ ] 添加 IPC handler

### Phase 3: App.tsx 逻辑更新

**文件**: `src/renderer/App.tsx`

**变更点**:

1. `handleOpenWorkspace(workspaceDir)`:
   - 调用 IPC 获取 agentId 和 agentDir
   - 创建 Tab 时同时设置 workspaceDir、agentId、agentDir

2. `handleSelectWorkspace(tabId, workspaceDir)`:
   - 同上

3. Tab 标题显示:
   - 使用 workspaceDir 的文件夹名，而非 agentDir

**任务**:
- [ ] 更新 handleOpenWorkspace
- [ ] 更新 handleSelectWorkspace  
- [ ] 更新 Tab 标题逻辑
- [ ] 更新 recentDirs 存储（存 workspaceDir）

### Phase 4: TabProvider.tsx 逻辑更新

**文件**: `src/renderer/context/TabProvider.tsx`

**变更点**:

1. Props 增加 workspaceDir:
   ```typescript
   interface Props {
     tabId: string;
     workspaceDir: string;
     agentDir: string;
     children: React.ReactNode;
   }
   ```

2. 发送消息时传递两个目录:
   ```typescript
   await apiPostJson(url, '/chat/send', {
     message: backendMessage,
     workspaceDir,  // 新增
     agentDir,
     providerEnv,
     model: selectedModel,
     permissionMode
   });
   ```

**任务**:
- [ ] 更新 Props interface
- [ ] 更新 API 调用参数
- [ ] 更新 session 过滤逻辑

### Phase 5: 后端更新

**文件**: `src/server/index.ts` (或相应后端文件)

**变更点**:

1. `/chat/send` 接收两个目录参数
2. 文件操作使用 workspaceDir
3. Session/memory 操作使用 agentDir

**任务**:
- [ ] 更新 API 参数解析
- [ ] 更新 Claude Agent SDK 调用参数
- [ ] 确保文件操作边界正确

### Phase 6: 迁移脚本

**新文件**: `scripts/migrate-to-split-dirs.ts`

为已有用户提供迁移：
1. 扫描旧的 agentDir 使用记录
2. 创建 workspace-mapping.json
3. 移动状态文件到新的 agentDir 位置

**任务**:
- [ ] 实现迁移逻辑
- [ ] 添加 dry-run 模式
- [ ] 添加回滚支持

## 测试计划

1. **新用户流程**:
   - 首次打开项目 → 自动创建 agentId 和 agentDir
   - 对话历史保存在 agentDir
   - 文件操作限制在 workspaceDir

2. **多项目切换**:
   - 打开项目 A → 对话
   - 切换到项目 B → 新的对话上下文
   - 切回项目 A → 恢复之前的上下文

3. **迁移测试**:
   - 旧版本用户升级后数据完整
   - Session 历史可恢复

## 风险与注意事项

1. **向后兼容**: 需要检测旧配置并自动迁移
2. **路径处理**: Windows/macOS/Linux 路径差异
3. **并发安全**: 多 Tab 同时操作同一 workspace

## 时间估计

| Phase | 预估时间 |
|-------|---------|
| Phase 1: 类型定义 | 0.5h |
| Phase 2: 映射管理 | 2h |
| Phase 3: App.tsx | 2h |
| Phase 4: TabProvider | 1h |
| Phase 5: 后端 | 2h |
| Phase 6: 迁移脚本 | 1.5h |
| 测试与调试 | 2h |
| **总计** | **~11h** |

---

*Plan created by Claude Code - Plan Mode*
