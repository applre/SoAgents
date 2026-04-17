import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync, statSync, copyFileSync, symlinkSync, lstatSync, readlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { safeWriteJsonSync, safeLoadJsonSync } from './safeJson';
export type { SkillItem, SkillDetail, SkillFrontmatter } from '../shared/types/skill';

const GLOBAL_SKILLS_DIR = join(homedir(), '.soagents', 'skills');
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const SKILLS_CONFIG_PATH = join(homedir(), '.soagents', 'skills-config.json');

export interface SkillInfo {
  name: string;
  description: string;
  content: string;      // 去掉 frontmatter 的 body
  rawContent: string;   // 完整文件内容
  source: 'user' | 'project';
  path: string;
  isBuiltin: boolean;
  enabled: boolean;
}

export interface SkillData {
  name: string;
  description?: string;
  allowedTools?: string[];
  content: string;      // markdown body（不含 frontmatter）
  scope: 'user' | 'project';
  agentDir?: string;
}

interface SkillsConfig {
  seeded: string[];     // 已种子化的 skill 名称
  disabled: string[];   // 已禁用的 skill 名称
}

function readSkillsConfig(): SkillsConfig {
  return safeLoadJsonSync<SkillsConfig>(SKILLS_CONFIG_PATH, { seeded: [], disabled: [] });
}

function writeSkillsConfig(config: SkillsConfig): void {
  safeWriteJsonSync(SKILLS_CONFIG_PATH, config);
}

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

