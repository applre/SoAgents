import { useState, useCallback, useMemo } from 'react';
import type { AgentConfig } from '../../shared/types/agentConfig';
import type { HeartbeatConfig } from '../../shared/types/im';
import { DEFAULT_HEARTBEAT_CONFIG } from '../../shared/types/im';
import { patchAgentConfig } from '../config/agentConfigService';

// ── Constants ──

const INTERVAL_OPTIONS = [
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '60分钟', value: 60 },
] as const;

const DEFAULT_HEARTBEAT_MD = `---
description: >
  心跳检查任务清单 -- SoAgents 定期读取此文件并执行检查。
---

## 待检查事项

- 检查工作区状态
- 整理待处理任务
`;

// ── Component ──

interface Props {
  agent: AgentConfig;
  onAgentChanged: () => void;
}

export default function AgentHeartbeatSection({ agent, onAgentChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [mdContent, setMdContent] = useState('');
  const [saving, setSaving] = useState(false);

  const hb: HeartbeatConfig = useMemo(
    () => ({
      ...DEFAULT_HEARTBEAT_CONFIG,
      ...agent.heartbeat,
    }),
    [agent.heartbeat],
  );

  const activeHours = useMemo(
    () =>
      hb.activeHours ?? {
        start: '09:00',
        end: '22:00',
        timezone: 'Asia/Shanghai',
      },
    [hb.activeHours],
  );

  // ── Patch helper ──

  const patch = useCallback(
    async (updates: Partial<HeartbeatConfig>) => {
      const merged: HeartbeatConfig = { ...hb, ...updates };
      await patchAgentConfig(agent.id, { heartbeat: merged });
      onAgentChanged();
    },
    [agent.id, hb, onAgentChanged],
  );

  // ── Toggle ──

  const handleToggle = useCallback(() => {
    void patch({ enabled: !hb.enabled });
  }, [hb.enabled, patch]);

  // ── Interval ──

  const handleInterval = useCallback(
    (minutes: number) => {
      void patch({ intervalMinutes: minutes });
    },
    [patch],
  );

  // ── Active hours ──

  const handleActiveHoursChange = useCallback(
    (field: 'start' | 'end', value: string) => {
      void patch({
        activeHours: { ...activeHours, [field]: value },
      });
    },
    [activeHours, patch],
  );

  // ── HEARTBEAT.md file operations ──

  const heartbeatMdPath = `${agent.workspacePath}/HEARTBEAT.md`;

  const handleEditMd = useCallback(async () => {
    try {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      let content: string;
      if (await exists(heartbeatMdPath)) {
        content = await readTextFile(heartbeatMdPath);
      } else {
        content = DEFAULT_HEARTBEAT_MD;
      }
      setMdContent(content);
      setEditing(true);
    } catch (e) {
      console.error('[AgentHeartbeatSection] Failed to read HEARTBEAT.md:', e);
    }
  }, [heartbeatMdPath]);

  const handleSaveMd = useCallback(async () => {
    setSaving(true);
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(heartbeatMdPath, mdContent);
      setEditing(false);
    } catch (e) {
      console.error('[AgentHeartbeatSection] Failed to write HEARTBEAT.md:', e);
    } finally {
      setSaving(false);
    }
  }, [heartbeatMdPath, mdContent]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <div>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <span className="text-[14px] font-medium text-[var(--ink)]">
            心跳感知 Heartbeat
          </span>
          <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
            心跳感知赋予 Agent 按心跳间隔时间苏醒，检查一下心跳清单{' '}
            <button
              type="button"
              onClick={() => { void handleEditMd(); }}
              className="text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-[12px]"
            >
              HEARTBEAT.md
            </button>
            {' '}里面的任务
          </p>
        </div>
        <button
          type="button"
          className={`relative h-6 w-11 shrink-0 rounded-full cursor-pointer transition-colors ${
            hb.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
          }`}
          onClick={handleToggle}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              hb.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Expanded settings when enabled */}
      {hb.enabled && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Interval selection */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-secondary)] shrink-0">心跳间隔</span>
            <div className="flex gap-1.5">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleInterval(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    hb.intervalMinutes === opt.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active hours */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-secondary)] shrink-0">活跃时段</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={activeHours.start}
                onChange={(e) => handleActiveHoursChange('start', e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-[12px] text-[var(--ink-tertiary)]">至</span>
              <input
                type="time"
                value={activeHours.end}
                onChange={(e) => handleActiveHoursChange('end', e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-[12px] text-[var(--ink-tertiary)]">
                {agent.heartbeat?.activeHours?.timezone ?? 'Asia/Shanghai'}
              </span>
            </div>
          </div>

          {/* HEARTBEAT.md editor modal */}
          {editing && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--ink-secondary)]">
                  HEARTBEAT.md
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => { void handleSaveMd(); }}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              <textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                rows={10}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] font-mono leading-relaxed focus:border-[var(--accent)] focus:outline-none resize-y"
                placeholder="编辑心跳检查任务..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
