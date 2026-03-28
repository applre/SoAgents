# PRD: IM 集成方案 v2

> **版本**: v2.0 — 基于 Phase 1 实际实现更新
> **更新日期**: 2026-03-28
> **状态**: Phase 1 已完成，Phase 1.5 规划中

## 一、概述

将 IM（即时通讯）平台接入 SoAgents，让用户通过 Telegram、飞书、钉钉等 IM 平台直接与 AI Agent 对话，无需打开桌面客户端。

### 核心价值

- **随时随地**：手机上即可使用 AI Agent，不受桌面限制
- **团队协作**：群聊中 @Bot 触发 AI，团队共享 Agent 能力
- **7x24 在线**：桌面端挂机运行，IM Bot 持续服务
- **桌面可观**：IM 发起的会话可在桌面端实时查看，带来源标识

### 架构选型：Agent + Channel

SoAgents 直接采用 Agent + Channel 架构（跳过 MyAgents 的旧版 ImBotConfig）：

- 一个 **Agent** = 一个 Workspace + 多个 **Channel**（IM 平台接入点）
- Channel 可覆盖 Agent 的 AI 配置（provider/model/permissionMode）
- 每个对话方（Peer）独立 Sidecar Session，互不干扰

---

## 二、Phase 1 实现总结（已完成）

> Phase 1 目标：Telegram 私聊接入 MVP，端到端消息流通

### 2.1 完成的功能清单

| # | 功能 | 状态 | 关键 Commit |
|---|------|------|------------|
| 1 | 共享类型定义（im.ts + agent.ts） | ✅ | `0cf365d` |
| 2 | Rust IM 管理器 + Telegram 适配器 + Tauri 命令 | ✅ | `bbe4900` |
| 3 | Sidecar /chat/send metadata 支持 | ✅ | `bb9071b` |
| 4 | Agent 配置服务（agentConfigService.ts） | ✅ | `22a29ea` |
| 5 | Agent 列表 UI（ImAgentCardList） | ✅ | `e51a692` |
| 6 | Channel 向导 + 配置面板 | ✅ | `63b62dc` |
| 7 | Agent 设置面板（Basics/Channels/Tools） | ✅ | `093634e` |
| 8 | Settings 页面 Messaging Tab | ✅ | `d3a9242` |
| 9 | /api/im/chat SSE endpoint + Telegram 消息流修复 | ✅ | `9d394e7` |
| 10 | 回调竞态保护 + Channel 自动启动 | ✅ | `43a17c5` |
| 11 | Session 来源标记 + 桌面 IM 事件广播 | ✅ | `6a0b147` |
| 12 | 侧边栏 Telegram 图标 | ✅ | `2d41c81` |
| 13 | Session 复用（同 Peer 共享 Session） | ✅ | `3e78e03` |
| 14 | 侧边栏 Telegram pill 样式徽章 | ✅ | `8fc810e` |

### 2.2 已修复的关键问题

| 问题 | 根因 | 修复方式 |
|------|------|----------|
| Telegram 消息无响应 | Rust 层直接 POST /chat/send 但 Sidecar 只有 SSE endpoint | 新增 /api/im/chat SSE endpoint，Rust 读 SSE 流提取 AI 回复 |
| 每条 Telegram 消息新建 Session | Rust router 未传 sessionId 给 Sidecar | router.get_session_id() + POST body 传 sessionId |
| 并发消息回调泄漏 | 新 SSE 流替换 imStreamCallback 时旧流事件仍触发 | imCallbackNulledDuringTurn 跨 turn 守卫标志 |
| 桌面端看不到 IM 会话 | 缺少来源标记和事件广播 | Session source 字段 + im:message_received/im:response_sent SSE 事件 |

### 2.3 实际架构（与原 PRD 差异）

原 PRD 设计的消息流是 Rust 消费 SSE 流再通过适配器格式化回复。实际实现采用了更简洁的方案：

