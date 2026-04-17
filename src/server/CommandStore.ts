import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, symlinkSync, lstatSync, readlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { CommandItem, CommandDetail, SlashCommand } from '../shared/types/command';
import * as SkillsStore from './SkillsStore';

export type { CommandItem, CommandDetail, SlashCommand };

const GLOBAL_COMMANDS_DIR = join(homedir(), '.soagents', 'commands');

const BUILTIN_COMMANDS: SlashCommand[] = [
  { name: 'compact', description: '压缩对话历史，释放上下文空间', source: 'builtin' },
  { name: 'context', description: '显示或管理当前上下文', source: 'builtin' },
  { name: 'cost', description: '查看 token 使用量和费用', source: 'builtin' },
  { name: 'init', description: '初始化项目配置 (CLAUDE.md)', source: 'builtin' },
  { name: 'pr-comments', description: '生成 Pull Request 评论', source: 'builtin' },
  { name: 'release-notes', description: '根据最近提交生成发布说明', source: 'builtin' },
  { name: 'review', description: '对代码进行审查', source: 'builtin' },
  { name: 'security-review', description: '进行安全相关的代码审查', source: 'builtin' },
];

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!raw.startsWith('---')) {
    return { meta, body: raw };
  }
  const endIndex = raw.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { meta, body: raw };
  }
  const frontmatterBlock = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 4).trimStart();

  for (const line of frontmatterBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  return { meta, body };
}

