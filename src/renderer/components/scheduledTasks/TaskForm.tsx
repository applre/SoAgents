import { useState, useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import type { ScheduledTask, ScheduledTaskInput } from '../../../shared/types/scheduledTask';
import { useScheduledTasks } from '../../context/ScheduledTaskContext';
import { useConfig } from '../../context/ConfigContext';
import CustomSelect from '../CustomSelect';
import {
  defaultScheduleUI,
  parseScheduleToUI,
  scheduleUIToSchedule,
  TIMEZONE_OPTIONS,
  type ScheduleUI,
  type ScheduleMode,
} from './scheduleUtils';

interface Props {
  editingTask?: ScheduledTask | null;
}

const SCHEDULE_MODES: { value: ScheduleMode; label: string }[] = [
  { value: 'once', label: '单次执行' },
  { value: 'every', label: '固定间隔' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

const INTERVAL_PRESETS = [
  { value: 5, label: '5 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
  { value: 480, label: '8 小时' },
  { value: 1440, label: '24 小时' },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function TaskForm({ editingTask }: Props) {
  const { createTask, updateTask, setViewMode, loadTasks } = useScheduledTasks();
  const { config, currentProvider: provider } = useConfig();
  const isEditing = !!editingTask;

  const [name, setName] = useState(editingTask?.name ?? '');
  const [prompt, setPrompt] = useState(editingTask?.prompt ?? '');
  const [workingDirectory, setWorkingDirectory] = useState(editingTask?.workingDirectory ?? '~/.soagents');
  const [scheduleUI, setScheduleUI] = useState<ScheduleUI>(
    editingTask ? parseScheduleToUI(editingTask.schedule) : defaultScheduleUI()
  );
  const [runMode, setRunMode] = useState<'single_session' | 'new_session'>(
    editingTask?.runMode ?? 'new_session'
  );
  const [aiCanExit, setAiCanExit] = useState(
    editingTask?.endConditions?.aiCanExit ?? false
  );
  const [maxExecutions, setMaxExecutions] = useState<string>(
    editingTask?.endConditions?.maxExecutions?.toString() ?? ''
  );
  const [deadline, setDeadline] = useState(
    editingTask?.endConditions?.deadline
      ? new Date(editingTask.endConditions.deadline).toISOString().slice(0, 16)
      : ''
  );
  const [timeoutMinutes, setTimeoutMinutes] = useState<string>(
    editingTask?.timeoutMinutes?.toString() ?? '10'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = '请输入任务名称';
    if (!prompt.trim()) errs.prompt = '请输入 Prompt';
    if (!workingDirectory.trim()) errs.workingDirectory = '请选择工作目录';
    if (scheduleUI.mode === 'once') {
      if (!scheduleUI.datetime) {
        errs.datetime = '请选择执行时间';
      } else if (new Date(scheduleUI.datetime).getTime() <= Date.now()) {
        errs.datetime = '执行时间需在未来';
      }
    }
    if (scheduleUI.mode === 'every') {
      if (!scheduleUI.minutes || scheduleUI.minutes < 1) {
        errs.minutes = '间隔至少 1 分钟';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, prompt, workingDirectory, scheduleUI]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Snapshot current provider config at task creation time
      const providerEnv = provider && provider.type === 'api'
        ? {
            baseUrl: provider.config?.baseUrl as string | undefined,
            apiKey: config.apiKeys?.[provider.id] ?? '',
            authType: provider.authType,
            apiProtocol: provider.apiProtocol,
            timeout: provider.config?.timeout as number | undefined,
            disableNonessential: provider.config?.disableNonessential as boolean | undefined,
          }
        : undefined;
      const snapshotModel = config.currentModelId ?? provider?.primaryModel;

      const endConditions = (maxExecutions || deadline || aiCanExit)
        ? {
            maxExecutions: maxExecutions ? parseInt(maxExecutions, 10) : undefined,
            deadline: deadline ? new Date(deadline).toISOString() : undefined,
            aiCanExit,
          }
        : undefined;

      const input: ScheduledTaskInput = {
        name: name.trim(),
        prompt: prompt.trim(),
        workingDirectory: workingDirectory.trim(),
        schedule: scheduleUIToSchedule(scheduleUI),
        enabled: editingTask?.enabled ?? true,
        providerEnv,
        model: snapshotModel,
        permissionMode: 'bypassPermissions',
        runMode,
        endConditions,
        timeoutMinutes: timeoutMinutes ? parseInt(timeoutMinutes, 10) : undefined,
      };
      if (isEditing && editingTask) {
        await updateTask(editingTask.id, input);
      } else {
        await createTask(input);
      }
      await loadTasks();
      setViewMode(isEditing ? 'detail' : 'list');
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSubmitting(false);
    }
  }, [validate, name, prompt, workingDirectory, scheduleUI, editingTask, isEditing, createTask, updateTask, loadTasks, setViewMode, config, provider, runMode, aiCanExit, maxExecutions, deadline, timeoutMinutes]);

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) setWorkingDirectory(selected as string);
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  }, []);

  const updateSchedule = useCallback((patch: Partial<ScheduleUI>) => {
    setScheduleUI(prev => ({ ...prev, ...patch }));
  }, []);

  const inputStyle = "w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--accent)]/30";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-[18px] font-semibold mb-6" style={{ color: 'var(--ink)' }}>
        {isEditing ? '编辑任务' : '新建任务'}
      </h2>

      <div className="flex flex-col gap-5 max-w-[560px]">
        {/* 任务名称 */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            任务名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：每日代码审查"
            className={inputStyle}
            style={{ background: 'var(--surface)', border: `1px solid ${errors.name ? 'var(--error)' : 'var(--border)'}`, color: 'var(--ink)' }}
          />
          {errors.name && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{errors.name}</p>}
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入要执行的 Prompt..."
            rows={5}
            className={inputStyle}
            style={{ background: 'var(--surface)', border: `1px solid ${errors.prompt ? 'var(--error)' : 'var(--border)'}`, color: 'var(--ink)', resize: 'vertical' }}
          />
          {errors.prompt && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{errors.prompt}</p>}
        </div>

        {/* 调度模式 */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            调度模式
          </label>
          <div className="flex gap-2">
            {SCHEDULE_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => updateSchedule({ mode: value })}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: scheduleUI.mode === value ? 'var(--accent)' : 'var(--surface)',
                  color: scheduleUI.mode === value ? 'white' : 'var(--ink)',
                  border: `1px solid ${scheduleUI.mode === value ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 调度参数 */}
          <div className="mt-3 flex items-center gap-3">
            {scheduleUI.mode === 'once' && (
              <div className="flex-1">
                <input
                  type="datetime-local"
                  value={scheduleUI.datetime}
                  onChange={(e) => updateSchedule({ datetime: e.target.value })}
                  className={inputStyle}
                  style={{ background: 'var(--surface)', border: `1px solid ${errors.datetime ? 'var(--error)' : 'var(--border)'}`, color: 'var(--ink)' }}
                />
                {errors.datetime && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{errors.datetime}</p>}
              </div>
            )}

            {scheduleUI.mode === 'every' && (
              <div className="flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateSchedule({ minutes: value })}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                    style={{
                      background: scheduleUI.minutes === value ? 'var(--accent)' : 'var(--surface)',
                      color: scheduleUI.minutes === value ? 'white' : 'var(--ink)',
                      border: `1px solid ${scheduleUI.minutes === value ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={INTERVAL_PRESETS.some(p => p.value === scheduleUI.minutes) ? '' : scheduleUI.minutes}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v > 0) updateSchedule({ minutes: v });
                    }}
                    placeholder="自定义"
                    className={inputStyle}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', width: 90 }}
                  />
                  <span className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>分钟</span>
                </div>
              </div>
            )}

            {scheduleUI.mode === 'weekly' && (
              <CustomSelect
                value={String(scheduleUI.weekday)}
                onChange={(v) => updateSchedule({ weekday: parseInt(v, 10) })}
                options={WEEKDAYS.map((label, idx) => ({ value: String(idx), label }))}
              />
            )}

            {scheduleUI.mode === 'monthly' && (
              <CustomSelect
                value={String(scheduleUI.monthDay)}
                onChange={(v) => updateSchedule({ monthDay: parseInt(v, 10) })}
                options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 日` }))}
              />
            )}

            {scheduleUI.mode !== 'once' && scheduleUI.mode !== 'every' && (
              <input
                type="time"
                value={scheduleUI.time}
                onChange={(e) => updateSchedule({ time: e.target.value })}
                className={inputStyle}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', flex: '0 0 auto', width: 120 }}
              />
            )}
          </div>

          {/* 时区选择 (仅 cron 模式，every 不需要) */}
          {scheduleUI.mode !== 'once' && scheduleUI.mode !== 'every' && (
            <div className="mt-3">
              <label className="block text-[12px] mb-1" style={{ color: 'var(--ink-tertiary)' }}>
                时区
              </label>
              <CustomSelect
                value={scheduleUI.timezone}
                onChange={(value) => updateSchedule({ timezone: value })}
                options={
                  TIMEZONE_OPTIONS.some(o => o.value === scheduleUI.timezone)
                    ? TIMEZONE_OPTIONS
                    : [...TIMEZONE_OPTIONS, { value: scheduleUI.timezone, label: scheduleUI.timezone }]
                }
              />
            </div>
          )}
        </div>

        {/* 运行模式 */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            运行模式
          </label>
          <div className="flex gap-2">
            {([
              { value: 'new_session', label: '独立会话' },
              { value: 'single_session', label: '持续会话' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRunMode(value)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: runMode === value ? 'var(--accent)' : 'var(--surface)',
                  color: runMode === value ? 'white' : 'var(--ink)',
                  border: `1px solid ${runMode === value ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-tertiary)' }}>
            {runMode === 'new_session'
              ? '每次执行创建新会话，历史上下文不保留'
              : '复用同一会话，AI 可访问之前的对话历史'}
          </p>
        </div>

        {/* 结束条件 */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            结束条件
          </label>
          <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* 最多执行次数 */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-secondary)' }}>最多执行</span>
              <input
                type="number"
                min={1}
                value={maxExecutions}
                onChange={(e) => setMaxExecutions(e.target.value)}
                placeholder="不限"
                className={inputStyle}
                style={{ background: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', width: 90 }}
              />
              <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-secondary)' }}>次后停止</span>
            </div>

            {/* 截止时间 */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-secondary)' }}>截止时间</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputStyle}
                style={{ background: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', flex: 1 }}
              />
            </div>

            {/* AI 自主退出 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiCanExit}
                onChange={(e) => setAiCanExit(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--ink)' }}>允许 AI 自主退出任务</span>
            </label>

            {/* 超时时间 */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-secondary)' }}>超时时间</span>
              <input
                type="number"
                min={1}
                max={120}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(e.target.value)}
                className={inputStyle}
                style={{ background: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', width: 90 }}
              />
              <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-secondary)' }}>分钟</span>
            </div>
          </div>
        </div>

        {/* 工作目录 */}
        <div>
          <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-secondary)' }}>
            工作目录
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="/path/to/project"
              className={`flex-1 ${inputStyle}`}
              style={{ background: 'var(--surface)', border: `1px solid ${errors.workingDirectory ? 'var(--error)' : 'var(--border)'}`, color: 'var(--ink)' }}
            />
            <button
              onClick={handleBrowse}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--hover)]"
              style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
            >
              <FolderOpen size={14} />
              浏览
            </button>
          </div>
          {errors.workingDirectory && <p className="text-[12px] mt-1" style={{ color: 'var(--error)' }}>{errors.workingDirectory}</p>}
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={() => setViewMode(isEditing ? 'detail' : 'list')}
            className="px-4 py-2 rounded-lg text-[14px] font-medium transition-colors hover:bg-[var(--hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
