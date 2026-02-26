import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Settings2,
  KeyRound, CircleCheck, RefreshCw, Plus, Settings as SettingsIcon, Trash2, Puzzle, Wrench, X,
  Info, FolderOpen, ExternalLink, Eye, Loader2,
  type LucideProps,
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { Provider, ProviderAuthType, ProxyProtocol, ProxySettings } from '../../shared/types/config';
import { PROXY_DEFAULTS, isValidProxyHost } from '../../shared/types/config';
import { getModelsDisplay } from '../../shared/providers';
import {
  globalApiGetJson,
  globalApiPostJson,
  globalApiDeleteJson,
  globalApiPutJson,
} from '../api/apiFetch';
import CustomSelect from '../components/CustomSelect';
import { useAutostart } from '../hooks/useAutostart';
import { isTauri } from '../utils/env';
import { isDeveloperMode, recordDeveloperClick } from '../utils/developerMode';

// ── 类型定义 ──────────────────────────────────────────────────

interface McpServerDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  isBuiltin: boolean;
}

interface MCPServerConfig {
  name?: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface SkillInfo {
  name: string;
  description: string;
  content: string;
  rawContent: string;
  source: 'global' | 'project';
  path: string;
  isBuiltin: boolean;
  enabled: boolean;
}

type NavId = 'provider' | 'mcp' | 'skills' | 'general' | 'about';

const NAV_ITEMS: { id: NavId; label: string; Icon: React.ComponentType<LucideProps> }[] = [
  { id: 'provider',        label: '模型供应商',     Icon: Brain },
  { id: 'skills',          label: 'Skills',         Icon: Puzzle },
  { id: 'mcp',             label: 'MCP',            Icon: Wrench },
  { id: 'general',         label: '通用',           Icon: Settings2 },
  { id: 'about',           label: '关于',           Icon: Info },
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
          ) : provider.cloudProvider === '官方' ? (
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
      {provider.models?.length > 0 && (
        <p className="text-[13px] text-[var(--ink-secondary)]">{getModelsDisplay(provider)}</p>
      )}
    </div>
  );
}

// ── Provider Add/Edit Modal ───────────────────────────────────