function buildFrontmatter(data: SkillData): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${data.name}`);
  if (data.description) {
    lines.push(`description: ${data.description}`);
  }
  if (data.allowedTools && data.allowedTools.length > 0) {
    lines.push(`allowed-tools: [${data.allowedTools.join(', ')}]`);
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function findSkillPath(skillsDir: string, name: string): string | null {
  // Format 1: {dir}/{name}/SKILL.md
  const subdirPath = join(skillsDir, name, 'SKILL.md');
  if (existsSync(subdirPath)) {
    return subdirPath;
  }
  // Format 2: {dir}/{name}.md
  const filePath = join(skillsDir, `${name}.md`);
  if (existsSync(filePath)) {
    return filePath;
  }
  return null;
}

function scanSkillsDir(skillsDir: string, source: 'user' | 'project'): Omit<SkillInfo, 'isBuiltin' | 'enabled'>[] {
  if (!existsSync(skillsDir)) {
    return [];
  }

  const results: Omit<SkillInfo, 'isBuiltin' | 'enabled'>[] = [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);
    let skillFilePath: string | null = null;

    try {
      // 跳过 symlink — 项目 skills 目录中的 symlink 指向全局 skills，
      // 由 syncProjectSkillLinks 创建用于 SDK 运行时，不应被当作项目级 skill
      const lstat = lstatSync(entryPath);
      if (source === 'project' && lstat.isSymbolicLink()) continue;

      const stat = lstat.isSymbolicLink() ? statSync(entryPath) : lstat;
      if (stat.isDirectory()) {
        // Check {name}/SKILL.md
        const candidate = join(entryPath, 'SKILL.md');
        if (existsSync(candidate)) {
          skillFilePath = candidate;
        }
      } else if (entry.endsWith('.md')) {
        skillFilePath = entryPath;
      }
    } catch {
      continue;
    }

    if (!skillFilePath) continue;

    let rawContent: string;
    try {
      rawContent = readFileSync(skillFilePath, 'utf-8');
    } catch {
      continue;
    }

    const { meta, body } = parseFrontmatter(rawContent);
    const name = meta['name'] || entry.replace(/\.md$/, '');
    const description = meta['description'] || '';

    results.push({
      name,
      description,
      content: body,
      rawContent,
      source,
      path: skillFilePath,
    });
  }

  return results;
}

/**
 * 获取 bundled-skills 目录路径
 * 开发模式：项目根目录 bundled-skills/
 * 生产模式：Tauri resource 目录下的 bundled-skills/
 */
function getBundledSkillsDir(): string {
  // 优先检查 Tauri resource 目录（生产环境）
  const resourceDir = process.env.TAURI_RESOURCE_DIR;
  if (resourceDir) {
    const bundledDir = join(resourceDir, 'bundled-skills');
    if (existsSync(bundledDir)) return bundledDir;
  }
  // 开发环境：从 server 文件位置向上两层找项目根目录
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const devDir = join(dirname(dirname(scriptDir)), 'bundled-skills');
  if (existsSync(devDir)) return devDir;
  // 兜底：bun 运行 index.ts 时，cwd 可能就是项目根
  const cwdDir = join(process.cwd(), 'bundled-skills');
  if (existsSync(cwdDir)) return cwdDir;
  return '';
}

/**
 * 递归复制目录
 */
function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 启动时幂等种子化：复制 bundled-skills 到 ~/.soagents/skills/，不覆盖已有
 */
export function seedBundledSkills(): void {
  const bundledDir = getBundledSkillsDir();
  if (!bundledDir || !existsSync(bundledDir)) {
    console.log('[seed] bundled-skills directory not found, skipping');
    return;
  }

  if (!existsSync(GLOBAL_SKILLS_DIR)) {
    mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
  }

  const config = readSkillsConfig();
  const seededSet = new Set(config.seeded);

  let entries: string[];
  try {
    entries = readdirSync(bundledDir);
  } catch {
    return;
  }

  let changed = false;
  for (const entry of entries) {
    const srcPath = join(bundledDir, entry);
    try {
      if (!statSync(srcPath).isDirectory()) continue;
    } catch {
      continue;
    }

    // 已种子化过，跳过
    if (seededSet.has(entry)) continue;

    const destPath = join(GLOBAL_SKILLS_DIR, entry);
    // 目标已存在（用户手动创建的），不覆盖
    if (existsSync(destPath)) {
      seededSet.add(entry);
      changed = true;
      continue;
    }

    try {
      copyDirRecursive(srcPath, destPath);
      seededSet.add(entry);
      changed = true;
      console.log(`[seed] Seeded skill: ${entry}`);
    } catch (e) {
      console.error(`[seed] Failed to seed skill ${entry}:`, e);
    }
  }

  if (changed) {
    config.seeded = [...seededSet];
    writeSkillsConfig(config);
  }
}

/**
 * 获取内置 skill 名称集合（从 bundled-skills 目录扫描）
 */
function getBuiltinSkillNames(): Set<string> {
  const bundledDir = getBundledSkillsDir();
  if (!bundledDir || !existsSync(bundledDir)) return new Set();
  try {
    return new Set(
      readdirSync(bundledDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    );
  } catch {
    return new Set();
  }
}

export function list(agentDir?: string): SkillInfo[] {
  const config = readSkillsConfig();
  const disabledSet = new Set(config.disabled);
  const builtinNames = getBuiltinSkillNames();

  // 合并 ~/.soagents/skills/ 和 ~/.claude/skills/，soagents 优先
  // 同一目录内可能存在 frontmatter name 冲突（不同目录名但声明了相同 name），需要去重
  const dedup = (skills: Omit<SkillInfo, 'isBuiltin' | 'enabled'>[]) => {
    const seen = new Set<string>();
    return skills.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  };
  const soagentsSkills = dedup(scanSkillsDir(GLOBAL_SKILLS_DIR, 'user'));
  const claudeSkills = dedup(scanSkillsDir(CLAUDE_SKILLS_DIR, 'user'));
  const soagentsNameSet = new Set(soagentsSkills.map(s => s.name));
  const uniqueClaudeSkills = claudeSkills.filter(s => !soagentsNameSet.has(s.name));
  const globalSkills = [...soagentsSkills, ...uniqueClaudeSkills];

  const enriched = (skills: Omit<SkillInfo, 'isBuiltin' | 'enabled'>[]): SkillInfo[] =>
    skills.map((s) => ({
      ...s,
      isBuiltin: builtinNames.has(s.name),
      enabled: !disabledSet.has(s.name),
    }));

  if (!agentDir) {
    return enriched(globalSkills);
  }

  const projectSkillsDir = join(agentDir, '.claude', 'skills');
  const projectSkills = scanSkillsDir(projectSkillsDir, 'project');

  // 全局目录中也存在同名 skill 的，视为全局 skill（项目目录只是运行时副本）
  const globalNameSet = new Set(globalSkills.map(s => s.name));
  const trueProjectSkills = projectSkills.filter(s => !globalNameSet.has(s.name));
  const trueProjectNameSet = new Set(trueProjectSkills.map(s => s.name));
  const filtered = globalSkills.filter(s => !trueProjectNameSet.has(s.name));

  return enriched([...filtered, ...trueProjectSkills]);
}

export function get(name: string, agentDir?: string): SkillInfo | null {
  const config = readSkillsConfig();
  const disabledSet = new Set(config.disabled);
  const builtinNames = getBuiltinSkillNames();

  const enrich = (s: Omit<SkillInfo, 'isBuiltin' | 'enabled'>): SkillInfo => ({
    ...s,
    isBuiltin: builtinNames.has(s.name),
    enabled: !disabledSet.has(s.name),
  });

  // Check project first
  if (agentDir) {
    const projectSkillsDir = join(agentDir, '.claude', 'skills');
    const projectPath = findSkillPath(projectSkillsDir, name);
    if (projectPath) {
      try {
        const rawContent = readFileSync(projectPath, 'utf-8');
        const { meta, body } = parseFrontmatter(rawContent);
        return enrich({
          name: meta['name'] || name,
          description: meta['description'] || '',
          content: body,
          rawContent,
          source: 'project',
          path: projectPath,
        });
      } catch {
        // fall through
      }
    }
  }

  // Check global: ~/.soagents/skills/ first, then ~/.claude/skills/
  for (const dir of [GLOBAL_SKILLS_DIR, CLAUDE_SKILLS_DIR]) {
    const globalPath = findSkillPath(dir, name);
    if (globalPath) {
      try {
        const rawContent = readFileSync(globalPath, 'utf-8');
        const { meta, body } = parseFrontmatter(rawContent);
        return enrich({
          name: meta['name'] || name,
          description: meta['description'] || '',
          content: body,
          rawContent,
          source: 'user',
          path: globalPath,
        });
      } catch {
        // fall through
      }
    }
  }

  return null;
}

export function create(skill: SkillData): void {
  let skillsDir: string;
  if (skill.scope === 'project' && skill.agentDir) {
    skillsDir = join(skill.agentDir, '.claude', 'skills');
  } else {
    skillsDir = GLOBAL_SKILLS_DIR;
  }

  const targetDir = join(skillsDir, skill.name);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const filePath = join(targetDir, 'SKILL.md');
  const frontmatter = buildFrontmatter(skill);
  writeFileSync(filePath, frontmatter + skill.content, 'utf-8');
}

export function update(name: string, skill: SkillData): void {
  let skillsDir: string;
  if (skill.scope === 'project' && skill.agentDir) {
    skillsDir = join(skill.agentDir, '.claude', 'skills');
  } else {
    skillsDir = GLOBAL_SKILLS_DIR;
  }

  const existingPath = findSkillPath(skillsDir, name);
  const frontmatter = buildFrontmatter(skill);

  if (existingPath) {
    writeFileSync(existingPath, frontmatter + skill.content, 'utf-8');
  } else {
    // Create if not found
    const targetDir = join(skillsDir, name);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    writeFileSync(join(targetDir, 'SKILL.md'), frontmatter + skill.content, 'utf-8');
  }
}

/**
 * 删除 skill（拒绝删除内置）
 */
export function deleteSkill(name: string, scope: 'user' | 'project', agentDir?: string): boolean {
  const builtinNames = getBuiltinSkillNames();
  if (builtinNames.has(name) && scope === 'user') {
    return false; // 不允许删除内置 skill
  }

  let skillsDir: string;
  if (scope === 'project' && agentDir) {
    skillsDir = join(agentDir, '.claude', 'skills');
  } else {
    skillsDir = GLOBAL_SKILLS_DIR;
  }

  // Try {name}/SKILL.md first
  const subdirPath = join(skillsDir, name, 'SKILL.md');
  if (existsSync(subdirPath)) {
    unlinkSync(subdirPath);
    // Remove the parent directory if now empty
    try {
      const dir = join(skillsDir, name);
      const remaining = readdirSync(dir);
      if (remaining.length === 0) {
        rmdirSync(dir);
      }
    } catch {
      // ignore
    }
    return true;
  }

  // Try {name}.md
  const filePath = join(skillsDir, `${name}.md`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return true;
  }

  return true;
}

/**
 * 切换 skill 的启用/禁用状态
 */
export function toggleSkill(name: string, enabled: boolean): void {
  const config = readSkillsConfig();
  const disabledSet = new Set(config.disabled);
  if (enabled) {
    disabledSet.delete(name);
  } else {
    disabledSet.add(name);
  }
  config.disabled = [...disabledSet];
  writeSkillsConfig(config);
}

/**
 * 将用户级别已启用的 skills 同步为 agentDir 下的符号链接。
 * 清理悬空符号链接（源路径已不存在）。
 * 所有操作均 try/catch，不影响 session 启动。
 */
export function syncToProject(agentDir: string): void {
  const targetDir = join(agentDir, '.claude', 'skills');
  try {
    mkdirSync(targetDir, { recursive: true });
  } catch {
    return;
  }

  // 获取用户级别已启用的 skills
  let enabledSkills: SkillInfo[];
  try {
    enabledSkills = list().filter((s) => s.source === 'user' && s.enabled);
  } catch {
    return;
  }

  // 为每个已启用 skill 创建符号链接（指向 skill 目录，即 SKILL.md 的父目录）
  for (const skill of enabledSkills) {
    try {
      // skill.path 指向 SKILL.md，符号链接应指向其父目录（{name}/）
      // skill 可能来自 ~/.soagents/skills/ 或 ~/.claude/skills/
      const sourcePath = dirname(skill.path);
      if (!existsSync(sourcePath)) continue;

      const linkPath = join(targetDir, skill.name);
      let linkStat: ReturnType<typeof lstatSync> | null = null;
      try {
        linkStat = lstatSync(linkPath);
      } catch {
        // 不存在，继续创建
      }

      if (linkStat) {
        if (linkStat.isSymbolicLink()) {
          // 已是符号链接，检查是否悬空
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
          continue; // 是真实文件/目录，跳过
        }
      }

      symlinkSync(sourcePath, linkPath);
    } catch {
      // 单个 skill 失败不影响其他
    }
  }

  // 清理悬空符号链接
  try {
    const entries = readdirSync(targetDir);
    for (const entry of entries) {
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
