/**
 * Markdown 预处理：修复 AI 流式输出中常见的格式问题。
 *
 * 处理流程：
 * 1. 保护代码块/内联代码/GFM 表格（不修改其内容）
 * 2. 修复标题缺空格：`##标题` → `## 标题`
 * 3. 修复无序列表缺空格：`-项目` → `- 项目`
 * 4. 修复有序列表缺空格：`1.内容` → `1. 内容`
 * 5. 还原被保护的内容
 */

// 占位符使用 Unicode Private Use Area 字符避免 lint 警告
const PH_START = '\uE000';
const PH_END = '\uE001';
const PH_PATTERN = /\uE000CODE(\d+)\uE001/g;
const PH_TEST = /\uE000CODE\d+\uE001/;

export function preprocessContent(content: string): string {
  if (!content) return '';

  // Step 1: 提取并保护代码块和内联代码
  const protected_: string[] = [];
  let processed = content;

  const protect = (match: string): string => {
    protected_.push(match);
    return `${PH_START}CODE${protected_.length - 1}${PH_END}`;
  };

  // 保护围栏代码块 (``` ... ```)
  processed = processed.replace(/```[\s\S]*?```/g, protect);

  // 保护内联代码 (` ... `)
  processed = processed.replace(/`[^`]+`/g, protect);

  // 保护 GFM 表格块 (2+ 连续以 | 开头的行)
  processed = processed.replace(/(?:^[ \t]*\|[^\n]*(?:\n|$)){2,}/gm, protect);

  // Step 2: 对非保护内容应用格式修正

  // 2a. 标题前确保空行（非行首 # 前加换行）
  processed = processed.replace(/([^\n#])(#{1,6}\s+)(?=\S)/g, '$1\n\n$2');

  // 2b. 标题 # 后确保空格：`##标题` → `## 标题`
  processed = processed.replace(/^(#{1,6})([^\s#\n])/gm, '$1 $2');

  // 2c. 无序列表项修正: `-item` → `- item`
  processed = processed.replace(/^-([^\s\-\n])/gm, '- $1');

  // 2d. 有序列表项修正: `1.item` → `1. item`
  processed = processed.replace(/^(\d+\.)([^\s\n])/gm, '$1 $2');

  // Step 3: 恢复保护的代码块 (多轮，处理嵌套——表格里可能有内联代码占位符)
  while (PH_TEST.test(processed)) {
    processed = processed.replace(PH_PATTERN, (_, index) => {
      return protected_[parseInt(index, 10)];
    });
  }

  return processed;
}