function ProviderEditModal({
  provider,
  onSave,
  onDelete,
  onSaveKey,
  onClose,
}: {
  provider: Provider | null;
  onSave: (data: Partial<Provider>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onSaveKey?: (id: string, key: string) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !provider;
  const isBuiltin = provider?.isBuiltin ?? false;

  const [form, setForm] = useState({
    id: provider?.id ?? '',
    name: provider?.name ?? '',
    vendor: provider?.vendor ?? '',
    type: (provider?.type ?? 'api') as 'subscription' | 'api',
    baseUrl: provider?.config?.baseUrl ?? '',
    authType: (provider?.authType ?? 'auth_token') as Extract<ProviderAuthType, 'auth_token' | 'api_key'>,
    models: provider?.models?.map((m) => m.model) ?? [],
    newModelInput: '',
    apiKey: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const addModel = () => {
    const model = form.newModelInput.trim();
    if (model && !form.models.includes(model)) {
      setForm((f) => ({ ...f, models: [...f.models, model], newModelInput: '' }));
    }
  };

  const removeModel = (model: string) => {
    setForm((f) => ({ ...f, models: f.models.filter((m) => m !== model) }));
  };

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
    if (form.type === 'api' && form.models.length === 0) {
      setError('至少添加一个模型');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const providerId = form.id.trim();
      await onSave({
        id: providerId,
        name: form.name.trim(),
        vendor: form.vendor.trim() || form.name.trim(),
        cloudProvider: '自定义',
        type: form.type,
        primaryModel: form.models[0] ?? '',
        isBuiltin: false,
        authType: form.authType,
        config: {
          baseUrl: form.baseUrl.trim() || undefined,
        },
        models: form.models.map((m) => ({ model: m, modelName: m, modelSeries: 'custom' })),
      });
      if (isNew && form.apiKey.trim() && onSaveKey) {
        await onSaveKey(providerId, form.apiKey.trim());
      }
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
            <CustomSelect
              value={form.type}
              options={[
                { value: 'api', label: 'API' },
                { value: 'subscription', label: '订阅' },
              ]}
              onChange={(v) => setForm((f) => ({ ...f, type: v as 'subscription' | 'api' }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">服务商标签</label>
            <input
              type="text"
              placeholder="云服务商"
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              disabled={isBuiltin}
              className={inputCls}
            />
          </div>

          {form.type === 'api' && (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">API Base URL（Anthropic 兼容协议）</label>
                <input
                  type="url"
                  placeholder="https://api.example.com/anthropic"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  disabled={isBuiltin}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">认证方式</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authType"
                      value="auth_token"
                      checked={form.authType === 'auth_token'}
                      onChange={() => setForm((f) => ({ ...f, authType: 'auth_token' }))}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--ink)]">AUTH_TOKEN</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authType"
                      value="api_key"
                      checked={form.authType === 'api_key'}
                      onChange={() => setForm((f) => ({ ...f, authType: 'api_key' }))}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--ink)]">API_KEY</span>
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">请根据供应商认证参数进行选择</p>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">模型 ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入模型 ID，按 Enter 添加"
                    value={form.newModelInput}
                    onChange={(e) => setForm((f) => ({ ...f, newModelInput: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } }}
                    disabled={isBuiltin}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addModel}
                    disabled={!form.newModelInput.trim() || isBuiltin}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {form.models.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.models.map((model, index) => (
                      <div key={model} className="flex items-center gap-1 rounded-md bg-[var(--hover)] px-2 py-1 text-[12px] font-medium text-[var(--ink)]">
                        <span className="text-[10px] text-[var(--ink-tertiary)]">{index + 1}.</span>
                        <span>{model}</span>
                        {!isBuiltin && (
                          <button type="button" onClick={() => removeModel(model)} className="ml-0.5 rounded p-0.5 text-[var(--ink-tertiary)] hover:text-red-400">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">API Key</label>
                <input
                  type="password"
                  placeholder="可选，稍后设置"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </>
          )}
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
  const [validError, setValidError] = useState<string | null>(null);

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
    setValidError(null);
    try {
      const resp = await globalApiPostJson<{ result: 'ok' | 'fail'; error?: string }>('/api/verify-provider-key', {
        baseUrl: provider.config?.baseUrl,
        apiKey: input,
        model: provider.primaryModel,
        authType: provider.authType,
      });
      setValidResult(resp.result);
      if (resp.error) setValidError(resp.error);
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
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-bold text-[var(--ink)]">{provider.name}</h3>
              {provider.websiteUrl && (
                <a
                  href={provider.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--accent)] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  去官网
                </a>
              )}
            </div>
            {provider.models?.length > 0 && (
              <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">{getModelsDisplay(provider)}</p>
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
              {provider.config?.baseUrl && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">API 端点</label>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <span className="text-[13px] text-[var(--ink-tertiary)] font-mono">{provider.config.baseUrl}</span>
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
                  <>{validError || '验证失败，请检查 Key 是否正确'}</>
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
  const { config, currentProvider, allProviders, isLoading, updateConfig, refreshConfig } = useConfig();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editProvider, setEditProvider] = useState<Provider | null | 'new'>(null);

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
      vendor: data.vendor ?? data.name,
      cloudProvider: data.cloudProvider ?? '自定义',
      type: data.type,
      primaryModel: data.primaryModel ?? '',
      isBuiltin: false,
      authType: data.authType,
      config: data.config ?? {},
      models: data.models ?? [],
    });
    await refreshConfig();
  };

  const handleUpdateProvider = async (data: Partial<Provider>) => {
    if (!editProvider || editProvider === 'new') return;
    await globalApiPutJson(`/api/providers/${editProvider.id}`, {
      name: data.name,
      vendor: data.vendor,
      type: data.type,
      primaryModel: data.primaryModel,
      authType: data.authType,
      config: data.config,
      models: data.models,
    });
    await refreshConfig();
  };

  const handleDeleteProvider = async () => {
    if (!editProvider || editProvider === 'new') return;
    const providerId = editProvider.id;

    // 如果是当前使用的供应商，切换到默认 Anthropic 订阅
    if (currentProvider.id === providerId) {
      await updateConfig({ currentProviderId: 'anthropic-sub' });
    }

    // 删除对应的 API Key
    const newApiKeys = { ...config.apiKeys };
    delete newApiKeys[providerId];
    await updateConfig({ apiKeys: newApiKeys });

    // 调用后端删除 API
    await globalApiDeleteJson(`/api/providers/${providerId}`);

    // 刷新列表
    await refreshConfig();
  };

  const openProvider = openId ? allProviders.find((p) => p.id === openId) : null;

  // 按行分组（每行 2 列）
  const rows: Provider[][] = [];
  for (let i = 0; i < allProviders.length; i += 2) {
    rows.push(allProviders.slice(i, i + 2));
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

      {isLoading ? (
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
          onSaveKey={handleSaveKey}
          onClose={() => setEditProvider(null)}
        />
      )}
    </div>
  );
}

// ── MCP Edit Modal ────────────────────────────────────────────

function MCPEditModal({
  mcp,
  isReadonly,
  onSave,
  onDelete,
  onClose,
}: {
  mcp: (MCPServerConfig & { id: string }) | null; // null = new
  isReadonly?: boolean;
  onSave: (id: string, cfg: Omit<MCPServerConfig, 'id'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !mcp;

  const [form, setForm] = useState({
    id: mcp?.id ?? '',
    name: mcp?.name ?? '',
    type: (mcp?.type ?? 'stdio') as MCPServerConfig['type'],
    command: mcp?.command ?? '',
    args: mcp?.args?.join(', ') ?? '',
    url: mcp?.url ?? '',
    env: mcp?.env ? Object.entries(mcp.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
    headers: mcp?.headers ? Object.entries(mcp.headers).map(([k, v]) => `${k}=${v}`).join('\n') : '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (isReadonly) return;
    if (!form.id.trim()) { setError('ID 不能为空'); return; }
    if (!form.name.trim()) { setError('名称不能为空'); return; }
    if (form.type === 'stdio' && !form.command.trim()) { setError('Command 不能为空'); return; }
    if (form.type !== 'stdio' && !form.url.trim()) { setError('URL 不能为空'); return; }
    setSaving(true); setError('');
    try {
      const envObj: Record<string, string> = {};
      form.env.split('\n').forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      const headersObj: Record<string, string> = {};
      form.headers.split('\n').forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) headersObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      const argsArr = form.args.split(',').map((a) => a.trim()).filter(Boolean);
      await onSave(form.id.trim(), {
        name: form.name.trim(),
        type: form.type,
        command: form.type === 'stdio' ? form.command.trim() : undefined,
        args: form.type === 'stdio' && argsArr.length > 0 ? argsArr : undefined,
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
        url: form.type !== 'stdio' ? form.url.trim() : undefined,
        headers: form.type !== 'stdio' && Object.keys(headersObj).length > 0 ? headersObj : undefined,
      });
      onClose();
    } catch {
      setError('保存失败，请检查参数');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true); setError('');
    try {
      await onDelete();
      onClose();
    } catch {
      setError('删除失败');
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
              {isReadonly ? '查看 MCP Server' : isNew ? '添加 MCP Server' : '编辑 MCP Server'}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">
              {isReadonly ? '内置 MCP Server，仅可查看' : '配置 MCP Server 基本信息'}
            </p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors">
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

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">ID</label>
            <input
              type="text"
              placeholder="my-server"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              disabled={!isNew || isReadonly}
              className={inputCls}
            />
            {isNew && <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">唯一标识符，创建后不可修改</p>}
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">名称</label>
            <input
              type="text"
              placeholder="我的 MCP 服务器"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isReadonly}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">类型</label>
            <CustomSelect
              value={form.type}
              options={[
                { value: 'stdio', label: 'stdio' },
                { value: 'http', label: 'http' },
                { value: 'sse', label: 'sse' },
              ]}
              onChange={(v) => !isReadonly && setForm((f) => ({ ...f, type: v as MCPServerConfig['type'] }))}
              className="w-full"
            />
          </div>

          {form.type === 'stdio' ? (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Command</label>
                <input type="text" placeholder="npx" value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} disabled={isReadonly} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Args（逗号分隔）</label>
                <input type="text" placeholder="server.js, --port, 3000" value={form.args} onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))} disabled={isReadonly} className={inputCls} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">URL</label>
                <input type="text" placeholder={form.type === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} disabled={isReadonly} className={inputCls} />
                <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">{form.type === 'sse' ? 'SSE 事件流端点地址' : 'MCP 服务器的 HTTP 端点地址'}</p>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Headers（KEY=VALUE，每行一个）</label>
                <textarea rows={2} placeholder={"Authorization=Bearer xxx"} value={form.headers} onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))} disabled={isReadonly} className={`${inputCls} resize-none`} />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Env（KEY=VALUE，每行一个）</label>
            <textarea rows={3} placeholder={"API_KEY=xxx\nDEBUG=true"} value={form.env} onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))} disabled={isReadonly} className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* 底部操作 */}
        {isReadonly ? (
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
            >
              关闭
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-6 pb-6">
            {!isNew && onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-red-400 px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
              >
                删除
              </button>
            )}
            <div className="flex-1 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MCP Tab ───────────────────────────────────────────────────

function MCPTab() {
  const [servers, setServers] = useState<McpServerDefinition[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [editMCP, setEditMCP] = useState<(MCPServerConfig & { id: string }) | 'new' | null>(null);

  const loadServers = async () => {
    try {
      const data = await globalApiGetJson<{ servers: McpServerDefinition[]; enabledIds: string[] }>('/api/mcp');
      setServers(data.servers);
      setEnabledIds(new Set(data.enabledIds));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadServers(); }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingIds((prev) => new Set([...prev, id]));
    try {
      await globalApiPostJson('/api/mcp/toggle', { id, enabled });
      setEnabledIds((prev) => {
        const next = new Set(prev);
        if (enabled) next.add(id); else next.delete(id);
        return next;
      });
    } catch { /* ignore */ }
    finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSave = async (id: string, cfg: Omit<MCPServerConfig, 'id'>) => {
    if (editMCP === 'new') {
      await globalApiPostJson('/api/mcp', { id, ...cfg });
    } else {
      await globalApiDeleteJson(`/api/mcp/${id}`);
      await globalApiPostJson('/api/mcp', { id, ...cfg });
    }
    await loadServers();
  };

  const handleDelete = async (id: string) => {
    await globalApiDeleteJson(`/api/mcp/${id}`);
    await loadServers();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">MCP Servers</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">管理 MCP Server 配置，开关控制全局启用</p>
        </div>
        <button
          onClick={() => setEditMCP('new')}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          添加 MCP Server
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
      ) : servers.length === 0 ? (
        <p className="text-sm text-[var(--ink-tertiary)]">暂无 MCP Server</p>
      ) : (
        <div className="space-y-2">
          {servers.map((srv) => {
            const isEnabled = enabledIds.has(srv.id);
            const isToggling = togglingIds.has(srv.id);
            return (
              <div key={srv.id} className="flex items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--ink)]">{srv.name}</span>
                    <span className="text-xs rounded px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">{srv.type}</span>
                    {srv.isBuiltin && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-600 font-semibold">
                        内置
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">
                    {srv.description ?? ''}{srv.description && (srv.command || srv.url) ? ' · ' : ''}{srv.command ?? srv.url ?? ''}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3 shrink-0">
                  {isToggling ? (
                    <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
                  ) : (
                    <ToggleSwitch
                      checked={isEnabled}
                      onChange={(v) => handleToggle(srv.id, v)}
                    />
                  )}
                  {srv.isBuiltin ? (
                    <button
                      onClick={() => setEditMCP({ id: srv.id, name: srv.name, type: srv.type, command: srv.command, args: srv.args, env: srv.env, url: srv.url, headers: srv.headers })}
                      className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                      title="查看"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditMCP({ id: srv.id, name: srv.name, type: srv.type, command: srv.command, args: srv.args, env: srv.env, url: srv.url, headers: srv.headers })}
                        className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                        title="编辑"
                      >
                        <SettingsIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(srv.id)}
                        className="text-[var(--ink-tertiary)] hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MCP 发现链接 */}
      <div className="flex items-center gap-4 text-[12px] text-[var(--ink-tertiary)]">
        <span>发现更多 MCP:</span>
        <a href="https://mcp.so" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">
          mcp.so <ExternalLink size={10} />
        </a>
        <a href="https://smithery.ai" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">
          smithery.ai <ExternalLink size={10} />
        </a>
      </div>

      {editMCP && (() => {
        const isBuiltinMcp = editMCP !== 'new' && servers.find((s) => s.id === editMCP.id)?.isBuiltin;
        return (
          <MCPEditModal
            mcp={editMCP === 'new' ? null : editMCP}
            isReadonly={!!isBuiltinMcp}
            onSave={handleSave}
            onDelete={editMCP !== 'new' && !isBuiltinMcp ? () => handleDelete(editMCP.id) : undefined}
            onClose={() => setEditMCP(null)}
          />
        );
      })()}
    </div>
  );
}

// ── Skill Edit Modal ──────────────────────────────────────────

function SkillEditModal({
  skill,
  onSave,
  onDelete,
  onClose,
}: {
  skill: SkillInfo | null; // null = new
  onSave: (data: { name: string; description: string; content: string; scope: 'global' | 'project' }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !skill;

  const [form, setForm] = useState({
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    content: skill?.rawContent ?? '',
    scope: (skill?.source ?? 'global') as 'global' | 'project',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('名称不能为空'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ name: form.name.trim(), description: form.description, content: form.content, scope: form.scope });
      onClose();
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true); setError('');
    try {
      await onDelete();
      onClose();
    } catch {
      setError('删除失败');
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
        className="relative w-[520px] rounded-2xl bg-[var(--paper)] shadow-2xl"
        style={{ border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="text-[17px] font-bold text-[var(--ink)]">
              {isNew ? '新建 Skill' : '编辑 Skill'}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">配置 Skill 基本信息</p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors">
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

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">名称</label>
            <input type="text" placeholder="my-skill" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">描述</label>
            <input type="text" placeholder="Skill 描述" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">范围</label>
            <CustomSelect
              value={form.scope}
              options={[
                { value: 'global', label: '全局' },
                { value: 'project', label: '项目' },
              ]}
              onChange={(v) => setForm((f) => ({ ...f, scope: v as 'global' | 'project' }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">内容（Markdown）</label>
            <textarea rows={10} placeholder="在此编写 Skill 内容..." value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className={`${inputCls} resize-none font-mono`} />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-3 px-6 pb-6">
          {!isNew && onDelete && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded-lg border border-red-400 px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
            >
              删除
            </button>
          )}
          <div className="flex-1 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skills Tab ────────────────────────────────────────────────

function SkillsTab() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSkill, setEditSkill] = useState<SkillInfo | 'new' | null>(null);

  const loadSkills = async () => {
    try { const data = await globalApiGetJson<SkillInfo[]>('/api/skills'); setSkills(data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadSkills(); }, []);

  const handleSave = async (data: { name: string; description: string; content: string; scope: 'global' | 'project' }) => {
    if (editSkill === 'new') {
      await globalApiPostJson('/api/skills', data);
    } else if (editSkill) {
      await globalApiPutJson(`/api/skills/${editSkill.name}`, data);
    }
    await loadSkills();
  };

  const handleDelete = async (skill: SkillInfo) => {
    await globalApiDeleteJson(`/api/skills/${skill.name}?scope=${skill.source}`);
    await loadSkills();
  };

  const handleToggle = async (skill: SkillInfo, enabled: boolean) => {
    try {
      await globalApiPostJson('/api/skills/toggle', { name: skill.name, enabled });
      setSkills((prev) => prev.map((s) => s.name === skill.name ? { ...s, enabled } : s));
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">Skills</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">管理自定义 Skill，共 {skills.length} 个</p>
        </div>
        <button
          onClick={() => setEditSkill('new')}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          新建 Skill
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-[var(--ink-tertiary)]">暂无 Skill</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={`${skill.source}:${skill.name}`}
              className="flex items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <button
                onClick={() => setEditSkill(skill)}
                className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--ink)]">{skill.name}</span>
                  <span className={`text-xs rounded px-1.5 py-0.5 ${skill.source === 'global' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-500'}`}>
                    {skill.source === 'global' ? '全局' : '项目'}
                  </span>
                  {skill.isBuiltin && (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-600 font-semibold">
                      内置
                    </span>
                  )}
                </div>
                {skill.description && <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">{skill.description}</p>}
              </button>
              <div className="ml-4 flex items-center gap-3 shrink-0">
                <ToggleSwitch
                  checked={skill.enabled}
                  onChange={(v) => handleToggle(skill, v)}
                />
                {!skill.isBuiltin && (
                  <button
                    onClick={() => handleDelete(skill)}
                    className="text-[var(--ink-tertiary)] hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editSkill && (
        <SkillEditModal
          skill={editSkill === 'new' ? null : editSkill}
          onSave={handleSave}
          onDelete={editSkill !== 'new' && !editSkill.isBuiltin ? () => handleDelete(editSkill) : undefined}
          onClose={() => setEditSkill(null)}
        />
      )}
    </div>
  );
}

// ── ToggleSwitch ─────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
    >
      <span
        className={`pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform mt-[2px] ${
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

// ── General Tab ──────────────────────────────────────────────

function GeneralTab() {
  const { config, updateConfig, workspaces } = useConfig();
  const { isEnabled: autostartEnabled, isLoading: autostartLoading, setAutostart } = useAutostart();

  // proxy form state (derived from config)
  const proxy = config.proxySettings ?? { enabled: false, ...PROXY_DEFAULTS };
  const [proxyForm, setProxyForm] = useState({
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
  });

  // Sync proxyForm when config changes externally
  useEffect(() => {
    const p = config.proxySettings;
    if (p) {
      setProxyForm({ protocol: p.protocol, host: p.host, port: p.port });
    }
  }, [config.proxySettings]);

  const handleProxyToggle = useCallback(async (enabled: boolean) => {
    await updateConfig({
      proxySettings: {
        enabled,
        protocol: proxyForm.protocol,
        host: proxyForm.host,
        port: proxyForm.port,
      },
    });
  }, [updateConfig, proxyForm]);

  const handleProxySave = useCallback(async () => {
    if (!isValidProxyHost(proxyForm.host)) return;
    if (proxyForm.port < 1 || proxyForm.port > 65535) return;
    await updateConfig({
      proxySettings: {
        enabled: proxy.enabled,
        protocol: proxyForm.protocol,
        host: proxyForm.host,
        port: proxyForm.port,
      },
    });
  }, [updateConfig, proxy.enabled, proxyForm]);

  const handleSelectFolder = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        await updateConfig({ defaultWorkspacePath: selected as string });
      }
    } catch (err) {
      console.error('[GeneralTab] Failed to open folder dialog:', err);
    }
  }, [updateConfig]);

  // 最近工作区列表（按时间倒序，最多 10 个）
  const recentWorkspaces = [...workspaces]
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, 10);

  const proxyAddress = proxy.enabled
    ? `${proxyForm.protocol}://${proxyForm.host}:${proxyForm.port}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--ink)]">General</h2>
        <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">应用基本设置</p>
      </div>

      {/* 启动设置 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <p className="text-[15px] font-semibold text-[var(--ink)]">启动设置</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[var(--ink)]">开机自动启动</p>
            <p className="text-[12px] text-[var(--ink-tertiary)]">登录系统时自动运行 SoAgents</p>
          </div>
          <ToggleSwitch
            checked={autostartEnabled}
            onChange={setAutostart}
            disabled={autostartLoading}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[var(--ink)]">最小化到托盘</p>
            <p className="text-[12px] text-[var(--ink-tertiary)]">关闭窗口时最小化到系统托盘（即将支持）</p>
          </div>
          <ToggleSwitch
            checked={config.minimizeToTray ?? false}
            onChange={() => {}}
            disabled
          />
        </div>
      </div>

      {/* 默认工作区 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <p className="text-[15px] font-semibold text-[var(--ink)]">默认工作区</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[var(--ink)]">默认工作区路径</p>
            <p className="text-[12px] text-[var(--ink-tertiary)]">启动时自动打开的工作区</p>
          </div>
          <div className="flex items-center gap-2">
            {recentWorkspaces.length > 0 ? (
              <CustomSelect
                value={config.defaultWorkspacePath ?? ''}
                options={recentWorkspaces.map((ws) => ({
                  value: ws.path,
                  label: ws.path,
                }))}
                onChange={(v) => updateConfig({ defaultWorkspacePath: v || undefined })}
                placeholder="选择工作区"
              />
            ) : (
              <span className="text-[13px] text-[var(--ink-tertiary)]">暂无最近工作区</span>
            )}
            <button
              onClick={handleSelectFolder}
              className="shrink-0 rounded-lg border border-[var(--border)] p-2 text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
              title="选择文件夹"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 网络代理 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-[var(--ink)]">网络代理</p>
          <ToggleSwitch checked={proxy.enabled} onChange={handleProxyToggle} />
        </div>

        {proxy.enabled && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">协议</label>
                <CustomSelect
                  value={proxyForm.protocol}
                  options={[
                    { value: 'http', label: 'HTTP' },
                    { value: 'socks5', label: 'SOCKS5' },
                  ]}
                  onChange={(v) => setProxyForm((f) => ({ ...f, protocol: v as ProxyProtocol }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Host</label>
                <input
                  type="text"
                  value={proxyForm.host}
                  onChange={(e) => setProxyForm((f) => ({ ...f, host: e.target.value }))}
                  onBlur={handleProxySave}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={proxyForm.port}
                  onChange={(e) => setProxyForm((f) => ({ ...f, port: Number(e.target.value) || 0 }))}
                  onBlur={handleProxySave}
                  className={inputCls}
                />
              </div>
            </div>

            {proxyAddress && (
              <p className="text-[12px] text-[var(--ink-tertiary)]">
                代理地址: <span className="font-mono text-[var(--ink-secondary)]">{proxyAddress}</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── About Tab ────────────────────────────────────────────────

function AboutTab({
  checkForUpdate,
  checking = false,
}: {
  checkForUpdate?: () => Promise<import('../hooks/useUpdater').CheckUpdateResult>;
  checking?: boolean;
}) {
  const { config, updateConfig } = useConfig();
  const [devMode, setDevMode] = useState(isDeveloperMode);
  const [appVersion, setAppVersion] = useState('0.1.0');
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setAppVersion(await getVersion());
      } catch {
        // fallback to package.json version
      }
    })();
  }, []);

  const handleTitleClick = useCallback(() => {
    if (recordDeveloperClick()) {
      setDevMode(true);
    }
  }, []);

  const handleDevToolsToggle = useCallback(async (enabled: boolean) => {
    await updateConfig({ showDevTools: enabled });
    // 立即切换 devtools
    if (isTauri()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        // 使用 Tauri 内部 API 打开/关闭 devtools
        if (enabled) {
          (win as unknown as { emit: (e: string) => void }).emit('open-devtools');
        }
      } catch {
        // ignore
      }
    }
  }, [updateConfig]);

  const handleOpenLink = useCallback(async (url: string) => {
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } catch {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* 品牌头部 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <h2
          className="text-[28px] font-bold text-[var(--ink)] cursor-default select-none"
          onClick={handleTitleClick}
        >
          SoAgents
        </h2>
        <p className="mt-1 text-[14px] text-[var(--ink-tertiary)]">
          版本 {appVersion}
        </p>
        {checkForUpdate && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              onClick={async () => {
                setUpdateStatus(null);
                const result = await checkForUpdate();
                if (result.status === 'no-update') {
                  setUpdateStatus('already-latest');
                } else if (result.status === 'ready') {
                  setUpdateStatus('ready');
                } else if (result.status === 'error') {
                  setUpdateStatus(`error:${result.error || '检查失败'}`);
                }
              }}
              disabled={checking}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
            >
              {checking ? (
                <><RefreshCw size={13} className="animate-spin" />检查中...</>
              ) : (
                <>检查更新</>
              )}
            </button>
            {updateStatus === 'already-latest' && (
              <p className="text-[12px] text-[var(--success)]">已是最新版本</p>
            )}
            {updateStatus === 'ready' && (
              <p className="text-[12px] text-[var(--accent)]">更新已下载，请重启应用</p>
            )}
            {updateStatus?.startsWith('error:') && (
              <p className="text-[12px] text-red-400">{updateStatus.slice(6)}</p>
            )}
          </div>
        )}
      </div>

      {/* 产品描述 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-[15px] font-semibold text-[var(--ink)]">关于 SoAgents</p>
        <p className="mt-2 text-[13px] text-[var(--ink-secondary)] leading-relaxed">
          SoAgents 是基于 Claude Agent SDK 的桌面端 Agent 客户端，通过 Tauri + React + Bun 全栈架构构建，
          提供多工作区隔离、MCP 服务器管理、自定义 Skills 等功能。
        </p>
      </div>

      {/* 联系/链接 */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
        <p className="text-[15px] font-semibold text-[var(--ink)]">链接</p>
        <div className="space-y-2">
          <button
            onClick={() => handleOpenLink('https://github.com/applre/SoAgents')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
          >
            <span className="text-[13px] text-[var(--ink)]">GitHub 仓库</span>
            <ExternalLink size={14} className="text-[var(--ink-tertiary)]" />
          </button>
          <button
            onClick={() => handleOpenLink('https://github.com/applre/SoAgents/issues')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
          >
            <span className="text-[13px] text-[var(--ink)]">反馈问题</span>
            <ExternalLink size={14} className="text-[var(--ink-tertiary)]" />
          </button>
          <button
            onClick={() => handleOpenLink('https://github.com/applre')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
          >
            <span className="text-[13px] text-[var(--ink)]">Developer</span>
            <ExternalLink size={14} className="text-[var(--ink-tertiary)]" />
          </button>
        </div>
      </div>

      {/* 开发者模式（隐藏，需 5 次点击 SoAgents 标题解锁） */}
      {devMode && (
        <div className="rounded-[14px] border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 p-5 space-y-4">
          <p className="text-[15px] font-semibold text-[var(--accent)]">开发者选项</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[var(--ink)]">显示 DevTools</p>
              <p className="text-[12px] text-[var(--ink-tertiary)]">打开 Chromium 开发者工具</p>
            </div>
            <ToggleSwitch
              checked={config.showDevTools ?? false}
              onChange={handleDevToolsToggle}
            />
          </div>
          <div className="space-y-1">
            <p className="text-[12px] text-[var(--ink-tertiary)]">
              构建信息
            </p>
            <p className="text-[12px] font-mono text-[var(--ink-tertiary)]">
              Version: {appVersion} &bull; Framework: Tauri v2 &bull; Runtime: Bun
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────

interface SettingsProps {
  checkForUpdate?: () => Promise<import('../hooks/useUpdater').CheckUpdateResult>;
  checking?: boolean;
}

export default function Settings({ checkForUpdate, checking }: SettingsProps) {
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
        {activeNav === 'skills'          && <SkillsTab />}
        {activeNav === 'general'         && <GeneralTab />}
        {activeNav === 'about'           && <AboutTab checkForUpdate={checkForUpdate} checking={checking} />}
      </div>
    </div>
  );
}
