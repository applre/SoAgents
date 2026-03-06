# PRD: @ 文件引用 & / 技能调用

## 1. 背景

当前 SoAgents 的 ChatInput 存在以下不足：

| 能力 | MyAgents | SoAgents 现状 |
|------|----------|---------------|
| `@` 文件引用 | 输入框任意位置输入 `@` 弹出文件搜索浮层，支持键盘导航 | **无** |
| `/` 技能调用 | 输入框任意位置输入 `/` 弹出命令菜单，前缀匹配+模糊搜索 | 仅在文本以 `/` 开头时触发，且只触发 SlashCommandMenu；无法在句中调用 |
| 文件附件 | `@path` 直接嵌入文本发送给 SDK | 仅通过编辑器「去对话」注入附件卡片，无法手动 @ 引用 |

本 PRD 的目标是让 SoAgents 的输入体验与 MyAgents 对齐。

---

## 2. 目标

1. 用户在输入框**任意光标位置**输入 `@` 时，弹出文件搜索浮层，选中后将 `@<相对路径>` 插入文本
2. 用户在输入框**任意光标位置**输入 `/` 时，弹出技能/命令菜单，选中后将 `/command` 插入文本
3. 两个菜单互斥，同时只显示一个
4. 支持键盘导航（上/下/回车/Tab/Esc）
5. 消息发送后，`@path` 和 `/command` 作为纯文本传给后端，由 Claude SDK 处理

---

## 3. 功能详述

### 3.1 @ 文件引用

#### 触发条件
- 用户在 textarea 输入 `@` 字符
- 记录 `@` 的光标位置（`atPosition`）
- 弹出文件搜索浮层

#### 搜索行为
- `@` 后的文本作为搜索查询（`@rea` → 查询 `rea`）
- 查询为空时显示提示文字："输入文件名搜索..."
- 查询长度 >= 1 时调用后端 API 搜索
- 防抖 200ms，避免频繁请求
- 最多返回 10 条结果

#### 关闭条件
- `@` 被删除
- `@` 后出现空格或换行
- 用户按 Esc
- 点击浮层外部

#### 选中行为
- 回车 / Tab / 点击：选中文件
- 将 `@<query>` 替换为 `@<relativePath> `（末尾带空格）
- 关闭浮层

#### 浮层 UI
- 定位：输入框上方（`absolute bottom-full`）
- 宽度 320px，最大高度 256px，可滚动
- 每行显示：文件图标 + 相对路径
- 当前选中项高亮（accent 背景色）
- 目录类型用文件夹图标区分

#### 后端 API

**新增端点：** `GET /api/search-files`

| 参数 | 类型 | 说明 |
|------|------|------|
| `agentDir` | string | 工作区路径 |
| `q` | string | 搜索关键词 |

**返回：**
```typescript
interface FileSearchResult {
  path: string;   // 相对路径
  name: string;   // 文件名
  type: 'file' | 'dir';
}
// Response: FileSearchResult[]
```

**实现逻辑：**
- 使用 `Bun.Glob` 搜索 `**/*${query}*`
- 跳过 `node_modules/`、`.git/`、`.DS_Store`
- 不搜索隐藏文件（`dot: false`）
- 最多返回 20 条
- 空查询返回空数组

---

### 3.2 / 技能调用（升级）

#### 现状问题
当前实现仅在 `text.startsWith('/')` 时触发 `showSlash`，无法在句中使用。

#### 升级方案
改为与 `@` 相同的光标位置检测机制：
- 输入 `/` 时记录 `slashPosition`
- `/` 后的文本作为过滤查询
- 关闭条件与 `@` 一致（空格/换行/Esc/删除`/`）

#### 技能数据源
复用现有 `/api/skills` 端点返回的 `skillCommands`，无需改后端。

#### 选中行为
- 将 `/<query>` 替换为 `/<commandName> `
- 同时加载该技能内容，设置 `selectedSkill`（保留现有逻辑）
- 关闭浮层

