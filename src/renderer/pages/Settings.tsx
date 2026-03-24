import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, Settings2, BarChart2,
  KeyRound, CircleCheck, RefreshCw, Plus, Settings as SettingsIcon, Trash2, Puzzle, Wrench, X,
  Info, FolderOpen, ExternalLink as ExternalLinkIcon, Eye, Loader2, AlertCircle, ChevronDown, Download,
  type LucideProps,
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { Provider, ProviderAuthType, ApiProtocol, ModelEntity, ModelAliases, ProxyProtocol } from '../../shared/types/config';
import { PROXY_DEFAULTS, isValidProxyHost, isVerifyExpired } from '../../shared/types/config';
import { PROVIDERS, getModelsDisplay } from '../../shared/providers';
import {
  globalApiGetJson,
  globalApiPostJson,
  globalApiDeleteJson,
  globalApiPutJson,
} from '../api/apiFetch';
import * as mcpService from '../services/mcpService';
import CustomSelect from '../components/CustomSelect';
import { ExternalLink } from '../components/ExternalLink';
import { openExternal } from '../utils/openExternal';
import { useAutostart } from '../hooks/useAutostart';
import { atomicModifyWorkspaces } from '../config/workspaceService';
import { isTauri } from '../utils/env';
import { isDeveloperMode, recordDeveloperClick } from '../utils/developerMode';
import UsageStatsPanel from '../components/UsageStatsPanel';

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
  isFree?: boolean;
  requiresConfig?: string[];
  configHint?: string;
  websiteUrl?: string;
  oauth?: { clientId: string; clientSecret?: string; scopes?: string[] };
  status?: 'enabled' | 'connecting' | 'pending' | 'needs-auth' | 'error' | 'disabled';
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

// ── Subscription 类型 ─────────────────────────────────────────

interface SubscriptionInfo {
  accountUuid?: string;
  email?: string;
  displayName?: string;
  organizationName?: string;
}

interface SubscriptionStatusData {
  available: boolean;
  path?: string;
  info?: SubscriptionInfo;
  verifyStatus?: 'idle' | 'loading' | 'valid' | 'invalid';
  verifyError?: string;
}

type NavId = 'provider' | 'mcp' | 'skills' | 'usage' | 'general' | 'about';

const NAV_ITEMS: { id: NavId; label: string; Icon: React.ComponentType<LucideProps> }[] = [
  { id: 'provider',        label: '模型供应商',     Icon: Brain },
  { id: 'skills',          label: 'Skills',         Icon: Puzzle },
  { id: 'mcp',             label: 'MCP',            Icon: Wrench },
  { id: 'usage',           label: '使用统计',       Icon: BarChart2 },
  { id: 'general',         label: '通用',           Icon: Settings2 },
  { id: 'about',           label: '关于',           Icon: Info },
];

/** Parse a string as a positive integer, returning undefined for invalid/non-positive values */
function parsePositiveInt(value: string): number | undefined {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n <= 0 ? undefined : n;
}

// ── 输入框公共样式 ────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none';

// ── Provider 单张卡片 ─────────────────────────────────────────

