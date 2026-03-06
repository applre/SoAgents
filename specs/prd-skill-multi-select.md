# PRD: Skill 多选 & 面板优化

## 1. 背景

当前 SoAgents 的 Skill 选择为**单选模式**：通过 `/` 或底部 Puzzle 按钮选中一个技能后，替换之前的选择。实际使用中，用户经常需要同时启用多个 Skill（如 `brainstorming` + `executing-plans`），逐条对话切换 Skill 体验差。

参考牛马AI 的"牛马棚"面板设计，将 Skill 升级为多选模式。

---

## 2. 目标

1. Skill 从单选改为多选，支持同时启用多个 Skill
2. Puzzle 按钮显示已选数量 badge
3. Skill 面板增加"已启用 / 全部" Tab 切换和搜索
4. 输入框上方显示多个 Skill 标签卡片，可单独移除

---

## 3. 功能详述

### 3.1 数据结构变化

```typescript
// 现有
selectedSkill: { name: string; content: string } | null

// 改为
selectedSkills: { name: string; content: string }[]
```

**接口签名链路变更：**

| 层级 | 现有 | 改为 |
|------|------|------|
| `ChatInput` Props.onSend | `skill?: SkillPayload` | `skills?: SkillPayload[]` |
| `TabContext` sendMessage | `skill?: { name, content }` | `skills?: { name, content }[]` |
| `TabProvider` sendMessage | 单个 skill.content 拼接 | 遍历 skills 拼接所有 content |

### 3.2 Puzzle 按钮 Badge

当 `selectedSkills.length > 0` 时，在 Puzzle icon 右上角显示数字 badge：

- 圆形，直径 16px，accent 背景色，白色文字
- 数字为选中数量
- 无选中时不显示

```
[🧩]     → 无选中
[🧩 ②]  → 已选 2 个
```

### 3.3 Skill 面板改造

#### 整体布局

```
┌──────────────────────────────────────────┐
│ 技能列表                    全选 │ 清除  │  ← 标题栏 + 操作
├──────────────────────────────────────────┤
│ [已启用 (2)]  [全部]                     │  ← Tab 切换
├──────────────────────────────────────────┤
│ 🔍 搜索技能...                           │  ← 搜索框
├──────────────────────────────────────────┤
│ ✓ brainstorming                  [项目]  │  ← 选中行
│ ✓ executing-plans                [全局]  │
│   finishing-a-branch             [全局]  │  ← 未选中行
│   test-driven-dev                [项目]  │
│   ...                                    │
└──────────────────────────────────────────┘
```

#### Tab 切换

| Tab | 显示内容 |
|-----|---------|
| 已启用 (N) | 仅显示已选中的 Skill，N 为数量 |
| 全部 | 显示所有 Skill |

- 默认激活"全部" Tab
- 当 `selectedSkills` 为空时，"已启用" Tab 显示"已启用 (0)"

#### 搜索框

- 位于 Tab 下方
- 过滤当前 Tab 中的 Skill 列表
- 按 name 和 description 匹配
- 实时过滤，无需防抖

#### 操作按钮

| 按钮 | 行为 |
|------|------|
| 全选 | 将当前可见列表中所有 Skill 加入 selectedSkills（加载 content） |
| 清除 | 清空 selectedSkills |

#### 行交互

- **点击行**：toggle 选中/取消
  - 选中：调用 `/api/skills/:name` 获取 content，加入 `selectedSkills`
  - 取消：从 `selectedSkills` 中移除
- **选中态**：行左侧显示 `✓` 图标，行背景 `accent/10`
- **未选中态**：无图标，默认背景
- **点击不关闭面板**（区别于当前单选行为）

#### 面板尺寸

- 宽度 320px（从 288px 增加，容纳搜索框）
- 最大高度 360px，超出滚动
- 位置不变：底部工具栏上方弹出

### 3.4 Skill 标签卡片区

输入框上方（附件卡片区同层），横向排列已选 Skill 的 pills：

```
[🧩 brainstorming ×] [🧩 executing-plans ×]
```

- 每个 pill：Puzzle icon + name + X 删除按钮
- 横向排列，超出换行（`flex-wrap`）
- 点击 X：从 `selectedSkills` 移除
- 无选中时不显示此区域

### 3.5 `/` 选择行为变化

通过 `/` 或 `SlashCommandMenu` 选中 Skill 时：

- **追加**到 `selectedSkills`（非替换）
- 如果已存在（同名），不重复添加
- `clear` / `reset` 等内置命令保持原有行为不变

### 3.6 消息发送

#### 前端展示 blocks

```typescript
// 现有：单个 skill block
if (skill) blocks.push({ type: 'skill', name: skill.name });

// 改为：多个 skill blocks
for (const s of skills) {
  blocks.push({ type: 'skill', name: s.name });
}
```

#### 后端消息拼接

```typescript
// 现有
const backendMessage = skill
  ? [text, skill.content].filter(Boolean).join('\n')
  : text;

// 改为
const skillContents = skills?.map(s => s.content).filter(Boolean) ?? [];
const backendMessage = [text, ...skillContents].filter(Boolean).join('\n');
```

---

## 4. 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/renderer/components/ChatInput.tsx` | **修改** | `selectedSkill` → `selectedSkills[]`，面板 UI 改造，badge，标签卡片区，`/` 追加逻辑 |
| `src/renderer/context/TabContext.tsx` | **修改** | `sendMessage` 签名 `skill?` → `skills?` |
| `src/renderer/context/TabProvider.tsx` | **修改** | `sendMessage` 实现适配数组 |

---

## 5. 实施顺序

1. `TabContext.tsx` + `TabProvider.tsx`：接口签名和实现改为 `skills[]`
2. `ChatInput.tsx`：
   - 状态改为 `selectedSkills[]`
   - `handleSend` 传 `skills` 数组
   - `handleSlashSelect` / `handleSkillSelect` 改为追加逻辑
   - 面板 UI：Tab 切换 + 搜索 + toggle 选中
   - Puzzle 按钮 badge
   - 标签卡片区支持多个
3. `npx tsc --noEmit` 验证

---

## 6. 验证标准

- [ ] 点击 Skill 面板中的行 toggle 选中，可选中多个
- [ ] 面板"已启用" Tab 只显示已选 Skill
- [ ] 搜索框过滤 Skill 列表
- [ ] "全选"和"清除"按钮正常工作
- [ ] Puzzle 按钮显示数字 badge
- [ ] 输入框上方显示多个 Skill pill，可单独删除
- [ ] `/skillname` 追加到已选列表而非替换
- [ ] 发送消息后所有 Skill content 正确拼接
- [ ] 前端消息展示多个 skill block
- [ ] `npx tsc --noEmit` 类型检查通过