```
Telegram 用户发消息
    ↓
TelegramAdapter.listen_loop()  [Long Polling]
    ↓ 解析 Update → ImMessage
    ↓
ImManager.process_message()
    ├─ SessionRouter 查找/创建 PeerSession
    │   ├─ 已有 → 复用 Sidecar + sessionId
    │   └─ 新建 → 启动 Sidecar（SidecarOwner::Agent）
    ↓
POST http://127.0.0.1:{port}/api/im/chat  [SSE endpoint]
    { message, agentDir, sessionId, metadata, permissionMode }
    ↓
Bun Sidecar
    ├─ SessionRunner.sendMessage() → SDK query()
    ├─ imStreamCallback 流式回传事件
    │   ├─ 'chunk' → Rust 累积文本
    │   ├─ 'complete' → Rust 获得完整回复
    │   └─ 'error' → Rust 获得错误信息
    ├─ broadcast('im:message_received', ...) → 桌面 UI
    └─ broadcast('im:response_sent', ...) → 桌面 UI
    ↓
Rust 收到完整回复
    ↓
TelegramAdapter.send_text()  [Bot API sendMessage]
    ↓
Telegram 用户收到 AI 回复
```

**关键差异**：
- Sidecar 使用 `imStreamCallback` 而非 Rust 直接消费 SSE 流
- /api/im/chat 是独立的 SSE endpoint（非 /chat/send）
- Session 来源通过 `SessionStore.updateSessionSource()` 持久化
- 桌面端通过 `im:message_received` / `im:response_sent` SSE 事件感知 IM 会话

---

## 三、当前文件结构

### 3.1 Rust 层（`src-tauri/src/im/` — 8 个文件）

| 文件 | 职责 |
|------|------|
| `mod.rs` | ImManager + Agent Tauri 命令 + schedule_agent_auto_start() |
| `adapter.rs` | ImAdapter trait（抽象接口） |
| `types.rs` | Rust 数据模型（AgentConfigRust, ChannelConfigRust, ImMessage...） |
| `router.rs` | SessionRouter（peer→Sidecar 映射 + session_id 复用） |
| `telegram.rs` | Telegram 适配器（Long Polling + sendMessage） |
| `buffer.rs` | 消息缓冲（磁盘持久化，FIFO 队列） |
| `health.rs` | Sidecar 健康检查 |
| `util.rs` | 工具函数 |

### 3.2 共享类型

| 文件 | 职责 |
|------|------|
| `src/shared/types/im.ts` | ImPlatform, ImStatus, MessageSource, ImBotStatus, HeartbeatConfig... |
| `src/shared/types/agent.ts` | AgentConfig, ChannelConfig, ChannelOverrides, resolveEffectiveConfig() |
| `src/shared/types/session.ts` | SessionMetadata.source 字段（'desktop' / 'telegram_private' / ...） |

### 3.3 Sidecar（`src/server/`）

| 文件 | 变更 |
|------|------|
| `index.ts` | /api/im/chat SSE endpoint + im:message_received/im:response_sent 广播 |
| `agent-session.ts` | imStreamCallback + imCallbackNulledDuringTurn 竞态保护 |
| `SessionStore.ts` | updateSessionSource() 方法 |

### 3.4 前端（`src/renderer/components/ImAgentSettings/` — 8 个文件）

```
ImAgentSettings/
├── index.ts                                  # 导出
├── ImAgentCardList.tsx                       # Agent 列表（卡片式 + CRUD）
├── ImAgentSettingsPanel.tsx                  # Agent 编辑面板
├── channels/
│   ├── ChannelWizard.tsx                     # 添加 Channel 向导
│   └── ChannelConfigPanel.tsx                # Channel 配置面板
└── sections/
    ├── AgentBasicsSection.tsx                # Agent 基础配置
    ├── AgentChannelsSection.tsx              # Channel 列表管理
    └── AgentToolsSection.tsx                 # 工具配置
```

**入口**: Settings 页面 → Messaging Tab → `<ImAgentCardList />`

### 3.5 侧边栏集成

`LeftSidebar.tsx`：IM 来源的 Session 显示 pill 样式 Telegram 徽章（绿点 + "Telegram" 文字）

### 3.6 SSE 事件白名单

`SseConnection.ts` 已注册：`im:message_received`、`im:response_sent`

---

## 四、数据模型

### 4.1 AgentConfig（存储在 `~/.soagents/config.json`）

