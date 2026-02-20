import { useState, useEffect } from 'react';
import {
  Brain, Settings2, SlidersHorizontal, User, Blocks, GitBranch, LayoutGrid,
  KeyRound, CircleCheck, RefreshCw, Plus, Settings as SettingsIcon, Trash2, Zap, X,
  type LucideProps,
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { Provider } from '../types/config';
import {
  globalApiGetJson,
  globalApiPostJson,
  globalApiDeleteJson,
  globalApiPutJson,
} from '../api/apiFetch';

// ── 类型定义 ──────────────────────────────────────────────────

interface MCPServerConfig {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

interface SkillInfo {
  name: string;
  description: string;
  content: string;
  rawContent: string;
  source: 'global' | 'project';
  path: string;
}

type NavId = 'provider' | 'general' | 'config' | 'personalization' | 'mcp' | 'git' | 'env' | 'skills';

const NAV_ITEMS: { id: NavId; label: string; Icon: React.ComponentType<LucideProps> }[] = [
  { id: 'provider',        label: '模型供应商',     Icon: Brain },
  { id: 'general',         label: 'General',        Icon: Settings2 },
  { id: 'config',          label: 'Configuration',  Icon: SlidersHorizontal },
  { id: 'personalization', label: 'Personalization', Icon: User },
  { id: 'mcp',             label: 'MCP Servers',    Icon: Blocks },
  { id: 'git',             label: 'Git',            Icon: GitBranch },
  { id: 'env',             label: 'Environments',   Icon: LayoutGrid },
  { id: 'skills',          label: 'Skills',         Icon: Zap },
];

// ── 输入框公共样式 ────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none';

// ── Provider 单张卡片 ─────────────────────────────────────────

function ProviderCard({
  provider,
  apiKey,
  isActive,
  onOpenDetail,
  onOpenEdit,
}: {
  provider: Provider;
  apiKey: string;
  isActive: boolean;
  onOpenDetail: () => void;
  onOpenEdit: () => void;
}) {
  const hasKey = !!apiKey;

  return (
    <div
      onClick={onOpenDetail}
      className={`rounded-[14px] border bg-[var(--surface)] p-5 flex flex-col gap-3 transition-all cursor-pointer ${
        isActive
          ? 'border-[var(--accent)]/60 shadow-sm'
          : 'border-[var(--border)] hover:border-[var(--accent)]/30 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[var(--ink)]">{provider.name}</span>
          {isActive ? (
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent)] text-white">
              使用中
            </span>
          ) : provider.official ? (
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent-light)] text-[var(--accent)]">
              官方
            </span>
          ) : hasKey ? (
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--success)]/10 text-[var(--success)]">
              已配置
            </span>
          ) : (
            <span className="rounded px-2 py-0.5 text-[11px] font-medium bg-[var(--hover)] text-[var(--ink-tertiary)]">
              未配置
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenEdit();
          }}
          className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
      {provider.models && (
        <p className="text-[13px] text-[var(--ink-secondary)]">{provider.models}</p>
      )}
    </div>
  );
}

// ── Provider Add/Edit Modal ───────────────────────────────────

function ProviderEditModal({
  provider,
  onSave,
  onDelete,
  onClose,
}: {
  provider: Provider | null;
  onSave: (data: Partial<Provider>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !provider;
  const isBuiltin = provider?.isBuiltin ?? false;

  const [form, setForm] = useState({
    id: provider?.id ?? '',
    name: provider?.name ?? '',
    type: (provider?.type ?? 'api') as 'subscription' | 'api',
    baseUrl: provider?.baseUrl ?? '',
    primaryModel: provider?.primaryModel ?? '',
    models: provider?.models ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const validate = () => {
    if (!form.name.trim()) {
      setError('名称不能为空');
      return false;
    }
    if (isNew && !form.id.trim()) {
      setError('ID 不能为空');
      return false;
    }
    if (form.type === 'api' && !form.baseUrl.trim()) {
      setError('Base URL 不能为空');
      return false;
    }
    if (form.type === 'api' && form.baseUrl.trim()) {
      try {
        new URL(form.baseUrl);
      } catch {
        setError('Base URL 格式不正确');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        id: form.id.trim(),
        name: form.name.trim(),
        type: form.type,
        baseUrl: form.baseUrl.trim() || undefined,
        primaryModel: form.primaryModel.trim() || undefined,
        models: form.models.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[480px] rounded-2xl bg-[var(--paper)] shadow-2xl"
        style={{ border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="text-[17px] font-bold text-[var(--ink)]">
              {isNew ? '添加自定义供应商' : isBuiltin ? '查看供应商' : '编辑供应商'}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">
              {isBuiltin ? '预设供应商仅可配置 API Key，不可编辑' : '配置供应商基本信息'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          )}

          {isNew && (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">ID</label>
              <input
                type="text"
                placeholder="custom-provider"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                disabled={isBuiltin}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">唯一标识符，仅支持小写字母、数字、短横线</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">名称</label>
            <input
              type="text"
              placeholder="我的供应商"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isBuiltin}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">类型</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'subscription' | 'api' }))}
              disabled={isBuiltin}
              className={inputCls}
            >
              <option value="api">API</option>
              <option value="subscription">订阅</option>
            </select>
          </div>

          {form.type === 'api' && (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Base URL</label>
                <input
                  type="text"
                  placeholder="https://api.example.com/anthropic"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  disabled={isBuiltin}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">API 端点的基础 URL</p>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">主模型</label>
                <input
                  type="text"
                  placeholder="claude-sonnet-4-5-20250929"
                  value={form.primaryModel}
                  onChange={(e) => setForm((f) => ({ ...f, primaryModel: e.target.value }))}
                  disabled={isBuiltin}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">默认使用的模型 ID（可选）</p>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">模型列表</label>
            <input
              type="text"
              placeholder="Claude Sonnet 4.5, Claude Opus 4..."
              value={form.models}
              onChange={(e) => setForm((f) => ({ ...f, models: e.target.value }))}
              disabled={isBuiltin}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">供应商支持的模型列表，用于展示（可选）</p>
          </div>
        </div>

        {/* 底部操作 */}
        {!isBuiltin && !isNew && (
          <div className="flex items-center gap-3 px-6 pb-6">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="rounded-lg border border-red-400 px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
            >
              删除
            </button>
            <div className="flex-1 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
        {!isBuiltin && isNew && (
          <div className="flex items-center justify-between gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
        {isBuiltin && (
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
            >
              关闭
            </button>
          </div>
        )}

        {/* 删除确认对话框 */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              className="w-80 rounded-xl bg-[var(--paper)] p-6 shadow-2xl"
              style={{ border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-[15px] font-bold text-[var(--ink)]">确认删除</h4>
              <p className="mt-2 text-[13px] text-[var(--ink-secondary)]">
                确定要删除供应商 "<span className="font-medium text-[var(--ink)]">{provider?.name}</span>" 吗？
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
                此操作不可撤销，相关的 API Key 也将被删除。
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Provider Config Modal ──────────────────────────────────────

function ProviderConfigModal({
  provider,
  apiKey,
  isActive,
  onSetActive,
  onSaveKey,
  onClose,
}: {
  provider: Provider;
  apiKey: string;
  isActive: boolean;
  onSetActive: () => Promise<void>;
  onSaveKey: (id: string, key: string) => Promise<void>;
  onClose: () => void;
}) {
  const [input, setInput] = useState(apiKey);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<'ok' | 'fail' | null>(null);

  const save = async () => {
    if (input === apiKey) return;
    setSaving(true);
    await onSaveKey(provider.id, input);
    setSaving(false);
  };

  const handleSetActive = async () => {
    await save();
    await onSetActive();
    onClose();
  };

  const validate = async () => {
    setValidating(true);
    setValidResult(null);
    try {
      const testUrl = provider.baseUrl
        ? `${provider.baseUrl}/v1/messages`
        : 'https://api.anthropic.com/v1/messages';
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': input,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: provider.primaryModel ?? 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      setValidResult(res.status !== 401 && res.status !== 403 ? 'ok' : 'fail');
    } catch {
      setValidResult('fail');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[420px] rounded-2xl bg-[var(--paper)] shadow-2xl"
        style={{ border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="text-[17px] font-bold text-[var(--ink)]">{provider.name}</h3>
            {provider.models && (
              <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">{provider.models}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {provider.type === 'subscription' ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
              <CircleCheck size={16} className="text-[var(--success)] shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-[var(--ink)]">订阅账户</p>
                <p className="text-[12px] text-[var(--ink-tertiary)]">通过 Claude 官方订阅使用，无需 API Key</p>
              </div>
            </div>
          ) : (
            <>
              {provider.baseUrl && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">API 端点</label>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <span className="text-[13px] text-[var(--ink-tertiary)] font-mono">{provider.baseUrl}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">API Key</label>
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                  saving ? 'border-[var(--accent)]/50' : 'border-[var(--border)] focus-within:border-[var(--accent)]'
                }`}>
                  <KeyRound size={14} className="shrink-0 text-[var(--ink-tertiary)]" />
                  <input
                    type="password"
                    placeholder="输入 API Key..."
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setValidResult(null); }}
                    onBlur={save}
                    onKeyDown={(e) => e.key === 'Enter' && save()}
                    className="flex-1 bg-transparent text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none"
                    autoFocus
                  />
                  {validResult === 'ok' && <CircleCheck size={14} className="shrink-0 text-[var(--success)]" />}
                  {validResult === 'fail' && <span className="shrink-0 text-[13px] text-red-400">✕</span>}
                </div>
              </div>

              <button
                onClick={validate}
                disabled={!input || validating}
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {validating ? (
                  <><RefreshCw size={13} className="animate-spin" />验证中...</>
                ) : validResult === 'ok' ? (
                  <><CircleCheck size={13} className="text-[var(--success)]" />验证通过</>
                ) : validResult === 'fail' ? (
                  <>验证失败，请检查 Key 是否正确</>
                ) : (
                  <>验证 API Key</>
                )}
              </button>
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSetActive}
            disabled={isActive}
            className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              isActive
                ? 'bg-[var(--accent)]/30 text-white cursor-not-allowed'
                : 'bg-[var(--accent)] text-white hover:opacity-90'
            }`}
          >
            {isActive ? '当前使用中' : '保存并使用'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Provider Tab ──────────────────────────────────────────────

function ProviderTab() {
  const { config, currentProvider, updateConfig, refreshConfig } = useConfig();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editProvider, setEditProvider] = useState<Provider | null | 'new'>(null);

  const loadProviders = async () => {
    try {
      const data = await globalApiGetJson<Provider[]>('/api/providers');
      setProviders(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const handleSetActive = async (providerId: string) => {
    await updateConfig({ currentProviderId: providerId });
  };

  const handleSaveKey = async (providerId: string, key: string) => {
    await updateConfig({ apiKeys: { ...config.apiKeys, [providerId]: key } });
  };

  const handleAddProvider = async (data: Partial<Provider>) => {
    await globalApiPostJson('/api/providers', {
      id: data.id,
      name: data.name,
      type: data.type,
      baseUrl: data.baseUrl,
      primaryModel: data.primaryModel,
      models: data.models,
      isBuiltin: false,
    });
    await loadProviders();
    await refreshConfig();
  };

  const handleUpdateProvider = async (data: Partial<Provider>) => {
    if (!editProvider || editProvider === 'new') return;
    await globalApiPutJson(`/api/providers/${editProvider.id}`, {
      name: data.name,
      type: data.type,
      baseUrl: data.baseUrl,
      primaryModel: data.primaryModel,
      models: data.models,
    });
    await loadProviders();
    await refreshConfig();
  };

  const handleDeleteProvider = async () => {
    if (!editProvider || editProvider === 'new') return;
    const providerId = editProvider.id;

    // 如果是当前使用的供应商，切换到 anthropic
    if (currentProvider.id === providerId) {
      await updateConfig({ currentProviderId: 'anthropic' });
    }

    // 删除对应的 API Key
    const newApiKeys = { ...config.apiKeys };
    delete newApiKeys[providerId];
    await updateConfig({ apiKeys: newApiKeys });

    // 调用后端删除 API
    await globalApiDeleteJson(`/api/providers/${providerId}`);

    // 刷新列表
    await loadProviders();
    await refreshConfig();
  };

  const openProvider = openId ? providers.find((p) => p.id === openId) : null;

  // 按行分组（每行 2 列）
  const rows: Provider[][] = [];
  for (let i = 0; i < providers.length; i += 2) {
    rows.push(providers.slice(i, i + 2));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">模型供应商</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">选择并配置 AI 供应商，点击卡片进行配置</p>
        </div>
        <button
          onClick={() => setEditProvider('new')}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          添加自定义供应商
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 gap-4">
              {row.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  apiKey={config.apiKeys[provider.id] ?? ''}
                  isActive={currentProvider.id === provider.id}
                  onOpenDetail={() => setOpenId(provider.id)}
                  onOpenEdit={() => setEditProvider(provider)}
                />
              ))}
              {row.length === 1 && <div />}
            </div>
          ))}
        </div>
      )}

      {openProvider && (
        <ProviderConfigModal
          provider={openProvider}
          apiKey={config.apiKeys[openProvider.id] ?? ''}
          isActive={currentProvider.id === openProvider.id}
          onSetActive={() => handleSetActive(openProvider.id)}
          onSaveKey={handleSaveKey}
          onClose={() => setOpenId(null)}
        />
      )}

      {editProvider && (
        <ProviderEditModal
          provider={editProvider === 'new' ? null : editProvider}
          onSave={editProvider === 'new' ? handleAddProvider : handleUpdateProvider}
          onDelete={editProvider !== 'new' ? handleDeleteProvider : undefined}
          onClose={() => setEditProvider(null)}
        />
      )}
    </div>
  );
}

// ── MCP Tab ───────────────────────────────────────────────────

const defaultMCPForm = {
  id: '',
  type: 'stdio' as MCPServerConfig['type'],
  command: '',
  args: '',
  url: '',
  env: '',
};

function MCPTab() {
  const [servers, setServers] = useState<Record<string, MCPServerConfig>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultMCPForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadServers = async () => {
    try {
      const data = await globalApiGetJson<Record<string, MCPServerConfig>>('/api/mcp');
      setServers(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadServers(); }, []);

  const handleAdd = async () => {
    if (!form.id.trim()) { setError('ID 不能为空'); return; }
    setSaving(true); setError('');
    try {
      const envObj: Record<string, string> = {};
      form.env.split('\n').forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      const argsArr = form.args.split(',').map((a) => a.trim()).filter(Boolean);
      await globalApiPostJson('/api/mcp', {
        id: form.id.trim(), type: form.type,
        command: form.type === 'stdio' ? form.command : undefined,
        args: form.type === 'stdio' && argsArr.length > 0 ? argsArr : undefined,
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
        url: form.type !== 'stdio' ? form.url : undefined,
      });
      setForm(defaultMCPForm);
      await loadServers();
    } catch { setError('添加失败，请检查参数'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await globalApiDeleteJson(`/api/mcp/${id}`); await loadServers(); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-[22px] font-bold text-[var(--ink)]">MCP Servers</h2>
      <div className="flex gap-6">
        {/* 列表 */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
          ) : Object.keys(servers).length === 0 ? (
            <p className="text-sm text-[var(--ink-tertiary)]">暂无 MCP Server</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(servers).map(([id, cfg]) => (
                <div key={id} className="flex items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--ink)]">{id}</span>
                      <span className="text-xs rounded px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">{cfg.type}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">{cfg.command ?? cfg.url ?? ''}</p>
                  </div>
                  <button onClick={() => handleDelete(id)} className="ml-4 shrink-0 text-[var(--ink-tertiary)] hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 新增表单 */}
        <div className="w-72 shrink-0">
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--ink)]">新增 Server</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">ID</label>
              <input type="text" placeholder="my-server" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">类型</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MCPServerConfig['type'] }))} className={inputCls}>
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>
            {form.type === 'stdio' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Command</label>
                  <input type="text" placeholder="node" value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Args（逗号分隔）</label>
                  <input type="text" placeholder="server.js, --port, 3000" value={form.args} onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))} className={inputCls} />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink)]">URL</label>
                <input type="text" placeholder="http://localhost:3000/mcp" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Env（KEY=VALUE）</label>
              <textarea rows={3} placeholder={"API_KEY=xxx\nDEBUG=true"} value={form.env} onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))} className={`${inputCls} resize-none`} />
            </div>
            <button onClick={handleAdd} disabled={saving} className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skills Tab ────────────────────────────────────────────────

const defaultSkillForm = { name: '', description: '', content: '', scope: 'global' as 'global' | 'project' };

function SkillsTab() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillInfo | null>(null);
  const [form, setForm] = useState(defaultSkillForm);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSkills = async () => {
    try { const data = await globalApiGetJson<SkillInfo[]>('/api/skills'); setSkills(data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadSkills(); }, []);

  const handleSelect = (skill: SkillInfo) => {
    setSelected(skill); setIsNew(false);
    setForm({ name: skill.name, description: skill.description, content: skill.rawContent, scope: skill.source });
    setError('');
  };

  const handleNew = () => { setSelected(null); setIsNew(true); setForm(defaultSkillForm); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('名称不能为空'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        await globalApiPostJson('/api/skills', { name: form.name.trim(), description: form.description, content: form.content, scope: form.scope });
      } else if (selected) {
        await globalApiPutJson(`/api/skills/${selected.name}`, { name: form.name.trim(), description: form.description, content: form.content, scope: form.scope });
      }
      await loadSkills(); setIsNew(false); setSelected(null); setForm(defaultSkillForm);
    } catch { setError('保存失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try { await globalApiDeleteJson(`/api/skills/${selected.name}?scope=${selected.source}`); await loadSkills(); setSelected(null); setForm(defaultSkillForm); }
    catch { setError('删除失败'); }
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-[22px] font-bold text-[var(--ink)]">Skills</h2>
      <div className="flex gap-6">
        {/* 列表 */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--ink-secondary)]">{skills.length} 个 Skill</span>
            <button onClick={handleNew} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">新建</button>
          </div>
          {loading ? <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p> : skills.length === 0 ? <p className="text-sm text-[var(--ink-tertiary)]">暂无 Skill</p> : (
            <div className="space-y-2">
              {skills.map((skill) => (
                <button key={`${skill.source}:${skill.name}`} onClick={() => handleSelect(skill)} className={`w-full text-left rounded-[14px] border px-4 py-3 transition-colors ${selected?.name === skill.name && selected?.source === skill.source ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--ink)]">{skill.name}</span>
                    <span className={`text-xs rounded px-1.5 py-0.5 ${skill.source === 'global' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-500'}`}>{skill.source === 'global' ? '全局' : '项目'}</span>
                  </div>
                  {skill.description && <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">{skill.description}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 编辑区 */}
        {(isNew || selected) && (
          <div className="w-80 shrink-0">
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{isNew ? '新建 Skill' : '编辑 Skill'}</p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div><label className="mb-1 block text-xs font-medium text-[var(--ink)]">名称</label><input type="text" placeholder="my-skill" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div><label className="mb-1 block text-xs font-medium text-[var(--ink)]">描述</label><input type="text" placeholder="Skill 描述" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
              <div><label className="mb-1 block text-xs font-medium text-[var(--ink)]">内容（Markdown）</label><textarea rows={10} placeholder="在此编写 Skill 内容..." value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className={`${inputCls} resize-none font-mono`} /></div>
              <div><label className="mb-1 block text-xs font-medium text-[var(--ink)]">范围</label><select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as 'global' | 'project' }))} className={inputCls}><option value="global">全局</option><option value="project">项目</option></select></div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                {!isNew && <button onClick={handleDelete} className="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={14} /></button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 占位内容 ──────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[22px] font-bold text-[var(--ink)]">{title}</h2>
      <p className="text-sm text-[var(--ink-tertiary)]">即将推出</p>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────

export default function Settings() {
  const [activeNav, setActiveNav] = useState<NavId>('provider');

  return (
    <div className="flex h-full overflow-hidden bg-[var(--paper)]">
      {/* 左侧导航 */}
      <div
        className="flex flex-col gap-1.5 shrink-0 overflow-y-auto border-r border-[var(--border)] p-4"
        style={{ width: 220 }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveNav(id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors text-left ${
              activeNav === id
                ? 'bg-[var(--hover)] font-semibold text-[var(--ink)]'
                : 'font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon
              size={16}
              className={activeNav === id ? 'text-[var(--accent)]' : 'text-[var(--ink-tertiary)]'}
            />
            {label}
          </button>
        ))}
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '40px 48px' }}>
        {activeNav === 'provider'        && <ProviderTab />}
        {activeNav === 'mcp'             && <MCPTab />}
        {activeNav === 'general'         && <ComingSoon title="General" />}
        {activeNav === 'config'          && <ComingSoon title="Configuration" />}
        {activeNav === 'personalization' && <ComingSoon title="Personalization" />}
        {activeNav === 'git'             && <ComingSoon title="Git" />}
        {activeNav === 'env'             && <ComingSoon title="Environments" />}
        {activeNav === 'skills'          && <SkillsTab />}
      </div>
    </div>
  );
}
