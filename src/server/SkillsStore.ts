import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const GLOBAL_SKILLS_DIR = join(homedir(), '.soagents', 'skills');

export interface SkillInfo {
  name: string;
  description: string;
  content: string;      // 去掉 frontmatter 的 body
  rawContent: string;   // 完整文件内容
  source: 'global' | 'project';
  path: string;
}

export interface SkillData {
  name: string;
  description?: string;
  allowedTools?: string[];
  content: string;      // markdown body（不含 frontmatter）
  scope: 'global' | 'project';
  agentDir?: string;
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

function parseAllowedTools(value: string): string[] {
  // Handle [Read, Write] or "Read, Write" formats
  const cleaned = value.replace(/^\[|\]$/g, '').trim();
  if (!cleaned) return [];
  return cleaned.split(',').map(s => s.trim()).filter(Boolean);
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

function scanSkillsDir(skillsDir: string, source: 'global' | 'project'): SkillInfo[] {
  if (!existsSync(skillsDir)) {
    return [];
  }

  const results: SkillInfo[] = [];

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
      const stat = statSync(entryPath);
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

export function list(agentDir?: string): SkillInfo[] {
  const globalSkills = scanSkillsDir(GLOBAL_SKILLS_DIR, 'global');

  if (!agentDir) {
    return globalSkills;
  }

  const projectSkillsDir = join(agentDir, '.claude', 'skills');
  const projectSkills = scanSkillsDir(projectSkillsDir, 'project');

  // Project skills override global skills with same name
  const nameSet = new Set(projectSkills.map(s => s.name));
  const filtered = globalSkills.filter(s => !nameSet.has(s.name));

  return [...filtered, ...projectSkills];
}

export function get(name: string, agentDir?: string): SkillInfo | null {
  // Check project first
  if (agentDir) {
    const projectSkillsDir = join(agentDir, '.claude', 'skills');
    const projectPath = findSkillPath(projectSkillsDir, name);
    if (projectPath) {
      try {
        const rawContent = readFileSync(projectPath, 'utf-8');
        const { meta, body } = parseFrontmatter(rawContent);
        return {
          name: meta['name'] || name,
          description: meta['description'] || '',
          content: body,
          rawContent,
          source: 'project',
          path: projectPath,
        };
      } catch {
        // fall through
      }
    }
  }

  // Check global
  const globalPath = findSkillPath(GLOBAL_SKILLS_DIR, name);
  if (globalPath) {
    try {
      const rawContent = readFileSync(globalPath, 'utf-8');
      const { meta, body } = parseFrontmatter(rawContent);
      return {
        name: meta['name'] || name,
        description: meta['description'] || '',
        content: body,
        rawContent,
        source: 'global',
        path: globalPath,
      };
    } catch {
      // fall through
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

export function deleteSkill(name: string, scope: 'global' | 'project', agentDir?: string): void {
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
    return;
  }

  // Try {name}.md
  const filePath = join(skillsDir, `${name}.md`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}