```json
{
  "agents": [
    {
      "id": "agent-uuid",
      "name": "My AI Assistant",
      "workspacePath": "/path/to/workspace",
      "providerId": "anthropic",
      "model": "claude-sonnet-4-6",
      "permissionMode": "auto",
      "enabled": true,
      "channels": [
        {
          "id": "channel-uuid",
          "type": "telegram",
          "name": "Telegram Bot",
          "botToken": "123456:ABC...",
          "allowedUsers": ["user123"],
          "enabled": true,
          "setupCompleted": true
        }
      ]
    }
  ]
}
```

### 4.2 Session Key 格式

```
私聊：im:{platform}:private:{chatId}
群聊：im:{platform}:group:{chatId}

示例：
  im:telegram:private:12345
  im:telegram:group:67890
```

### 4.3 PeerSession（内存，router.rs 维护）

每个 Peer（对话方）映射到一个 Sidecar：

```rust
struct PeerSession {
    session_id: String,       // Sidecar SessionRunner ID
    sidecar_port: u16,        // Sidecar HTTP 端口
    last_active: Instant,     // 最后活跃时间
}
```

同一 Peer 的连续消息复用同一 Session，保持上下文连贯。

### 4.4 SidecarOwner

```rust
pub enum SidecarOwner {
    Global,
    Session(String),              // 桌面 Tab Session
    BackgroundCompletion(String), // 后台完成
    Agent(String),                // IM Channel 消息处理（session_key）
}
```

---

## 五、技术要点

### 5.1 回调竞态保护

**场景**：用户在上一条消息还未处理完时发送新消息，新的 SSE 连接会替换 `imStreamCallback`，导致旧连接的事件泄漏到新连接。

**方案**：`imCallbackNulledDuringTurn` 标志位

```
消息A处理中 → 用户发送消息B
    ↓
setImStreamCallback(newCb)
    ├─ 检测到 oldCb 存在 → 设置 imCallbackNulledDuringTurn = true
    ├─ 通知 oldCb: '消息处理被新请求取代'
    └─ 替换为 newCb
    ↓
消息A的 generator 继续产出事件
    ├─ 检查 imCallbackNulledDuringTurn → true → 跳过回调
    ↓
消息B开始处理
    ├─ 重置 imCallbackNulledDuringTurn = false
    └─ 正常触发 newCb
```

### 5.2 Channel 自动启动

应用启动后 4 秒延迟，`schedule_agent_auto_start()` 读取 `~/.soagents/config.json`，自动启动所有 `enabled: true` 且凭证有效的 Channel。

**延迟原因**：等待 Tauri 窗口、事件循环、State 注入全部就绪后再启动 IM 连接。

### 5.3 Session 来源追踪

- Rust 层构造 metadata：`{ source: "telegram_private", sourceId: "12345", senderName: "John" }`
- Sidecar 调用 `SessionStore.updateSessionSource(sessionId, source)` 持久化
- 前端侧边栏根据 `session.source` 显示平台标识

### 5.4 桌面端 IM 事件

| SSE 事件 | 数据 | 用途 |
|----------|------|------|
| `im:message_received` | `{ sessionId, source, senderName, content }` | 通知桌面端有新 IM 消息 |
| `im:response_sent` | `{ sessionId }` | 通知桌面端 AI 已回复 |

---

## 六、与 MyAgents 的差距分析

基于 MyAgents IMBot UI 对比，SoAgents Phase 1 存在以下差距：

### 6.1 UI/UX 差距

| 功能 | MyAgents | SoAgents Phase 1 | 优先级 |
|------|---------|-------------------|--------|
| 平台概览卡片 | 每个平台独立卡片，展示 Bot 状态、活跃会话数、最后消息时间 | 简单列表式 Agent 卡片 | P1 |
| 新手引导 | 逐步引导添加 Bot Token、测试连接、绑定用户 | 无引导流程 | P1 |
| Bot 状态面板 | 在线/离线状态、运行时长、错误信息、重启次数 | 仅 start/stop 按钮 | P1 |
| 活跃会话列表 | 按平台分组的实时会话列表，含消息计数 | 无 | P2 |
| 绑定机制 | Telegram QR 码深链 / 飞书绑定码 | 手动填 allowedUsers | P2 |
| 插件系统 | OpenClaw 社区插件支持 | 无 | P3 |

