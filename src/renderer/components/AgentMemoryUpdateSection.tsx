import { useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AgentConfig } from '../../shared/types/agentConfig';
import type { MemoryAutoUpdateConfig } from '../../shared/types/im';
import { DEFAULT_MEMORY_AUTO_UPDATE_CONFIG } from '../../shared/types/im';
import { patchAgentConfig } from '../config/agentConfigService';
import { formatRelativeTime } from '../utils/formatTime';

// ── Constants ──

const INTERVAL_OPTIONS: { value: 24 | 48 | 72; label: string }[] = [
  { value: 24, label: '24小时' },
  { value: 48, label: '48小时' },
  { value: 72, label: '72小时' },
];

const DEFAULT_UPDATE_MEMORY_CONTENT = `---
description: >
  记忆维护指令 -- SoAgents 在夜间将会使用该指令自动注入到活跃 session 执行。
---

整理你的记忆。不用赶时间，做仔细。

## 要做什么

1. **读近期日志** -- 今天 + 上次维护以来的所有 memory/YYYY-MM-DD.md
2. **更新 topic 文件** -- 最近工作过的项目，把新经验、状态变更、决策同步到 memory/topics/<name>.md
3. **更新核心记忆** -- 提炼跨项目的新教训到核心记忆文件；更新 Ongoing Context；清理过时信息
4. **整理工作区** -- 把散落的临时文件归档整理
5. **Commit + push** -- 如果工作区是 git 仓库，仅 git add 你本次更新的记忆相关文件，提交并推送

## 原则

- 信息只存一处 -- topic file 里写详细了，核心记忆只放指针
- 每条记忆带时间戳 (YYYY-MM-DD)
- 删比留更重要 -- 过时信息是噪音
- 做完后在今天的日志里记一笔
`;

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Shanghai';
  }
}

// ── Component ──

interface Props {
  agent: AgentConfig;
  onAgentChanged: () => void;
}

export default function AgentMemoryUpdateSection({ agent, onAgentChanged }: Props) {
  const [saving, setSaving] = useState(false);

  const cfg: MemoryAutoUpdateConfig = useMemo(
    () => ({ ...DEFAULT_MEMORY_AUTO_UPDATE_CONFIG, ...agent.memoryAutoUpdate }),
    [agent.memoryAutoUpdate],
  );

  const filePath = `${agent.workspacePath}/UPDATE_MEMORY.md`;

  const patchConfig = useCallback(
    async (patch: Partial<MemoryAutoUpdateConfig>) => {
      if (saving) return;
      setSaving(true);
      try {
        const current: MemoryAutoUpdateConfig = {
          ...DEFAULT_MEMORY_AUTO_UPDATE_CONFIG,
          ...agent.memoryAutoUpdate,
        };
        await patchAgentConfig(agent.id, {
          memoryAutoUpdate: { ...current, ...patch },
        });
        onAgentChanged();
      } catch (e) {
        console.error('[AgentMemoryUpdateSection] patchConfig failed:', e);
      } finally {
        setSaving(false);
      }
    },
    [agent.id, agent.memoryAutoUpdate, onAgentChanged, saving],
  );

  const handleToggle = useCallback(async () => {
    const nextEnabled = !cfg.enabled;
    if (nextEnabled) {
      // First time enabling: create UPDATE_MEMORY.md if it doesn't exist
      try {
        const { exists, writeTextFile } = await import('@tauri-apps/plugin-fs');
        const fileExists = await exists(filePath);
        if (!fileExists) {
          await writeTextFile(filePath, DEFAULT_UPDATE_MEMORY_CONTENT);
        }
      } catch (e) {
        console.error('[AgentMemoryUpdateSection] Failed to create UPDATE_MEMORY.md:', e);
      }
    }
    await patchConfig({
      enabled: nextEnabled,
      updateWindowTimezone: nextEnabled ? (cfg.updateWindowTimezone || getLocalTimezone()) : cfg.updateWindowTimezone,
    });
  }, [cfg.enabled, cfg.updateWindowTimezone, filePath, patchConfig]);

  const handleOpenFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(filePath);
    } catch {
      // Fallback: open in Finder
      await invoke('cmd_open_in_finder', { path: filePath }).catch(() => {});
    }
  }, [filePath]);

  const timezoneLabel = cfg.updateWindowTimezone || getLocalTimezone();

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <span className="text-[14px] font-medium text-[var(--ink)]">
            记忆更新 Memory
          </span>
          <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
            在夜间自动读取{' '}
            <button
              type="button"
              onClick={() => { void handleOpenFile(); }}
              className="text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-[12px]"
            >
              UPDATE_MEMORY.md
            </button>
            {' '}执行记忆维护
          </p>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            saving ? 'cursor-wait opacity-50' : 'cursor-pointer'
          } ${
            cfg.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
          }`}
          disabled={saving}
          onClick={() => { void handleToggle(); }}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              cfg.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Expanded settings when enabled */}
      {cfg.enabled && (
        <div className="mt-4 border-t border-[var(--border)] pt-4 flex flex-col gap-4">

          {/* Interval */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-secondary)] flex-shrink-0">更新间隔</span>
            <div className="flex gap-1.5">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { void patchConfig({ intervalHours: opt.value }); }}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    cfg.intervalHours === opt.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Update window */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-secondary)] flex-shrink-0">更新时间窗口</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={cfg.updateWindowStart}
                onChange={(e) => { void patchConfig({ updateWindowStart: e.target.value }); }}
                className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-[12px] text-[var(--ink-tertiary)]">~</span>
              <input
                type="time"
                value={cfg.updateWindowEnd}
                onChange={(e) => { void patchConfig({ updateWindowEnd: e.target.value }); }}
                className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-[12px] text-[var(--ink-tertiary)]">{timezoneLabel}</span>
            </div>
          </div>

          {/* Query threshold */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--ink-secondary)] flex-shrink-0">触发阈值</span>
            <span className="text-[12px] text-[var(--ink-tertiary)]">自上次更新后至少</span>
            <input
              type="number"
              min={3}
              max={50}
              value={cfg.queryThreshold}
              onChange={(e) => {
                const v = Math.max(3, Math.min(50, parseInt(e.target.value, 10) || 3));
                void patchConfig({ queryThreshold: v });
              }}
              className="w-14 rounded-md bg-[var(--surface)] px-2 py-1 text-[12px] text-center border border-[var(--border)] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            />
            <span className="text-[12px] text-[var(--ink-tertiary)]">条新对话才会触发</span>
          </div>

          {/* Last batch info */}
          {cfg.lastBatchAt && (
            <div className="text-[12px] text-[var(--ink-tertiary)]">
              上次更新 {formatRelativeTime(cfg.lastBatchAt)}
              {cfg.lastBatchSessionCount != null && cfg.lastBatchSessionCount > 0 && (
                <span>（{cfg.lastBatchSessionCount} 个 session）</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