function buildFrontmatter(name: string, description?: string, author?: string): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${name}`);
  if (description) {
    lines.push(`description: ${description}`);
  }
  if (author) {
    lines.push(`author: ${author}`);
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function scanCommandsDir(dir: string, source: 'user' | 'project'): CommandItem[] {
  if (!existsSync(dir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const results: CommandItem[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;

    const filePath = join(dir, entry);
    let rawContent: string;
    try {
      rawContent = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const { meta } = parseFrontmatter(rawContent);
    const fileName = entry;
    const name = meta['name'] || entry.replace(/\.md$/, '');
    const description = meta['description'] || '';

    results.push({
      name,
      fileName,
      description,
      source,
    });
  }

  return results;
}

/**
 * 列出所有 commands，project 级别覆盖同名 user 级别
 */
export function list(agentDir?: string): CommandItem[] {
  const userCommands = scanCommandsDir(GLOBAL_COMMANDS_DIR, 'user');

  if (!agentDir) {
    return userCommands;
  }

  const projectCommandsDir = join(agentDir, '.claude', 'commands');
  const projectCommands = scanCommandsDir(projectCommandsDir, 'project');

  // Project commands override user commands with the same name
  const projectNames = new Set(projectCommands.map((c) => c.name));
  const filtered = userCommands.filter((c) => !projectNames.has(c.name));

  return [...filtered, ...projectCommands];
}

/**
 * 读取单个 command 文件详情
 */
export function get(
  fileName: string,
  scope: 'user' | 'project',
  agentDir?: string
): CommandDetail | null {
  let commandsDir: string;
  if (scope === 'project' && agentDir) {
    commandsDir = join(agentDir, '.claude', 'commands');
  } else {
    commandsDir = GLOBAL_COMMANDS_DIR;
  }

  const filePath = join(commandsDir, fileName);
  if (!existsSync(filePath)) {
    return null;
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const { meta, body } = parseFrontmatter(rawContent);
  const name = meta['name'] || fileName.replace(/\.md$/, '');
  const description = meta['description'] || '';
  const author = meta['author'];

  return {
    name,
    fileName,
    description,
    source: scope,
    body,
    rawContent,
    path: filePath,
    ...(author ? { author } : {}),
  };
}

/**
 * 创建新 command 文件
 */
export function create(data: {
  name: string;
  description?: string;
  body: string;
  scope: 'user' | 'project';
  agentDir?: string;
}): void {
  let commandsDir: string;
  if (data.scope === 'project' && data.agentDir) {
    commandsDir = join(data.agentDir, '.claude', 'commands');
  } else {
    commandsDir = GLOBAL_COMMANDS_DIR;
  }

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
  }

  const fileName = `${data.name}.md`;
  const filePath = join(commandsDir, fileName);
  const frontmatter = buildFrontmatter(data.name, data.description);
  writeFileSync(filePath, frontmatter + data.body, 'utf-8');
}

/**
 * 更新 command 文件，支持通过 newFileName 重命名
 */
export function update(
  fileName: string,
  data: {
    name: string;
    description?: string;
    body: string;
    scope: 'user' | 'project';
    agentDir?: string;
    author?: string;
  },
  newFileName?: string
): void {
  let commandsDir: string;
  if (data.scope === 'project' && data.agentDir) {
    commandsDir = join(data.agentDir, '.claude', 'commands');
  } else {
    commandsDir = GLOBAL_COMMANDS_DIR;
  }

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
  }

  const oldFilePath = join(commandsDir, fileName);
  const targetFileName = newFileName || fileName;
  const newFilePath = join(commandsDir, targetFileName);

  const frontmatter = buildFrontmatter(data.name, data.description, data.author);
  writeFileSync(newFilePath, frontmatter + data.body, 'utf-8');

  // If renamed, delete old file
  if (newFileName && newFileName !== fileName && existsSync(oldFilePath)) {
    try {
      unlinkSync(oldFilePath);
    } catch {
      // ignore
    }
  }
}

/**
 * 删除 command 文件
 */
export function remove(
  fileName: string,
  scope: 'user' | 'project',
  agentDir?: string
): boolean {
  let commandsDir: string;
  if (scope === 'project' && agentDir) {
    commandsDir = join(agentDir, '.claude', 'commands');
  } else {
    commandsDir = GLOBAL_COMMANDS_DIR;
  }

  const filePath = join(commandsDir, fileName);
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将用户级别的 commands 同步为 agentDir 下的符号链接。
 * 清理悬空符号链接（源路径已不存在）。
 * 所有操作均 try/catch，不影响 session 启动。
 */
export function syncToProject(agentDir: string): void {
  const targetDir = join(agentDir, '.claude', 'commands');
  try {
    mkdirSync(targetDir, { recursive: true });
  } catch {
    return;
  }

  // 获取用户级别的所有 commands
  let userCommands: CommandItem[];
  try {
    userCommands = scanCommandsDir(GLOBAL_COMMANDS_DIR, 'user');
  } catch {
    return;
  }

  // 为每个 command 创建符号链接
  for (const cmd of userCommands) {
    try {
      const sourcePath = join(GLOBAL_COMMANDS_DIR, cmd.fileName);
      if (!existsSync(sourcePath)) continue;

      const linkPath = join(targetDir, cmd.fileName);
      let linkStat: ReturnType<typeof lstatSync> | null = null;
      try {
        linkStat = lstatSync(linkPath);
      } catch {
        // 不存在，继续创建
      }

      if (linkStat) {
        if (linkStat.isSymbolicLink()) {
          // 已是符号链接，检查是否有效
          try {
            const target = readlinkSync(linkPath);
            if (target === sourcePath && existsSync(sourcePath)) {
              continue; // 已存在且有效
            }
            // 悬空或目标变化，删除重建
            unlinkSync(linkPath);
          } catch {
            // ignore
          }
        } else {
          continue; // 是真实文件，跳过
        }
      }

      symlinkSync(sourcePath, linkPath);
    } catch {
      // 单个 command 失败不影响其他
    }
  }

  // 清理悬空符号链接
  try {
    const entries = readdirSync(targetDir);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      try {
        const linkPath = join(targetDir, entry);
        const linkStat = lstatSync(linkPath);
        if (!linkStat.isSymbolicLink()) continue;
        const target = readlinkSync(linkPath);
        if (!existsSync(target)) {
          unlinkSync(linkPath);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 聚合所有来源的 slash commands，按优先级去重：
 * 1. Project-level commands
 * 2. User-level commands
 * 3. Project-level skills (user-invocable only)
 * 4. User-level skills (enabled + user-invocable only)
 * 5. Builtin commands
 */
export function listSlashCommands(agentDir?: string): SlashCommand[] {
  const commands: SlashCommand[] = [];
  const seenNames = new Set<string>();

  function addIfNew(cmd: SlashCommand): void {
    if (!seenNames.has(cmd.name)) {
      seenNames.add(cmd.name);
      commands.push(cmd);
    }
  }

  // 1. Project-level commands
  if (agentDir) {
    const projectCommandsDir = join(agentDir, '.claude', 'commands');
    const projectCmds = scanCommandsDir(projectCommandsDir, 'project');
    for (const cmd of projectCmds) {
      addIfNew({
        name: cmd.name,
        description: cmd.description,
        source: 'custom',
        scope: 'project',
        path: join(projectCommandsDir, cmd.fileName),
      });
    }
  }

  // 2. User-level commands
  const userCmds = scanCommandsDir(GLOBAL_COMMANDS_DIR, 'user');
  for (const cmd of userCmds) {
    addIfNew({
      name: cmd.name,
      description: cmd.description,
      source: 'custom',
      scope: 'user',
      path: join(GLOBAL_COMMANDS_DIR, cmd.fileName),
    });
  }

  // 3. Project-level skills (default user-invocable, unless explicitly false)
  if (agentDir) {
    const allSkills = SkillsStore.list(agentDir);
    const projectSkills = allSkills.filter((s) => s.source === 'project');
    for (const skill of projectSkills) {
      const { meta } = parseFrontmatter(skill.rawContent);
      if (meta['user-invocable'] === 'false' || meta['user-invocable'] === 'no') continue;
      addIfNew({
        name: skill.name,
        description: skill.description,
        source: 'skill',
        scope: 'project',
        path: skill.path,
      });
    }
  }

  // 4. User-level skills (enabled, default user-invocable unless explicitly false)
  const allUserSkills = SkillsStore.list(agentDir);
  const userSkills = allUserSkills.filter((s) => s.source === 'user' && s.enabled);
  for (const skill of userSkills) {
    const { meta } = parseFrontmatter(skill.rawContent);
    if (meta['user-invocable'] === 'false' || meta['user-invocable'] === 'no') continue;
    addIfNew({
      name: skill.name,
      description: skill.description,
      source: 'skill',
      scope: 'user',
      path: skill.path,
    });
  }

  // 5. Builtin commands
  for (const cmd of BUILTIN_COMMANDS) {
    addIfNew(cmd);
  }

  return commands;
}