### 6.2 功能差距

| 功能 | MyAgents | SoAgents Phase 1 | 优先级 |
|------|---------|-------------------|--------|
| 流式输出 | Telegram Draft 编辑模式（实时打字效果） | 完整回复后一次性发送 | P1 |
| 消息合并 | Telegram >4000 字自动分割的长文本合并 | 未实现 | P2 |
| 群聊支持 | @mention / always 模式、群权限审批 | 仅私聊 | P2 |
| 心跳检测 | 定期后台自主任务（可配置间隔和活跃时段） | 未实现 | P2 |
| 媒体发送 | AI 通过 MCP Tool 发送文件到 IM | 未实现 | P3 |
| 记忆自动更新 | 后台定时同步记忆 | 未实现 | P3 |
| Channel 覆盖 | Channel 级覆盖 provider/model/permissionMode | 类型已定义，UI 未实现 | P2 |

### 6.3 稳定性差距

| 能力 | MyAgents | SoAgents Phase 1 | 优先级 |
|------|---------|-------------------|--------|
| 消息缓冲重放 | Sidecar 不可用时缓冲，恢复后自动重放 | buffer.rs 已有，未验证端到端 | P1 |
| 健康检查 | 定期 HTTP 探针，自动重启不健康 Sidecar | health.rs 已有，未验证端到端 | P1 |
| 空闲回收 | 10 分钟无消息自动回收 Sidecar | 依赖 Sidecar 通用回收机制 | P2 |
| 断线重连 | Telegram Long Polling 失败自动重试 | 基础重试，无指数退避 | P2 |

---

## 七、Phase 1.5：UI 完善 + 稳定性

> 目标：补齐 Phase 1 的 UI 和稳定性短板，达到可日常使用的状态

### 7.1 Bot 状态面板

**目标**：在 Messaging 页面展示每个 Channel 的实时状态

```
┌─────────────────────────────────────┐
│  🟢 Telegram Bot                    │
│  @my_ai_bot                         │
│                                     │
│  状态: 在线     运行时间: 2h 15m    │
│  活跃会话: 3    总消息: 47          │
│  最后消息: 5 分钟前                 │
│                                     │
│  [停止]  [查看会话]  [设置]         │
└─────────────────────────────────────┘
```

**涉及**：
- Rust: `cmd_agent_status` 返回完整 ImBotStatus
- 前端: 新增 BotStatusCard 组件，轮询或 SSE 推送状态更新

### 7.2 流式输出（Telegram Draft 模式）

**目标**：AI 回复实时展示在 Telegram（打字效果），而非等完整回复后一次性发送

**方案**：
1. imStreamCallback 的 'chunk' 事件累积到 buffer
2. 每 500ms 调用 Telegram editMessageText 更新 Draft 消息
3. 完成后删除 Draft，发送最终完整消息

**涉及**：
- Rust `telegram.rs`: 实现 `send_text_streaming()` 方法
- Rust `router.rs`: 处理 SSE 流的 chunk 事件而非仅 complete

### 7.3 新手引导流程

**目标**：用户首次添加 Telegram Channel 时，提供步骤式引导

1. 输入 Bot Token
2. 验证 Token（getMe）
3. 展示 Bot 信息（用户名、头像）
4. 添加 allowed users（可选）
5. 测试消息收发

**涉及**：
- 前端 `ChannelWizard.tsx` 增加步骤式引导 UI
- Rust `cmd_validate_bot_token` 新增 Tauri 命令

### 7.4 健康检查 + 消息缓冲验证

**目标**：确保 buffer.rs 和 health.rs 端到端可用

- health.rs: 定期 HTTP 探针检测 Sidecar 健康状态
- buffer.rs: Sidecar 不可用时缓冲消息，恢复后自动重放
- 添加日志追踪，确保缓冲/重放链路可观测

### 7.5 断线重连（指数退避）

**目标**：Telegram Long Polling 失败时，使用指数退避重试

```
失败次数:  1    2    3    4    5+
等待时间:  1s   2s   4s   8s   30s（上限）
```

---

## 八、Phase 2：飞书 + 钉钉 + 群聊

> 目标：扩展平台支持，增加群聊管理

### 8.1 新增 Rust 文件

