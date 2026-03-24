import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  rmSync,
  renameSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { safeWriteJsonSync, safeLoadJsonSync } from './safeJson';
import type {
  AgentFrontmatter,
  AgentMeta,
  AgentItem,
  AgentDetail,
  AgentWorkspaceConfig,
} from '../shared/types/agent';

export type { AgentFrontmatter, AgentMeta, AgentItem, AgentDetail, AgentWorkspaceConfig };

const GLOBAL_AGENTS_DIR = join(homedir(), '.soagents', 'agents');

interface SdkAgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku';
  skills?: string[];
  maxTurns?: number;
}

// ============= Frontmatter Parsing =============

export function parseFrontmatter(raw: string): { frontmatter: AgentFrontmatter; body: string } {
  const defaultFrontmatter: AgentFrontmatter = { name: '' };

  if (!raw.startsWith('---')) {
    return { frontmatter: defaultFrontmatter, body: raw };
  }

  const endIndex = raw.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { frontmatter: defaultFrontmatter, body: raw };
  }

  const frontmatterBlock = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 4).trimStart();

  const meta: Record<string, string> = {};
  for (const line of frontmatterBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  const frontmatter: AgentFrontmatter = {
    name: meta['name'] || '',
  };

  if (meta['description']) {
    frontmatter.description = meta['description'];
  }

  if (meta['model']) {
    const modelVal = meta['model'] as AgentFrontmatter['model'];
    if (modelVal === 'sonnet' || modelVal === 'opus' || modelVal === 'haiku' || modelVal === 'inherit') {
      frontmatter.model = modelVal;
    }
  }

  if (meta['tools']) {
    frontmatter.tools = meta['tools'];
  }

  if (meta['disallowed-tools'] || meta['disallowedTools']) {
    frontmatter.disallowedTools = meta['disallowed-tools'] || meta['disallowedTools'];
  }

  if (meta['permission-mode'] || meta['permissionMode']) {
    frontmatter.permissionMode = meta['permission-mode'] || meta['permissionMode'];
  }

  if (meta['skills']) {
    const skillsRaw = meta['skills'];
    // Try JSON array first, then comma-separated
    try {
      const parsed = JSON.parse(skillsRaw);
      if (Array.isArray(parsed)) {
        frontmatter.skills = parsed as string[];
      } else {
        frontmatter.skills = skillsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      frontmatter.skills = skillsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  if (meta['max-turns'] || meta['maxTurns']) {
    const turnsStr = meta['max-turns'] || meta['maxTurns'];
    const parsed = parseInt(turnsStr, 10);
    if (!isNaN(parsed)) {
      frontmatter.maxTurns = parsed;
    }
  }

  return { frontmatter, body };
}

// ============= Frontmatter Building =============

export function buildFrontmatter(frontmatter: AgentFrontmatter): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${frontmatter.name}`);

  if (frontmatter.description) {
    lines.push(`description: ${frontmatter.description}`);
  }
  if (frontmatter.model) {
    lines.push(`model: ${frontmatter.model}`);
  }
  if (frontmatter.tools) {
    lines.push(`tools: ${frontmatter.tools}`);
  }
  if (frontmatter.disallowedTools) {
    lines.push(`disallowed-tools: ${frontmatter.disallowedTools}`);
  }
  if (frontmatter.permissionMode) {
    lines.push(`permission-mode: ${frontmatter.permissionMode}`);
  }
  if (frontmatter.skills && frontmatter.skills.length > 0) {
    lines.push(`skills: ${JSON.stringify(frontmatter.skills)}`);
  }
  if (frontmatter.maxTurns !== undefined) {
    lines.push(`max-turns: ${frontmatter.maxTurns}`);
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ============= Meta File =============

export function readAgentMeta(folderPath: string): AgentMeta | undefined {
  const metaPath = join(folderPath, '_meta.json');
  if (!existsSync(metaPath)) {
    return undefined;
  }
  return safeLoadJsonSync<AgentMeta | undefined>(metaPath, undefined);
}

export function writeAgentMeta(folderPath: string, meta: AgentMeta): void {
  const metaPath = join(folderPath, '_meta.json');
  safeWriteJsonSync(metaPath, meta);
}

// ============= Scan =============

export function scanAgents(dir: string, source: 'user' | 'project'): AgentItem[] {
  if (!existsSync(dir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const results: AgentItem[] = [];

  for (const entry of entries) {
    // Skip folders starting with _ or .
    if (entry.startsWith('_') || entry.startsWith('.')) {
      continue;
    }

    const entryPath = join(dir, entry);

    let isDir = false;
    try {
      isDir = statSync(entryPath).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) continue;

    const agentFilePath = join(entryPath, `${entry}.md`);
    if (!existsSync(agentFilePath)) {
      continue;
    }

    let rawContent: string;
    try {
      rawContent = readFileSync(agentFilePath, 'utf-8');
    } catch {
      continue;
    }

    const { frontmatter } = parseFrontmatter(rawContent);
    const meta = readAgentMeta(entryPath);

    results.push({
      name: frontmatter.name || entry,
      folderName: entry,
      description: frontmatter.description || '',
      model: frontmatter.model,
      source,
      enabled: true, // will be overridden by workspace config
      meta,
    });
  }

  return results;
}

// ============= Workspace Config =============

export function readWorkspaceConfig(agentDir: string): AgentWorkspaceConfig {
  const configPath = join(agentDir, '.claude', 'agents', '_workspace.json');
  return safeLoadJsonSync<AgentWorkspaceConfig>(configPath, { local: {}, global_refs: {} });
}

export function writeWorkspaceConfig(agentDir: string, config: AgentWorkspaceConfig): void {
  const configPath = join(agentDir, '.claude', 'agents', '_workspace.json');
  safeWriteJsonSync(configPath, config);
}

// ============= List =============

export function list(agentDir?: string): AgentItem[] {
  const userAgents = scanAgents(GLOBAL_AGENTS_DIR, 'user');

  if (!agentDir) {
    // Without workspace config, user agents are disabled by default
    return userAgents.map((a) => ({ ...a, enabled: false }));
  }

  const projectAgentsDir = join(agentDir, '.claude', 'agents');
  const projectAgents = scanAgents(projectAgentsDir, 'project');
  const wsConfig = readWorkspaceConfig(agentDir);

  // Apply enable state for project agents
  const enrichedProject = projectAgents.map((a) => {
    const localCfg = wsConfig.local[a.folderName];
    const enabled = localCfg === undefined ? true : localCfg.enabled !== false;
    return { ...a, enabled };
  });

  // Apply enable state for user agents (only enabled if global_refs has enabled=true)
  const enrichedUser = userAgents.map((a) => {
    const refCfg = wsConfig.global_refs[a.folderName];
    const enabled = refCfg !== undefined && refCfg.enabled === true;
    return { ...a, enabled };
  });

  // Project overrides user on same folderName
  const projectFolderNames = new Set(projectAgents.map((a) => a.folderName));
  const filteredUser = enrichedUser.filter((a) => !projectFolderNames.has(a.folderName));

  return [...filteredUser, ...enrichedProject];
}

// ============= Get Single Agent =============

export function get(folderName: string, scope: 'user' | 'project', agentDir?: string): AgentDetail | null {
  let agentsDir: string;
  if (scope === 'project' && agentDir) {
    agentsDir = join(agentDir, '.claude', 'agents');
  } else {
    agentsDir = GLOBAL_AGENTS_DIR;
  }

  const folderPath = join(agentsDir, folderName);
  const agentFilePath = join(folderPath, `${folderName}.md`);

  if (!existsSync(agentFilePath)) {
    return null;
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(agentFilePath, 'utf-8');
  } catch {
    return null;
  }

  const { frontmatter, body } = parseFrontmatter(rawContent);
  const meta = readAgentMeta(folderPath);

  let enabled = true;
  if (agentDir) {
    const wsConfig = readWorkspaceConfig(agentDir);
    if (scope === 'project') {
      const localCfg = wsConfig.local[folderName];
      enabled = localCfg === undefined ? true : localCfg.enabled !== false;
    } else {
      const refCfg = wsConfig.global_refs[folderName];
      enabled = refCfg !== undefined && refCfg.enabled === true;
    }
  } else {
    // No workspace context: user agents are disabled by default
    enabled = scope !== 'user';
  }

  return {
    name: frontmatter.name || folderName,
    folderName,
    description: frontmatter.description || '',
    model: frontmatter.model,
    source: scope,
    enabled,
    meta,
    body,
    rawContent,
    path: agentFilePath,
    frontmatter,
  };
}

// ============= Create =============

export function create(data: {
  name: string;
  folderName: string;
  description?: string;
  model?: AgentFrontmatter['model'];
  body: string;
  scope: 'user' | 'project';
  agentDir?: string;
  tools?: string;
  disallowedTools?: string;
  permissionMode?: string;
  skills?: string[];
  maxTurns?: number;
}): void {
  let agentsDir: string;
  if (data.scope === 'project' && data.agentDir) {
    agentsDir = join(data.agentDir, '.claude', 'agents');
  } else {
    agentsDir = GLOBAL_AGENTS_DIR;
  }

  const folderPath = join(agentsDir, data.folderName);
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  const frontmatter: AgentFrontmatter = {
    name: data.name,
    description: data.description,
    model: data.model,
    tools: data.tools,
    disallowedTools: data.disallowedTools,
    permissionMode: data.permissionMode,
    skills: data.skills,
    maxTurns: data.maxTurns,
  };

  const agentFilePath = join(folderPath, `${data.folderName}.md`);
  writeFileSync(agentFilePath, buildFrontmatter(frontmatter) + data.body, 'utf-8');

  const now = new Date().toISOString();
  writeAgentMeta(folderPath, {
    createdAt: now,
    updatedAt: now,
  });
}

// ============= Update =============

export function update(
  folderName: string,
  data: {
    name: string;
    description?: string;
    model?: AgentFrontmatter['model'];
    body: string;
    scope: 'user' | 'project';
    agentDir?: string;
    tools?: string;
    disallowedTools?: string;
    permissionMode?: string;
    skills?: string[];
    maxTurns?: number;
  },
  newFolderName?: string
): void {
  let agentsDir: string;
  if (data.scope === 'project' && data.agentDir) {
    agentsDir = join(data.agentDir, '.claude', 'agents');
  } else {
    agentsDir = GLOBAL_AGENTS_DIR;
  }

  const oldFolderPath = join(agentsDir, folderName);
  const targetFolderName = newFolderName || folderName;
  const targetFolderPath = join(agentsDir, targetFolderName);

  // If renaming, rename folder first
  if (newFolderName && newFolderName !== folderName && existsSync(oldFolderPath)) {
    if (!existsSync(targetFolderPath)) {
      renameSync(oldFolderPath, targetFolderPath);
    }
  }

  if (!existsSync(targetFolderPath)) {
    mkdirSync(targetFolderPath, { recursive: true });
  }

  const frontmatter: AgentFrontmatter = {
    name: data.name,
    description: data.description,
    model: data.model,
    tools: data.tools,
    disallowedTools: data.disallowedTools,
    permissionMode: data.permissionMode,
    skills: data.skills,
    maxTurns: data.maxTurns,
  };

  // After rename: old file name might differ from new folder name
  // Remove old .md if renamed
  if (newFolderName && newFolderName !== folderName) {
    const oldMdPath = join(targetFolderPath, `${folderName}.md`);
    if (existsSync(oldMdPath)) {
      try {
        rmSync(oldMdPath);
      } catch {
        // ignore
      }
    }
  }

  const agentFilePath = join(targetFolderPath, `${targetFolderName}.md`);
  writeFileSync(agentFilePath, buildFrontmatter(frontmatter) + data.body, 'utf-8');

  // Update meta updatedAt
  const existingMeta = readAgentMeta(targetFolderPath) || {};
  writeAgentMeta(targetFolderPath, {
    ...existingMeta,
    updatedAt: new Date().toISOString(),
  });
}

// ============= Remove =============

export function remove(folderName: string, scope: 'user' | 'project', agentDir?: string): boolean {
  let agentsDir: string;
  if (scope === 'project' && agentDir) {
    agentsDir = join(agentDir, '.claude', 'agents');
  } else {
    agentsDir = GLOBAL_AGENTS_DIR;
  }

  const folderPath = join(agentsDir, folderName);
  if (!existsSync(folderPath)) {
    return false;
  }

  try {
    rmSync(folderPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// ============= SDK Conversion =============

function toSdkAgentDefinition(frontmatter: AgentFrontmatter, body: string): SdkAgentDefinition {
  const def: SdkAgentDefinition = {
    description: frontmatter.description || '',
    prompt: body.trim(),
  };

  if (frontmatter.tools) {
    def.tools = frontmatter.tools.split(',').map((t) => t.trim()).filter(Boolean);
  }

  if (frontmatter.disallowedTools) {
    def.disallowedTools = frontmatter.disallowedTools.split(',').map((t) => t.trim()).filter(Boolean);
  }

  if (frontmatter.model && frontmatter.model !== 'inherit') {
    def.model = frontmatter.model;
  }

  if (frontmatter.skills && frontmatter.skills.length > 0) {
    def.skills = frontmatter.skills;
  }

  if (frontmatter.maxTurns !== undefined) {
    def.maxTurns = frontmatter.maxTurns;
  }

  return def;
}

// ============= loadEnabledAgents =============

export function loadEnabledAgents(agentDir: string): Record<string, SdkAgentDefinition> {
  const result: Record<string, SdkAgentDefinition> = {};
  const wsConfig = readWorkspaceConfig(agentDir);

  const projectAgentsDir = join(agentDir, '.claude', 'agents');
  const projectAgents = scanAgents(projectAgentsDir, 'project');

  const userAgents = scanAgents(GLOBAL_AGENTS_DIR, 'user');

  // Track which folderNames come from project (project takes priority)
  const projectFolderNames = new Set<string>();

  for (const agent of projectAgents) {
    const localCfg = wsConfig.local[agent.folderName];
    const enabled = localCfg === undefined ? true : localCfg.enabled !== false;
    if (!enabled) continue;

    const folderPath = join(projectAgentsDir, agent.folderName);
    const agentFilePath = join(folderPath, `${agent.folderName}.md`);

    let rawContent: string;
    try {
      rawContent = readFileSync(agentFilePath, 'utf-8');
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(rawContent);
    result[agent.folderName] = toSdkAgentDefinition(frontmatter, body);
    projectFolderNames.add(agent.folderName);
  }

  for (const agent of userAgents) {
    // Skip if project already has an agent with same folderName
    if (projectFolderNames.has(agent.folderName)) continue;

    // User agents only loaded if explicitly enabled in global_refs
    const refCfg = wsConfig.global_refs[agent.folderName];
    if (!refCfg || refCfg.enabled !== true) continue;

    const folderPath = join(GLOBAL_AGENTS_DIR, agent.folderName);
    const agentFilePath = join(folderPath, `${agent.folderName}.md`);

    let rawContent: string;
    try {
      rawContent = readFileSync(agentFilePath, 'utf-8');
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(rawContent);
    result[agent.folderName] = toSdkAgentDefinition(frontmatter, body);
  }

  return result;
}