function ProviderCard({
  provider,
  apiKey,
  isActive,
  subscriptionStatus,
  onOpenEdit,
  onSaveKey,
  onReVerifySubscription,
  isVerifyLoading,
  verifyStatus,
  verifyError,
  onVerify,
}: {
  provider: Provider;
  apiKey: string;
  isActive: boolean;
  subscriptionStatus?: SubscriptionStatusData | null;
  onOpenEdit: () => void;
  onSaveKey: (id: string, key: string) => void;
  onReVerifySubscription?: () => void;
  isVerifyLoading?: boolean;
  verifyStatus?: 'valid' | 'invalid';
  verifyError?: string;
  onVerify?: () => void;
}) {
  return (
    <div
      className={`rounded-[14px] border bg-[var(--surface)] p-5 flex flex-col gap-3 transition-all ${
        isActive
          ? 'border-[var(--accent)]/60 shadow-sm'
          : 'border-[var(--border)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[15px] font-semibold text-[var(--ink)] truncate">{provider.name}</span>
          {isActive && (
            <span className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--accent)] text-white">
              使用中
            </span>
          )}
          <span className="shrink-0 rounded bg-[var(--hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-tertiary)]">{provider.cloudProvider}</span>
          {provider.apiProtocol === 'openai' && (
            <span className="shrink-0 rounded bg-[var(--hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-tertiary)]">OpenAI 协议</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {provider.websiteUrl && (
            <ExternalLink
              href={provider.websiteUrl}
              className="rounded p-1.5 text-[11px] text-[var(--ink-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              去官网
            </ExternalLink>
          )}
          <button
            onClick={onOpenEdit}
            className="rounded p-1.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
            title="管理"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>
      {provider.models?.length > 0 && (
        <p className="text-[13px] text-[var(--ink-secondary)]">{getModelsDisplay(provider)}</p>
      )}
      {/* API Provider: 内联 API Key 输入 */}
      {provider.type !== 'subscription' && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]" />
            <input
              type="password"
              placeholder="输入 API Key"
              value={apiKey}
              onChange={(e) => onSaveKey(provider.id, e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] py-2.5 pl-9 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>
          {/* 验证状态 */}
          {apiKey && (
            <div className="flex items-center gap-1 shrink-0">
              {isVerifyLoading && (
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-[var(--hover)]">
                  <Loader2 size={14} className="animate-spin text-[var(--ink-tertiary)]" />
                </div>
              )}
              {!isVerifyLoading && verifyStatus === 'valid' && (
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-[var(--success)]/10">
                  <CircleCheck size={14} className="text-[var(--success)]" />
                </div>
              )}
              {!isVerifyLoading && verifyStatus === 'invalid' && (
                <div
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-red-50"
                  title={verifyError || '验证失败'}
                >
                  <AlertCircle size={14} className="text-red-400" />
                </div>
              )}
              {!isVerifyLoading && !verifyStatus && (
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-[var(--hover)]" title="待验证">
                  <AlertCircle size={14} className="text-[var(--ink-tertiary)]" />
                </div>
              )}
              {verifyStatus !== 'valid' && onVerify && (
                <button
                  type="button"
                  onClick={onVerify}
                  disabled={isVerifyLoading}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-lg text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-50"
                  title="重新验证"
                >
                  <RefreshCw size={14} className={isVerifyLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {/* 订阅 Provider: 显示账户信息和验证状态 */}
      {provider.type === 'subscription' && (
        <div className="space-y-1.5">
          <p className="text-[13px] text-[var(--ink-secondary)]">使用 Anthropic 订阅账户，无需 API Key</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {subscriptionStatus?.available ? (
              <>
                <span className="text-[var(--ink-tertiary)] font-mono text-[11px]">
                  {subscriptionStatus.info?.email}
                </span>
                {subscriptionStatus.verifyStatus === 'loading' && (
                  <div className="flex items-center gap-1 text-[var(--ink-tertiary)]">
                    <Loader2 size={13} className="animate-spin" />
                  </div>
                )}
                {subscriptionStatus.verifyStatus === 'valid' && (
                  <div className="flex items-center gap-1 text-[var(--success)]">
                    <CircleCheck size={13} />
                    <span className="font-medium">已验证</span>
                    {onReVerifySubscription && (
                      <button
                        type="button"
                        onClick={onReVerifySubscription}
                        className="ml-0.5 rounded p-0.5 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                        title="重新验证"
                      >
                        <RefreshCw size={11} />
                      </button>
                    )}
                  </div>
                )}
                {subscriptionStatus.verifyStatus === 'invalid' && (
                  <div className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={13} />
                    <span className="font-medium">验证失败</span>
                    {onReVerifySubscription && (
                      <button
                        type="button"
                        onClick={onReVerifySubscription}
                        className="ml-0.5 rounded p-0.5 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                        title="重新验证"
                      >
                        <RefreshCw size={11} />
                      </button>
                    )}
                  </div>
                )}
                {subscriptionStatus.verifyStatus === 'idle' && (
                  <span className="text-[var(--ink-tertiary)]">检测中...</span>
                )}
              </>
            ) : subscriptionStatus !== null ? (
              <span className="text-[var(--ink-tertiary)]">
                未登录，请先使用 Claude Code CLI 登录 (claude --login)
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Provider Add/Edit Modal ───────────────────────────────────

function ProviderEditModal({
  provider,
  onSave,
  onSavePresetModels,
  onDelete,
  onSaveKey,
  onSaveModelAliases,
  onClose,
}: {
  provider: Provider | null;
  onSave: (data: Partial<Provider>) => Promise<void>;
  onSavePresetModels?: (providerId: string, models: ModelEntity[]) => Promise<void>;
  onDelete?: () => Promise<void>;
  onSaveKey?: (id: string, key: string) => Promise<void>;
  onSaveModelAliases?: (providerId: string, aliases: ModelAliases) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !provider;
  const isBuiltin = provider?.isBuiltin ?? false;

  const [form, setForm] = useState({
    name: provider?.name ?? '',
    vendor: provider?.vendor ?? '',
    apiProtocol: (provider?.apiProtocol ?? 'anthropic') as ApiProtocol,
    baseUrl: provider?.config?.baseUrl ?? '',
    authType: (provider?.authType ?? 'auth_token') as Extract<ProviderAuthType, 'auth_token' | 'api_key'>,
    maxOutputTokens: String(provider?.maxOutputTokens ?? ''),
    upstreamFormat: (provider?.upstreamFormat ?? 'chat_completions') as 'chat_completions' | 'responses',
    models: provider?.models?.map((m) => m.model) ?? [],
    newModelInput: '',
    apiKey: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editModelAliases, setEditModelAliases] = useState<ModelAliases>({
    opus: provider?.modelAliases?.opus ?? '',
    sonnet: provider?.modelAliases?.sonnet ?? '',
    haiku: provider?.modelAliases?.haiku ?? '',
  });
  const isAnthropicProvider = provider?.id === 'anthropic-sub' || provider?.id === 'anthropic-api';

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
    if (!form.baseUrl.trim()) {
      setError('Base URL 不能为空');
      return false;
    }
    try {
      new URL(form.baseUrl);
    } catch {
      setError('Base URL 格式不正确');
      return false;
    }
    if (form.models.length === 0) {
      setError('至少添加一个模型');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (isBuiltin && provider && onSavePresetModels) {
        // 预设 Provider: 只保存用户追加的自定义模型
        const presetModelIds = new Set(
          PROVIDERS.find((p) => p.id === provider.id)?.models.map((m) => m.model) ?? [],
        );
        const customModels = form.models
          .filter((m) => !presetModelIds.has(m))
          .map((m) => ({ model: m, modelName: m, modelSeries: 'custom' }));
        await onSavePresetModels(provider.id, customModels);
        // 保存模型别名
        if (onSaveModelAliases && !isAnthropicProvider) {
          await onSaveModelAliases(provider.id, editModelAliases);
        }
        onClose();
        return;
      }
      if (!validate()) { setSaving(false); return; }
      const providerId = isNew
        ? `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        : provider!.id;
      await onSave({
        id: providerId,
        name: form.name.trim(),
        vendor: form.vendor.trim() || form.name.trim(),
        cloudProvider: '自定义',
        type: 'api',
        primaryModel: form.models[0] ?? '',
        isBuiltin: false,
        authType: form.authType,
        apiProtocol: form.apiProtocol === 'openai' ? 'openai' : undefined,
        ...(form.apiProtocol === 'openai' && form.maxOutputTokens ? { maxOutputTokens: parsePositiveInt(form.maxOutputTokens) } : {}),
        ...(form.apiProtocol === 'openai' && form.upstreamFormat !== 'chat_completions' ? { upstreamFormat: form.upstreamFormat } : {}),
        config: {
          baseUrl: form.baseUrl.trim() || undefined,
        },
        models: form.models.map((m) => ({ model: m, modelName: m, modelSeries: 'custom' })),
        modelAliases: (editModelAliases.sonnet || editModelAliases.opus || editModelAliases.haiku)
          ? editModelAliases : undefined,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
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
              {isNew ? '添加自定义供应商' : isBuiltin ? '管理供应商' : '编辑供应商'}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--ink-tertiary)]">
              {isBuiltin ? '查看供应商信息，追加自定义模型' : '配置供应商基本信息'}
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

          {/* 供应商名称 */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">
              供应商名称 {!isBuiltin && <span className="text-red-400">*</span>}
            </label>
            {isBuiltin ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink-tertiary)]">
                {form.name}
              </div>
            ) : (
              <input
                type="text"
                placeholder="例如: My Custom Provider"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            )}
          </div>

          {/* 服务商标签 — 仅自定义供应商 */}
          {!isBuiltin && (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">服务商标签</label>
              <input
                type="text"
                placeholder="例如: 云服务商"
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                className={inputCls}
              />
            </div>
          )}

          {/* API 协议 — 仅自定义供应商 */}
          {!isBuiltin && (
            <div>
              <label className="mb-0.5 block text-[12px] font-medium text-[var(--ink-secondary)]">API 协议</label>
              {form.apiProtocol === 'openai' && (
                <p className="mb-1 text-[11px] text-[var(--ink-tertiary)]">
                  通过内置桥接自动转换为 Anthropic 协议，存在稳定性风险
                </p>
              )}
              <div className={`flex gap-4${form.apiProtocol !== 'openai' ? ' mt-1' : ''}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apiProtocol"
                    value="anthropic"
                    checked={form.apiProtocol !== 'openai'}
                    onChange={() => setForm((f) => ({ ...f, apiProtocol: 'anthropic' as ApiProtocol, authType: 'auth_token' as const }))}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[13px] text-[var(--ink)]">Anthropic 兼容</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apiProtocol"
                    value="openai"
                    checked={form.apiProtocol === 'openai'}
                    onChange={() => setForm((f) => ({ ...f, apiProtocol: 'openai' as ApiProtocol, authType: 'api_key' as const }))}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[13px] text-[var(--ink)]">OpenAI 兼容</span>
                </label>
              </div>
            </div>
          )}

          {/* API Base URL */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">
              API Base URL {!isBuiltin && <span className="text-red-400">*</span>}
            </label>
            {isBuiltin ? (
              form.baseUrl && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink-tertiary)] font-mono break-all">
                  {form.baseUrl}
                </div>
              )
            ) : (
              <input
                type="url"
                placeholder={form.apiProtocol === 'openai' ? 'https://api.openai.com/v1' : 'https://api.example.com/anthropic'}
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                className={inputCls}
              />
            )}
          </div>

          {/* OpenAI Bridge 特有字段 — 仅自定义 + openai 协议 */}
          {!isBuiltin && form.apiProtocol === 'openai' && (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">最大输出 Token</label>
                <input
                  type="number"
                  placeholder="8192"
                  value={form.maxOutputTokens}
                  onChange={(e) => setForm((f) => ({ ...f, maxOutputTokens: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[12px] font-medium text-[var(--ink-secondary)]">接口格式</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="upstreamFormat"
                      value="chat_completions"
                      checked={form.upstreamFormat === 'chat_completions'}
                      onChange={() => setForm((f) => ({ ...f, upstreamFormat: 'chat_completions' }))}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--ink)]">Chat Completions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="upstreamFormat"
                      value="responses"
                      checked={form.upstreamFormat === 'responses'}
                      onChange={() => setForm((f) => ({ ...f, upstreamFormat: 'responses' }))}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--ink)]">Responses API</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* 认证方式 — 仅自定义 + Anthropic 协议 */}
          {!isBuiltin && form.apiProtocol !== 'openai' && (
            <div>
              <label className="mb-0.5 block text-[12px] font-medium text-[var(--ink-secondary)]">认证方式</label>
              <p className="mb-1 text-[11px] text-[var(--ink-tertiary)]">请根据供应商认证参数进行选择</p>
              <div className="flex gap-4">
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
            </div>
          )}

          {/* 模型列表 */}
          {isBuiltin && form.models.length > 0 && (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">模型列表</label>
              <div className="flex flex-wrap gap-1.5">
                {form.models.map((model) => {
                  const isPresetModel = provider?.models?.some((m) => m.model === model);
                  const displayName = provider?.models?.find((m) => m.model === model)?.modelName ?? model;
                  return (
                    <div key={model} className="flex items-center gap-1 rounded-md bg-[var(--hover)] px-2 py-1 text-[12px] font-medium text-[var(--ink)]">
                      <span>{displayName}</span>
                      {isPresetModel && (
                        <span className="text-[10px] text-[var(--ink-tertiary)] ml-0.5">预设</span>
                      )}
                      {!isPresetModel && (
                        <button type="button" onClick={() => removeModel(model)} className="ml-0.5 rounded p-0.5 text-[var(--ink-tertiary)] hover:text-red-400">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 添加自定义模型 ID */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">
              {isBuiltin ? '添加自定义模型 ID' : '模型 ID'} {!isBuiltin && <span className="text-red-400">*</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入模型 ID，按 Enter 添加"
                value={form.newModelInput}
                onChange={(e) => setForm((f) => ({ ...f, newModelInput: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } }}
                className={inputCls}
              />
              <button
                type="button"
                onClick={addModel}
                disabled={!form.newModelInput.trim()}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
            {/* 自定义供应商: 模型列表在输入框下方 */}
            {!isBuiltin && form.models.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.models.map((model, index) => (
                  <div key={model} className="flex items-center gap-1 rounded-md bg-[var(--hover)] px-2 py-1 text-[12px] font-medium text-[var(--ink)]">
                    <span className="text-[10px] text-[var(--ink-tertiary)]">{index + 1}.</span>
                    <span>{model}</span>
                    <button type="button" onClick={() => removeModel(model)} className="ml-0.5 rounded p-0.5 text-[var(--ink-tertiary)] hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 高级选项 — 子 Agent 模型别名映射（Anthropic 不显示） */}
          {!isAnthropicProvider && !isNew && (
            <div className="border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center gap-1.5 text-[12px] font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? '' : '-rotate-90'}`} />
                高级选项
              </button>
              {showAdvanced && (() => {
                const allModels = form.models;
                const aliasOptions = [
                  { value: '', label: '未设置' },
                  ...allModels.map((m) => {
                    const displayName = provider?.models?.find((pm) => pm.model === m)?.modelName ?? m;
                    return { value: m, label: displayName };
                  }),
                ];
                const ALIAS_LABELS: Record<string, string> = {
                  opus: 'Opus（大杯）',
                  sonnet: 'Sonnet（中杯）',
                  haiku: 'Haiku（小杯）',
                };
                return (
                  <div className="mt-3">
                    <label className="mb-1 block text-[12px] font-medium text-[var(--ink)]">子 Agent 模型映射</label>
                    <p className="mb-3 text-[11px] leading-relaxed text-[var(--ink-tertiary)]">
                      Opus 大杯、Sonnet 中杯、Haiku 小杯 — 映射到此供应商的实际模型
                    </p>
                    <div className="space-y-2.5">
                      {(['opus', 'sonnet', 'haiku'] as const).map((alias) => (
                        <div key={alias} className="flex items-center gap-2.5">
                          <span className="w-[90px] shrink-0 text-[11px] text-[var(--ink-tertiary)]">{ALIAS_LABELS[alias]}</span>
                          <CustomSelect
                            value={editModelAliases[alias] ?? ''}
                            options={aliasOptions}
                            onChange={(v) => setEditModelAliases((prev) => ({ ...prev, [alias]: v }))}
                            placeholder="未设置"
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {isNew && (
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
                确定要删除供应商 &quot;<span className="font-medium text-[var(--ink)]">{provider?.name}</span>&quot; 吗？
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

// ── Provider Tab ──────────────────────────────────────────────

function ProviderTab() {
  const { config, currentProvider, allProviders, isLoading, updateConfig, refreshConfig, providerVerifyStatus, saveProviderVerifyStatus } = useConfig();
  const [editProvider, setEditProvider] = useState<Provider | null | 'new'>(null);

  // ── Subscription 状态 ──
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusData | null>(null);

  // ── API Key 验证状态（非订阅供应商） ──
  const [verifyLoading, setVerifyLoading] = useState<Record<string, boolean>>({});
  const [verifyError, setVerifyError] = useState<Record<string, string>>({});
  const verifyGenRef = useRef<Record<string, number>>({});
  const verifyTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const SUBSCRIPTION_PROVIDER_ID = 'anthropic-sub';

  // providerVerifyStatus is now in ConfigContext (loaded at app startup)
  // Use a ref to access latest value inside async callbacks
  const providerVerifyStatusRef = useRef(providerVerifyStatus);
  providerVerifyStatusRef.current = providerVerifyStatus;
  const saveProviderVerifyStatusRef = useRef(saveProviderVerifyStatus);
  saveProviderVerifyStatusRef.current = saveProviderVerifyStatus;

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1500;

    const verifySubscriptionCredentials = async (status: SubscriptionStatusData, forceVerify = false) => {
      if (!status.available || !status.info) return;

      const currentEmail = status.info.email;
      const cached = providerVerifyStatusRef.current[SUBSCRIPTION_PROVIDER_ID];

      // 只缓存成功验证；失败的每次重试
      if (!forceVerify && cached && cached.status === 'valid') {
        const isExpired = isVerifyExpired(cached.verifiedAt);
        const isSameAccount = cached.accountEmail === currentEmail;
        if (!isExpired && isSameAccount) {
          console.log('[Settings] Using cached subscription verification (valid)');
          if (isMounted) {
            setSubscriptionStatus((prev) => prev ? { ...prev, verifyStatus: 'valid' } : prev);
          }
          return;
        }
      }

      if (isMounted) {
        setSubscriptionStatus((prev) => prev ? { ...prev, verifyStatus: 'loading' } : prev);
      }
      try {
        const result = await globalApiPostJson<{ success: boolean; error?: string }>('/api/subscription/verify', {});
        if (result.success) {
          await saveProviderVerifyStatusRef.current(SUBSCRIPTION_PROVIDER_ID, 'valid', currentEmail);
        }
        if (isMounted) {
          setSubscriptionStatus((prev) => prev ? {
            ...prev,
            verifyStatus: result.success ? 'valid' : 'invalid',
            verifyError: result.error,
          } : prev);
        }
      } catch (err) {
        if (isMounted) {
          setSubscriptionStatus((prev) => prev ? {
            ...prev,
            verifyStatus: 'invalid',
            verifyError: err instanceof Error ? err.message : '验证失败',
          } : prev);
        }
      }
    };

    const checkSubscription = async () => {
      try {
        const status = await globalApiGetJson<SubscriptionStatusData>('/api/subscription/status');
        if (!isMounted) return;
        setSubscriptionStatus({ ...status, verifyStatus: 'idle' });
        if (status.available && status.info) {
          verifySubscriptionCredentials(status);
        }
      } catch (err) {
        if (!isMounted) return;
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkSubscription, retryDelay);
        } else {
          console.error('[Settings] Failed to check subscription:', err);
          setSubscriptionStatus({ available: false });
        }
      }
    };

    const timer = setTimeout(checkSubscription, 500);
    return () => { isMounted = false; clearTimeout(timer); };
  }, []);

  const handleReVerifySubscription = useCallback(async () => {
    if (!subscriptionStatus?.available || !subscriptionStatus?.info) return;
    const currentEmail = subscriptionStatus.info.email;
    setSubscriptionStatus((prev) => prev ? { ...prev, verifyStatus: 'loading', verifyError: undefined } : prev);
    try {
      const result = await globalApiPostJson<{ success: boolean; error?: string }>('/api/subscription/verify', {});
      if (result.success) {
        await saveProviderVerifyStatusRef.current(SUBSCRIPTION_PROVIDER_ID, 'valid', currentEmail);
      }
      setSubscriptionStatus((prev) => prev ? {
        ...prev,
        verifyStatus: result.success ? 'valid' : 'invalid',
        verifyError: result.error,
      } : prev);
    } catch (err) {
      setSubscriptionStatus((prev) => prev ? {
        ...prev,
        verifyStatus: 'invalid',
        verifyError: err instanceof Error ? err.message : '验证失败',
      } : prev);
    }
  }, [subscriptionStatus]);

  // ── API Key 验证（防抖 + generation counter 防竞态） ──
  const verifyProvider = useCallback(async (provider: Provider, apiKey: string) => {
    if (!apiKey || !provider.config?.baseUrl) return;

    const gen = (verifyGenRef.current[provider.id] ?? 0) + 1;
    verifyGenRef.current[provider.id] = gen;

    console.log(`[Settings] verifyProvider: id=${provider.id}, baseUrl=${provider.config.baseUrl}, model=${provider.primaryModel}, apiKey=${apiKey.slice(0, 8)}...`);

    setVerifyLoading((prev) => ({ ...prev, [provider.id]: true }));
    setVerifyError((prev) => ({ ...prev, [provider.id]: '' }));

    try {
      const resp = await globalApiPostJson<{ result: 'ok' | 'fail'; error?: string }>('/api/verify-provider-key', {
        baseUrl: provider.config.baseUrl,
        apiKey,
        model: provider.primaryModel,
        authType: provider.authType,
        apiProtocol: provider.apiProtocol,
        maxOutputTokens: provider.maxOutputTokens,
        upstreamFormat: provider.upstreamFormat,
      });

      console.log(`[Settings] verifyProvider result: id=${provider.id}, result=${resp.result}${resp.error ? `, error=${resp.error}` : ''}`);

      // 竞态守卫：只接受最新一次验证的结果
      if (verifyGenRef.current[provider.id] !== gen) return;

      const newStatus = resp.result === 'ok' ? 'valid' : 'invalid';
      await saveProviderVerifyStatusRef.current(provider.id, newStatus as 'valid' | 'invalid');
      if (resp.error) setVerifyError((prev) => ({ ...prev, [provider.id]: resp.error! }));
    } catch {
      if (verifyGenRef.current[provider.id] !== gen) return;
    } finally {
      if (verifyGenRef.current[provider.id] === gen) {
        setVerifyLoading((prev) => ({ ...prev, [provider.id]: false }));
      }
    }
  }, []);

  // 清理 debounce timeouts
  useEffect(() => {
    const timeouts = verifyTimeoutRef.current;
    return () => { Object.values(timeouts).forEach(clearTimeout); };
  }, []);

  // ── mount 时检查所有 API 供应商的验证是否过期 ──
  const allProvidersRef = useRef(allProviders);
  allProvidersRef.current = allProviders;
  const verifyProviderRef = useRef(verifyProvider);
  verifyProviderRef.current = verifyProvider;

  useEffect(() => {
    const timer = setTimeout(() => {
      allProvidersRef.current.forEach((provider) => {
        if (provider.type === 'subscription') return;
        const apiKey = config.apiKeys[provider.id];
        const cached = providerVerifyStatusRef.current[provider.id];
        if (apiKey && cached?.verifiedAt && isVerifyExpired(cached.verifiedAt)) {
          console.log(`[Settings] Provider ${provider.id} verification expired, re-verifying...`);
          verifyProviderRef.current(provider, apiKey);
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveKey = async (providerId: string, key: string) => {
    await updateConfig({ apiKeys: { ...config.apiKeys, [providerId]: key } });

    // 防抖自动验证
    if (verifyTimeoutRef.current[providerId]) {
      clearTimeout(verifyTimeoutRef.current[providerId]);
    }
    if (key) {
      const provider = allProviders.find((p) => p.id === providerId);
      if (provider) {
        verifyTimeoutRef.current[providerId] = setTimeout(() => {
          verifyProvider(provider, key);
        }, 500);
      }
    }
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
      apiProtocol: data.apiProtocol,
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
      apiProtocol: data.apiProtocol,
      config: data.config,
      models: data.models,
    });
    await refreshConfig();
  };

  const handleSavePresetModels = async (providerId: string, models: ModelEntity[]) => {
    await globalApiPutJson('/api/preset-custom-models', { providerId, models });
    await refreshConfig();
  };

  const handleSaveModelAliases = async (providerId: string, aliases: ModelAliases) => {
    await globalApiPutJson('/api/provider-model-aliases', { providerId, aliases });
    await refreshConfig();
  };

  const handleDeleteProvider = async () => {
    if (!editProvider || editProvider === 'new') return;
    const providerId = editProvider.id;

    // 如果是当前使用的供应商，切换到默认 Anthropic 订阅
    if (currentProvider.id === providerId) {
      await updateConfig({ currentProviderId: 'anthropic-sub' });
    }

    // 清理引用了该 Provider 的 Workspace
    await atomicModifyWorkspaces((prev) =>
      prev.map((w) =>
        w.providerId === providerId ? { ...w, providerId: undefined } : w,
      ),
    );

    // 删除对应的 API Key
    const newApiKeys = { ...config.apiKeys };
    delete newApiKeys[providerId];
    await updateConfig({ apiKeys: newApiKeys });

    // 调用后端删除 API
    await globalApiDeleteJson(`/api/providers/${providerId}`);

    // 刷新列表（含 workspaces）
    await refreshConfig();
  };

  // 一行一个 Provider

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">模型供应商</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">配置 API 密钥以使用不同的模型供应商</p>
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
          {allProviders.map((provider) => {
            const cached = providerVerifyStatus[provider.id];
            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                apiKey={config.apiKeys[provider.id] ?? ''}
                isActive={currentProvider.id === provider.id}
                subscriptionStatus={provider.type === 'subscription' ? subscriptionStatus : undefined}
                onOpenEdit={() => setEditProvider(provider)}
                onSaveKey={handleSaveKey}
                onReVerifySubscription={provider.type === 'subscription' ? handleReVerifySubscription : undefined}
                isVerifyLoading={verifyLoading[provider.id]}
                verifyStatus={cached?.status as 'valid' | 'invalid' | undefined}
                verifyError={verifyError[provider.id]}
                onVerify={() => verifyProvider(provider, config.apiKeys[provider.id] ?? '')}
              />
            );
          })}
        </div>
      )}

      {editProvider && (
        <ProviderEditModal
          provider={editProvider === 'new' ? null : editProvider}
          onSave={editProvider === 'new' ? handleAddProvider : handleUpdateProvider}
          onSavePresetModels={handleSavePresetModels}
          onDelete={editProvider !== 'new' ? handleDeleteProvider : undefined}
          onSaveKey={handleSaveKey}
          onSaveModelAliases={handleSaveModelAliases}
          onClose={() => setEditProvider(null)}
        />
      )}
    </div>
  );
}

// ── KeyValue Editor ───────────────────────────────────────────

function KeyValueEditor({
  value,
  onChange,
  disabled,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'VALUE',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const rows = value
    ? value.split('\n').map((line) => {
        const idx = line.indexOf('=');
        return idx > 0
          ? { key: line.slice(0, idx), val: line.slice(idx + 1) }
          : { key: line, val: '' };
      })
    : [];

  const updateRows = (newRows: { key: string; val: string }[]) => {
    onChange(newRows.map((r) => `${r.key}=${r.val}`).join('\n'));
  };

  const handleKeyChange = (index: number, newKey: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], key: newKey };
    updateRows(newRows);
  };

  const handleValChange = (index: number, newVal: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], val: newVal };
    updateRows(newRows);
  };

  const addRow = () => {
    updateRows([...rows, { key: '', val: '' }]);
  };

  const removeRow = (index: number) => {
    updateRows(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => handleKeyChange(i, e.target.value)}
            disabled={disabled}
            className={`${inputCls} flex-1`}
          />
          <span className="text-[var(--ink-tertiary)] text-[12px]">=</span>
          <input
            type="text"
            placeholder={valuePlaceholder}
            value={row.val}
            onChange={(e) => handleValChange(i, e.target.value)}
            disabled={disabled}
            className={`${inputCls} flex-1`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-[var(--ink-tertiary)] hover:text-[var(--error)] transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
        >
          <Plus size={12} />
          添加
        </button>
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
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');

  // Reset form when editing a different MCP server
  useEffect(() => {
    setForm({
      id: mcp?.id ?? '',
      name: mcp?.name ?? '',
      type: (mcp?.type ?? 'stdio') as MCPServerConfig['type'],
      command: mcp?.command ?? '',
      args: mcp?.args?.join(', ') ?? '',
      url: mcp?.url ?? '',
      env: mcp?.env ? Object.entries(mcp.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
      headers: mcp?.headers ? Object.entries(mcp.headers).map(([k, v]) => `${k}=${v}`).join('\n') : '',
    });
    setError('');
  }, [mcp]);

  const formToJson = () => {
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
    const obj: Record<string, unknown> = {
      name: form.name,
      type: form.type,
    };
    if (form.type === 'stdio') {
      if (form.command) obj.command = form.command;
      if (argsArr.length > 0) obj.args = argsArr;
    } else {
      if (form.url) obj.url = form.url;
      if (Object.keys(headersObj).length > 0) obj.headers = headersObj;
    }
    if (Object.keys(envObj).length > 0) obj.env = envObj;
    return JSON.stringify(obj, null, 2);
  };

  // Unwrap mcpServers wrapper (Claude Desktop format) to flat server config
  const unwrapMcpJson = (raw: Record<string, unknown>): { id?: string; config: Record<string, unknown> } => {
    // { "mcpServers": { "name": { ... } } }
    if (raw.mcpServers && typeof raw.mcpServers === 'object') {
      const servers = raw.mcpServers as Record<string, unknown>;
      const keys = Object.keys(servers);
      if (keys.length === 1 && typeof servers[keys[0]] === 'object') {
        return { id: keys[0], config: servers[keys[0]] as Record<string, unknown> };
      }
    }
    // flat format: { "name": "...", "type": "...", ... }
    return { config: raw };
  };

  const jsonToForm = (json: string): boolean => {
    try {
      const raw = JSON.parse(json) as Record<string, unknown>;
      const { id: serverId, config: obj } = unwrapMcpJson(raw);
      setForm({
        id: serverId || form.id,
        name: (obj.name as string) ?? serverId ?? '',
        type: ((obj.type as string) ?? 'stdio') as MCPServerConfig['type'],
        command: (obj.command as string) ?? '',
        args: Array.isArray(obj.args) ? (obj.args as string[]).join(', ') : '',
        url: (obj.url as string) ?? '',
        env: obj.env && typeof obj.env === 'object'
          ? Object.entries(obj.env as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('\n')
          : '',
        headers: obj.headers && typeof obj.headers === 'object'
          ? Object.entries(obj.headers as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('\n')
          : '',
      });
      return true;
    } catch {
      return false;
    }
  };

  const toggleJsonMode = () => {
    if (jsonMode) {
      if (!jsonToForm(jsonText)) {
        setError('JSON 格式错误，无法切换到表单模式');
        return;
      }
      setError('');
    } else {
      setJsonText(formToJson());
      setError('');
    }
    setJsonMode(!jsonMode);
  };

  const handleSave = async () => {
    if (isReadonly) return;

    // JSON mode: parse directly from jsonText
    if (jsonMode) {
      let raw: Record<string, unknown>;
      try { raw = JSON.parse(jsonText); } catch { setError('JSON 格式错误'); return; }
      const { id: serverId, config: obj } = unwrapMcpJson(raw);
      const name = ((obj.name as string) ?? serverId ?? '').trim();
      const type = ((obj.type as string) ?? 'stdio') as MCPServerConfig['type'];
      const command = (obj.command as string)?.trim();
      const url = (obj.url as string)?.trim();
      const effectiveId = form.id.trim() || serverId || '';
      if (!effectiveId) { setError('ID 不能为空'); return; }
      if (!name) { setError('名称不能为空'); return; }
      if (type === 'stdio' && !command) { setError('Command 不能为空'); return; }
      if (type !== 'stdio' && !url) { setError('URL 不能为空'); return; }
      setSaving(true); setError('');
      try {
        await onSave(effectiveId, {
          name,
          type,
          command: type === 'stdio' ? command : undefined,
          args: type === 'stdio' && Array.isArray(obj.args) ? (obj.args as string[]) : undefined,
          env: obj.env && typeof obj.env === 'object' ? obj.env as Record<string, string> : undefined,
          url: type !== 'stdio' ? url : undefined,
          headers: type !== 'stdio' && obj.headers && typeof obj.headers === 'object' ? obj.headers as Record<string, string> : undefined,
        });
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || '保存失败');
      } finally {
        setSaving(false);
      }
      return;
    }

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || '保存失败');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
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
          <div className="flex items-center gap-2">
            {!isReadonly && (
              <button
                onClick={toggleJsonMode}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[12px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)] transition-colors"
              >
                {jsonMode ? '表单模式' : 'JSON'}
              </button>
            )}
            <button onClick={onClose} className="mt-0.5 text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          )}

          {jsonMode ? (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">JSON 配置</label>
              <textarea
                rows={14}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className={`${inputCls} resize-none font-mono text-[13px]`}
                spellCheck={false}
              />
            </div>
          ) : (
            <>
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
                    <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">Headers</label>
                    <KeyValueEditor
                      value={form.headers}
                      onChange={(v) => setForm((f) => ({ ...f, headers: v }))}
                      disabled={isReadonly}
                      keyPlaceholder="Header 名"
                      valuePlaceholder="值"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--ink-secondary)]">环境变量</label>
                <KeyValueEditor
                  value={form.env}
                  onChange={(v) => setForm((f) => ({ ...f, env: v }))}
                  disabled={isReadonly}
                  keyPlaceholder="变量名"
                  valuePlaceholder="值"
                />
              </div>
            </>
          )}
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
  const [needsConfig, setNeedsConfig] = useState<Record<string, boolean>>({});
  const [configDialog, setConfigDialog] = useState<McpServerDefinition | null>(null);
  const [configEnvValues, setConfigEnvValues] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [toggleErrors, setToggleErrors] = useState<Record<string, { type: string; message: string; runtimeName?: string; downloadUrl?: string }>>({});

  const loadServers = async () => {
    try {
      const data = await mcpService.fetchMcpServers();
      setServers(data.servers);
      setEnabledIds(new Set(data.enabledIds));
      // Load needs-config status
      const ncData = await mcpService.checkNeedsConfig();
      setNeedsConfig(ncData);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadServers(); }, []);

  const handleToggle = async (srv: McpServerDefinition, enabled: boolean) => {
    // If enabling and needs config, open config dialog first
    if (enabled && srv.requiresConfig?.length && needsConfig[srv.id]) {
      await openConfigDialog(srv);
      return;
    }
    const id = srv.id;
    setTogglingIds((prev) => new Set([...prev, id]));
    setToggleErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const resp = await mcpService.toggleMcpServer(id, enabled);
      if (resp.ok) {
        setEnabledIds((prev) => {
          const next = new Set(prev);
          if (enabled) next.add(id); else next.delete(id);
          return next;
        });
      } else if (resp.error) {
        setToggleErrors((prev) => ({ ...prev, [id]: resp.error! }));
      }
    } catch { /* ignore */ }
    finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openConfigDialog = async (srv: McpServerDefinition) => {
    try {
      const allEnv = await mcpService.fetchMcpEnv();
      setConfigEnvValues(allEnv[srv.id] ?? {});
    } catch {
      setConfigEnvValues({});
    }
    setConfigDialog(srv);
  };

  const handleConfigSave = async () => {
    if (!configDialog) return;
    setConfigSaving(true);
    try {
      await mcpService.saveMcpEnv(configDialog.id, configEnvValues);
      // Auto-enable after config
      await mcpService.toggleMcpServer(configDialog.id, true);
      setEnabledIds((prev) => new Set([...prev, configDialog.id]));
      setNeedsConfig((prev) => ({ ...prev, [configDialog.id]: false }));
      setConfigDialog(null);
    } catch { /* ignore */ }
    finally { setConfigSaving(false); }
  };

  const handleSave = async (id: string, cfg: Omit<MCPServerConfig, 'id'>) => {
    let resp: { ok?: boolean; error?: string };
    if (editMCP === 'new') {
      resp = await mcpService.addMcpServer(id, cfg as Record<string, unknown>);
    } else {
      resp = await mcpService.updateMcpServer(id, cfg as Record<string, unknown>);
    }
    if (!resp.ok) {
      throw new Error(resp.error ?? '保存失败');
    }
    await loadServers();
  };

  const handleDelete = async (id: string) => {
    await mcpService.deleteMcpServer(id);
    await loadServers();
  };

  const handleJsonImport = async () => {
    setJsonError('');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setJsonError('JSON 格式错误，请检查语法');
      return;
    }
    const serversObj = (parsed.mcpServers ?? parsed) as Record<string, unknown>;
    const entries = Object.entries(serversObj).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
    if (entries.length === 0) {
      setJsonError('未找到有效的 MCP 服务器配置');
      return;
    }
    const added: string[] = [];
    const skipped: string[] = [];
    const existingIds = new Set(servers.map(s => s.id));
    for (const [name, rawConfig] of entries) {
      const config = rawConfig as Record<string, unknown>;
      const id = name.toLowerCase().replace(/\s+/g, '-');
      if (existingIds.has(id)) { skipped.push(id); continue; }
      const hasCommand = typeof config.command === 'string';
      const hasUrl = typeof config.url === 'string';
      let type: 'stdio' | 'http' | 'sse' = 'stdio';
      if (!hasCommand && hasUrl) {
        type = (config.transportType === 'sse' || config.type === 'sse') ? 'sse' : 'http';
      }
      try {
        await mcpService.addMcpServer(id, {
          name, type,
          ...(type === 'stdio' && {
            command: config.command,
            args: Array.isArray(config.args) ? config.args : undefined,
            env: config.env && typeof config.env === 'object' ? config.env : undefined,
          }),
          ...((type === 'http' || type === 'sse') && {
            url: config.url,
            headers: config.headers && typeof config.headers === 'object' ? config.headers : undefined,
          }),
        });
        added.push(id);
        existingIds.add(id);
      } catch { /* single failure doesn't block rest */ }
    }
    if (added.length > 0) {
      await loadServers();
      setJsonInput('');
      setShowJsonImport(false);
      if (skipped.length > 0) {
        setJsonError(`已添加 ${added.length} 个，跳过 ${skipped.length} 个已存在的（${skipped.join(', ')}）`);
      }
    } else if (skipped.length > 0) {
      setJsonError(`所有服务器均已存在：${skipped.join(', ')}`);
    }
  };

  const handleExportMcpJson = useCallback(async () => {
    try {
      const data = await mcpService.fetchMcpServers();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'soagents-mcp-config.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Failed to export MCP config:', err);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">MCP Servers</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">管理 MCP Server 配置，开关控制全局启用</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMcpJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--ink-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors"
          >
            <Download size={14} />
            导出 JSON
          </button>
          <button
            onClick={() => { setShowJsonImport(true); setJsonError(''); }}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            JSON 导入
          </button>
          <button
            onClick={() => setEditMCP('new')}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            添加
          </button>
        </div>
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
            const showNeedsConfig = srv.requiresConfig?.length && needsConfig[srv.id];
            return (
              <div key={srv.id} className="flex items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--ink)]">{srv.name}</span>
                    {srv.isBuiltin && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-600 font-semibold">
                        预设
                      </span>
                    )}
                    {srv.isFree && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 font-semibold">
                        免费
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full ${
                      srv.status === 'enabled'
                        ? 'bg-[var(--success)]/10 text-[var(--success)]'
                        : srv.status === 'error'
                          ? 'bg-[var(--error)]/10 text-[var(--error)]'
                          : srv.status === 'connecting' || srv.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600'
                            : srv.status === 'needs-auth'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-[var(--surface)] text-[var(--ink-tertiary)]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        srv.status === 'enabled' ? 'bg-[var(--success)]'
                          : srv.status === 'error' ? 'bg-[var(--error)]'
                          : srv.status === 'connecting' || srv.status === 'pending' ? 'bg-amber-500'
                          : srv.status === 'needs-auth' ? 'bg-blue-500'
                          : 'bg-[var(--ink-tertiary)]'
                      }`} />
                      {srv.status === 'enabled' ? '已启用'
                        : srv.status === 'error' ? '错误'
                        : srv.status === 'connecting' ? '连接中'
                        : srv.status === 'pending' ? '等待中'
                        : srv.status === 'needs-auth' ? '需认证'
                        : '未启用'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">
                    {srv.description ?? ''}
                  </p>
                  {showNeedsConfig && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      需要配置 API Key
                    </p>
                  )}
                  {srv.oauth && (
                    <p className="mt-0.5 text-xs text-blue-600">
                      需要 OAuth 授权
                    </p>
                  )}
                  {toggleErrors[srv.id] && (
                    <div className="mt-1 text-xs text-red-600">
                      <span>{toggleErrors[srv.id].message}</span>
                      {toggleErrors[srv.id].downloadUrl && (
                        <ExternalLink
                          href={toggleErrors[srv.id].downloadUrl!}
                          className="ml-2 text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                        >
                          安装 {toggleErrors[srv.id].runtimeName ?? srv.command} <ExternalLinkIcon size={10} />
                        </ExternalLink>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-3 shrink-0">
                  {isToggling ? (
                    <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
                  ) : (
                    <ToggleSwitch
                      checked={isEnabled}
                      onChange={(v) => handleToggle(srv, v)}
                    />
                  )}
                  {srv.isBuiltin ? (
                    <>
                      {(srv.requiresConfig?.length || srv.id === 'playwright') && (
                        <button
                          onClick={() => openConfigDialog(srv)}
                          className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                          title="配置"
                        >
                          <SettingsIcon size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditMCP({ id: srv.id, name: srv.name, type: srv.type, command: srv.command, args: srv.args, env: srv.env, url: srv.url, headers: srv.headers })}
                        className="text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                        title="查看"
                      >
                        <Eye size={14} />
                      </button>
                    </>
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
        <ExternalLink href="https://mcp.so" className="text-[var(--accent)] hover:underline flex items-center gap-1">
          mcp.so <ExternalLinkIcon size={10} />
        </ExternalLink>
        <ExternalLink href="https://smithery.ai" className="text-[var(--accent)] hover:underline flex items-center gap-1">
          smithery.ai <ExternalLinkIcon size={10} />
        </ExternalLink>
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

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowJsonImport(false)}>
          <div className="w-[520px] rounded-2xl bg-[var(--paper)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--ink)]">JSON 批量导入</h3>
                <p className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">粘贴 Claude Desktop 或标准 MCP 配置 JSON</p>
              </div>
              <button onClick={() => setShowJsonImport(false)} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)]"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={'{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "some-mcp@latest"]\n    }\n  }\n}'}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-quaternary)] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button onClick={() => setShowJsonImport(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--surface)]">取消</button>
              <button onClick={handleJsonImport} disabled={!jsonInput.trim()} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">导入</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Dialog for MCP servers that require API keys */}
      {configDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfigDialog(null)}>
          <div className="w-[420px] rounded-2xl bg-[var(--paper)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--ink)]">配置 {configDialog.name}</h3>
                {configDialog.configHint && (
                  <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">{configDialog.configHint}</p>
                )}
              </div>
              <button onClick={() => setConfigDialog(null)} className="text-[var(--ink-tertiary)] hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {configDialog.requiresConfig?.map((key) => (
                <div key={key}>
                  <label className="block text-[13px] font-medium text-[var(--ink-secondary)] mb-1.5">{key}</label>
                  <input
                    type="password"
                    value={configEnvValues[key] ?? ''}
                    onChange={(e) => setConfigEnvValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`输入 ${key}`}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              ))}
              {configDialog.id === 'playwright' && (
                <div className="rounded-lg bg-[var(--surface)] p-3 space-y-2">
                  <p className="text-[13px] font-medium text-[var(--ink)]">常用启动参数</p>
                  <div className="space-y-1.5 text-[12px] text-[var(--ink-secondary)]">
                    <p><code className="bg-[var(--hover)] px-1 rounded">--headless</code> — 无头模式（不显示浏览器窗口）</p>
                    <p><code className="bg-[var(--hover)] px-1 rounded">--browser=firefox</code> — 使用 Firefox 浏览器</p>
                    <p><code className="bg-[var(--hover)] px-1 rounded">--browser=webkit</code> — 使用 WebKit 浏览器</p>
                  </div>
                  <p className="text-[11px] text-[var(--ink-tertiary)]">
                    如需添加额外参数，可点击旁边的查看按钮，通过 JSON 编辑模式修改 args 字段。
                  </p>
                </div>
              )}
              {configDialog.websiteUrl && (
                <ExternalLink
                  href={configDialog.websiteUrl}
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
                >
                  获取 API Key <ExternalLinkIcon size={10} />
                </ExternalLink>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setConfigDialog(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--hover)]"
              >
                {configDialog.requiresConfig?.length ? '取消' : '关闭'}
              </button>
              {!!configDialog.requiresConfig?.length && (
                <button
                  onClick={handleConfigSave}
                  disabled={configSaving || !configDialog.requiresConfig?.every((k) => configEnvValues[k])}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {configSaving ? '保存中...' : '保存并启用'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
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

  // Propagate proxy config to all running Sidecars via Rust command
  const propagateProxy = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cmd_propagate_proxy');
    } catch (e) {
      console.warn('[Settings] Failed to propagate proxy:', e);
    }
  }, []);

  const handleProxyToggle = useCallback(async (enabled: boolean) => {
    await updateConfig({
      proxySettings: {
        enabled,
        protocol: proxyForm.protocol,
        host: proxyForm.host,
        port: proxyForm.port,
      },
    });
    await propagateProxy();
  }, [updateConfig, proxyForm, propagateProxy]);

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
    await propagateProxy();
  }, [updateConfig, proxy.enabled, proxyForm, propagateProxy]);

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
            <p className="text-[12px] text-[var(--ink-tertiary)]">关闭窗口时最小化到系统托盘而非退出应用</p>
          </div>
          <ToggleSwitch
            checked={config.minimizeToTray ?? false}
            onChange={(v) => updateConfig({ minimizeToTray: v })}
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

      {/* 运行日志 */}
      <LogExportSection />
    </div>
  );
}

function LogExportSection() {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await globalApiGetJson<{ success: boolean; path?: string; error?: string }>('/api/logs/export');
      if (result.success && result.path) {
        setExportResult({ success: true, message: `已导出至 ${result.path}` });
      } else {
        setExportResult({ success: false, message: result.error || '导出失败' });
      }
    } catch {
      setExportResult({ success: false, message: '导出失败，请重试' });
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <p className="text-[15px] font-semibold text-[var(--ink)]">运行日志</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-[var(--ink)]">导出日志</p>
          <p className="text-[12px] text-[var(--ink-tertiary)]">导出近 3 天运行日志为 zip 保存到桌面</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className="animate-spin" />
              导出中...
            </span>
          ) : '导出'}
        </button>
      </div>
      {exportResult && (
        <p className={`text-[12px] ${exportResult.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {exportResult.message}
        </p>
      )}
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

  const handleOpenLink = useCallback((url: string) => {
    openExternal(url);
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
            <ExternalLinkIcon size={14} className="text-[var(--ink-tertiary)]" />
          </button>
          <button
            onClick={() => handleOpenLink('https://github.com/applre/SoAgents/issues')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
          >
            <span className="text-[13px] text-[var(--ink)]">反馈问题</span>
            <ExternalLinkIcon size={14} className="text-[var(--ink-tertiary)]" />
          </button>
          <button
            onClick={() => handleOpenLink('https://github.com/applre')}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
          >
            <span className="text-[13px] text-[var(--ink)]">Developer</span>
            <ExternalLinkIcon size={14} className="text-[var(--ink-tertiary)]" />
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
        {activeNav === 'usage'           && <UsageStatsPanel />}
        {activeNav === 'general'         && <GeneralTab />}
        {activeNav === 'about'           && <AboutTab checkForUpdate={checkForUpdate} checking={checking} />}
      </div>
    </div>
  );
}