#### 菜单 UI
- 复用现有 `SlashCommandMenu` 组件样式
- 每行：`/<name>` + 来源标签（项目/全局）+ 描述
- 前缀匹配优先排序

---

### 3.3 互斥与输入处理

| 场景 | 行为 |
|------|------|
| 已打开 `@` 浮层，输入 `/` | 关闭 `@`，打开 `/` |
| 已打开 `/` 浮层，输入 `@` | 关闭 `/`，打开 `@` |
| 菜单打开时按 Esc | 关闭当前菜单，不影响文本 |
| 菜单打开时按 Enter（无结果） | 正常发送消息 |

---

## 4. 消息格式

消息以纯文本发送，`@path` 和 `/command` 不做特殊编码：

```
请帮我看看 @src/server/index.ts 的第 50 行
```

后端 `enqueueUserMessage` 直接将文本放入 `contentBlocks`，Claude SDK 自行处理 `@` 引用。

---

## 5. 技术方案

### 5.1 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/server/index.ts` | **修改** | 新增 `GET /api/search-files` 端点 |
| `src/renderer/components/ChatInput.tsx` | **修改** | 添加 `@` 触发逻辑、文件搜索状态、浮层渲染；升级 `/` 触发为光标位置检测 |
| `src/renderer/components/FileSearchMenu.tsx` | **新建** | `@` 文件搜索浮层组件 |
| `src/renderer/components/SlashCommandMenu.tsx` | **修改** | 适配新的 props 接口（接收光标位置相关信息） |

### 5.2 ChatInput 新增状态

```typescript
// @ 文件搜索
const [showFileSearch, setShowFileSearch] = useState(false);
const [fileSearchQuery, setFileSearchQuery] = useState('');
const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([]);
const [selectedFileIndex, setSelectedFileIndex] = useState(0);
const [atPosition, setAtPosition] = useState<number | null>(null);
const [isFileSearching, setIsFileSearching] = useState(false);

// / 技能（升级：光标位置检测）
const [slashPosition, setSlashPosition] = useState<number | null>(null);
const [slashSearchQuery, setSlashSearchQuery] = useState('');
const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
```

### 5.3 输入变化处理核心逻辑

在 `onChange` 回调中：

```
1. 获取新值和光标位置
2. 检测新输入的字符
3. 如果是 '@'：打开文件搜索，记录位置，关闭 / 菜单
4. 如果是 '/'：打开技能菜单，记录位置，关闭 @ 浮层
5. 如果已打开 @ 浮层：
   - 检查 @ 是否被删除 → 关闭
   - 提取 @ 后到光标的文本作为查询
   - 遇到空格/换行 → 关闭
6. 如果已打开 / 菜单：同上逻辑
```

### 5.4 键盘事件处理

在 `onKeyDown` 中拦截：
- `ArrowUp` / `ArrowDown`：导航选中项
- `Enter` / `Tab`：选中当前项（阻止默认行为）
- `Escape`：关闭菜单

优先级：文件搜索 > 技能菜单 > 默认行为

---

## 6. 实施顺序

1. 后端：新增 `/api/search-files` 端点
2. 新建 `FileSearchMenu.tsx` 浮层组件
3. 改造 `ChatInput.tsx`：
   - 添加 `@` 文件搜索全部状态和逻辑
   - 升级 `/` 触发机制（从 `startsWith` 改为光标位置检测）
   - 统一 `onChange` 和 `onKeyDown` 处理
4. 类型检查 + 手动验证

---

## 7. 验证标准

- [ ] 输入 `@` 弹出文件搜索浮层，输入查询后实时搜索
- [ ] 上下键导航、回车选中、Esc 关闭
- [ ] 选中后 `@path ` 正确插入光标位置
- [ ] 输入 `/` 弹出技能菜单，过滤匹配
- [ ] 句中输入 `@` 或 `/` 均可正常触发（非仅行首）
- [ ] 两个菜单互斥
- [ ] 空格/换行/删除触发符 → 自动关闭菜单
- [ ] 消息发送后 `@path` 作为纯文本到达后端
- [ ] `npx tsc --noEmit` 类型检查通过