| 文件 | 说明 |
|------|------|
| `feishu.rs` | 飞书适配器（WebSocket protobuf 长连接、tenant_access_token 刷新、Markdown→Post、CardKit v2.0） |
| `dingtalk.rs` | 钉钉适配器（WebSocket 长连接、ActionCard、AI 卡片） |
| `group_history.rs` | 群组对话历史管理 |

### 8.2 群聊管理

- `GroupPermission` 数据模型（pending/approved）
- `GroupActivation` 模式（mention/always）
- 群聊系统提示词
- 群工具黑名单（`groupToolsDeny`）

### 8.3 Channel 覆盖 UI

Channel 配置面板增加覆盖选项：
- 选择不同的 AI Provider / Model
- 覆盖 Permission Mode
- 配置工具黑名单

### 8.4 用户绑定机制

- Telegram: QR 码深链绑定（替代手动填 allowedUsers）
- 飞书: 绑定码机制

### 8.5 前端新增

```
ImAgentSettings/
├── channels/
│   ├── FeishuCredentialInput.tsx          # 飞书凭证输入
│   ├── DingtalkCredentialInput.tsx        # 钉钉凭证输入
│   └── ChannelOverridesPanel.tsx          # Channel 覆盖配置
└── sections/
    └── GroupPermissionList.tsx            # 群权限审批列表
```

---

## 九、Phase 3：高级功能

> 目标：完善生态，提升智能化

### 9.1 新增 Rust 文件

| 文件 | 说明 |
|------|------|
| `heartbeat.rs` | 心跳检测（定期后台任务，读取 HEARTBEAT.md 提示词） |
| `memory_update.rs` | 记忆自动更新（后台定时） |
| `bridge.rs` | OpenClaw Channel Plugin 桥接适配器 |

### 9.2 新增 Sidecar 工具

| 文件 | 说明 |
|------|------|
| `src/server/tools/im-media-tool.ts` | MCP Tool: send_media（AI 发送文件到 IM） |
| `src/server/tools/im-bridge-tools.ts` | OpenClaw 插件工具动态代理 |

### 9.3 前端新增

```
ImAgentSettings/
├── channels/
│   └── OpenClawToolGroupsSelector.tsx    # OpenClaw 工具组选择
└── sections/
    ├── AgentHeartbeatSection.tsx          # 心跳配置
    └── AgentMemoryUpdateSection.tsx       # 记忆自动更新
```

---

## 十、技术风险与注意事项

| 风险 | 应对 |
|------|------|
| Telegram Bot API 被墙 | 用户需自备代理；Rust 层支持 proxy 配置 |
| 飞书 WebSocket protobuf（Phase 2） | 需要 protobuf 解析库（prost） |
| 多 Sidecar 内存占用 | 空闲回收（10 分钟）+ 最大并发限制 |
| Bot Token 安全 | 存储在 config.json，文件权限 600 |
| IM 消息刷屏 | 消息频率限制 + 队列长度限制 |
| 并发消息竞态 | imCallbackNulledDuringTurn 跨 turn 守卫（Phase 1 已解决） |
| Session 复用 | router.rs 维护 peer→sessionId 映射（Phase 1 已解决） |
| Localhost 代理陷阱 | 所有 reqwest 客户端 MUST `.no_proxy()`（与现有约束一致） |
| Channel 配置合并 | MUST 使用 `resolveEffectiveConfig()` 合并 Agent 默认值 + Channel 覆盖 |
| Config 写盘 | MUST disk-first（读最新再合并），禁止直接用 React state 写盘 |

---

## 十一、里程碑总览

| 阶段 | 范围 | 状态 |
|------|------|------|
| **Phase 1** | 基础设施 + Telegram 私聊 + Agent UI + 桌面可观 | ✅ 已完成（14 项功能 + 4 项修复） |
| **Phase 1.5** | Bot 状态面板 + 流式输出 + 新手引导 + 稳定性 | 📋 规划中 |
| **Phase 2** | 飞书 + 钉钉 + 群聊 + Channel 覆盖 + 用户绑定 | 📋 待启动 |
| **Phase 3** | 心跳 + 媒体发送 + 记忆更新 + OpenClaw 插件 | 📋 待启动 |
