import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { PROVIDERS } from '../types/config';
import {
  globalApiGetJson,
  globalApiPostJson,
  globalApiDeleteJson,
  globalApiPutJson,
} from '../api/apiFetch';

// ---- 类型定义 ----

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

type TabId = 'provider' | 'mcp' | 'skills';

// ---- Provider Tab ----

function ProviderTab() {
  const { config, currentProvider, updateConfig } = useConfig();
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>(config.apiKeys);
  const [saved, setSaved] = useState(false);

  const handleProviderSelect = async (providerId: string) => {
    await updateConfig({ currentProviderId: providerId });
    setSaved(false);
  };

  const handleApiKeyChange = (providerId: string, value: string) => {
    setApiKeyInputs((prev) => ({ ...prev, [providerId]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await updateConfig({ apiKeys: { ...config.apiKeys, ...apiKeyInputs } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      {/* Provider 选择 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
          AI Provider
        </h2>
        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleProviderSelect(provider.id)}
              className={`w-full rounded-md px-4 py-3 text-left text-sm transition-colors ${
                currentProvider.id === provider.id
                  ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)] text-[var(--ink)]'
                  : 'text-[var(--ink)] hover:bg-[var(--hover)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{provider.name}</span>
                <div className="flex items-center gap-2">
                  {provider.type === 'subscription' && (
                    <span className="text-xs text-[var(--ink-tertiary)]">Claude 订阅</span>
                  )}
                  {provider.primaryModel && (
                    <span className="text-xs font-mono text-[var(--ink-tertiary)]">{provider.primaryModel}</span>
                  )}
                  {currentProvider.id === provider.id && (
                    <span className="text-xs font-medium text-[var(--accent)]">✓</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* API Keys */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
          API Keys
        </h2>
        <div className="space-y-3">
          {PROVIDERS.filter((p) => p.type === 'api').map((provider) => (
            <div key={provider.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                {provider.name}
              </label>
              <input
                type="password"
                placeholder={`输入 ${provider.name} API Key`}
                value={apiKeyInputs[provider.id] ?? ''}
                onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
              {provider.baseUrl && (
                <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  端点：{provider.baseUrl}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 保存按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          保存
        </button>
        {saved && (
          <span className="text-sm text-green-500">已保存 ✓</span>
        )}
      </div>

      {/* 当前状态 */}
      <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">当前配置</h3>
        <div className="space-y-1 text-sm text-[var(--ink-tertiary)]">
          <div>Provider：<span className="text-[var(--ink)]">{currentProvider.name}</span></div>
          {currentProvider.type === 'api' && (
            <div>
              API Key：
              <span className="text-[var(--ink)]">
                {config.apiKeys[currentProvider.id]
                  ? `${config.apiKeys[currentProvider.id].slice(0, 6)}...`
                  : '未设置'}
              </span>
            </div>
          )}
          {currentProvider.type === 'subscription' && (
            <div className="text-[var(--ink)]">使用 Claude 订阅（无需 API Key）</div>
          )}
        </div>
      </div>
    </>
  );
}

// ---- MCP Tab ----

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
    } catch {
      // 加载失败时保持空状态
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServers();
  }, []);

  const handleAdd = async () => {
    if (!form.id.trim()) {
      setError('ID 不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const envObj: Record<string, string> = {};
      form.env.split('\n').forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });
      const argsArr = form.args
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      await globalApiPostJson('/api/mcp', {
        id: form.id.trim(),
        type: form.type,
        command: form.type === 'stdio' ? form.command : undefined,
        args: form.type === 'stdio' && argsArr.length > 0 ? argsArr : undefined,
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
        url: form.type !== 'stdio' ? form.url : undefined,
      });
      setForm(defaultMCPForm);
      await loadServers();
    } catch {
      setError('添加失败，请检查参数');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await globalApiDeleteJson(`/api/mcp/${id}`);
      await loadServers();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex gap-6">
      {/* 列表 */}
      <div className="flex-1 min-w-0">
        <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
          MCP Servers
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
        ) : Object.keys(servers).length === 0 ? (
          <p className="text-sm text-[var(--ink-tertiary)]">暂无 MCP Server</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(servers).map(([id, cfg]) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--ink)]">{id}</span>
                    <span className="text-xs rounded px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                      {cfg.type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">
                    {cfg.command ?? cfg.url ?? ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(id)}
                  className="ml-4 text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增表单 */}
      <div className="w-72 shrink-0">
        <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
          新增 Server
        </h2>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink)]">ID</label>
            <input
              type="text"
              placeholder="my-server"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink)]">类型</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MCPServerConfig['type'] }))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
          </div>

          {form.type === 'stdio' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Command</label>
                <input
                  type="text"
                  placeholder="node"
                  value={form.command}
                  onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Args（逗号分隔）</label>
                <input
                  type="text"
                  placeholder="server.js, --port, 3000"
                  value={form.args}
                  onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">URL</label>
              <input
                type="text"
                placeholder="http://localhost:3000/mcp"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Env（每行 KEY=VALUE）</label>
            <textarea
              rows={3}
              placeholder={"API_KEY=xxx\nDEBUG=true"}
              value={form.env}
              onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none resize-none"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '添加中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Skills Tab ----

const defaultSkillForm = {
  name: '',
  description: '',
  content: '',
  scope: 'global' as 'global' | 'project',
};

function SkillsTab() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillInfo | null>(null);
  const [form, setForm] = useState(defaultSkillForm);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSkills = async () => {
    try {
      const data = await globalApiGetJson<SkillInfo[]>('/api/skills');
      setSkills(data);
    } catch {
      // 加载失败保持空
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSkills();
  }, []);

  const handleSelect = (skill: SkillInfo) => {
    setSelected(skill);
    setIsNew(false);
    setForm({
      name: skill.name,
      description: skill.description,
      content: skill.rawContent,
      scope: skill.source,
    });
    setError('');
  };

  const handleNew = () => {
    setSelected(null);
    setIsNew(true);
    setForm(defaultSkillForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('名称不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await globalApiPostJson('/api/skills', {
          name: form.name.trim(),
          description: form.description,
          content: form.content,
          scope: form.scope,
        });
      } else if (selected) {
        await globalApiPutJson(`/api/skills/${selected.name}`, {
          name: form.name.trim(),
          description: form.description,
          content: form.content,
          scope: form.scope,
        });
      }
      await loadSkills();
      setIsNew(false);
      setSelected(null);
      setForm(defaultSkillForm);
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await globalApiDeleteJson(`/api/skills/${selected.name}?scope=${selected.source}`);
      await loadSkills();
      setSelected(null);
      setForm(defaultSkillForm);
    } catch {
      setError('删除失败');
    }
  };

  const showEditor = isNew || selected !== null;

  return (
    <div className="flex gap-6">
      {/* 列表 */}
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
            Skills
          </h2>
          <button
            onClick={handleNew}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            新建
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--ink-tertiary)]">加载中...</p>
        ) : skills.length === 0 ? (
          <p className="text-sm text-[var(--ink-tertiary)]">暂无 Skill</p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <button
                key={`${skill.source}:${skill.name}`}
                onClick={() => handleSelect(skill)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  selected?.name === skill.name && selected?.source === skill.source
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--ink)]">{skill.name}</span>
                  <span className={`text-xs rounded px-1.5 py-0.5 ${
                    skill.source === 'global'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-green-500/10 text-green-500'
                  }`}>
                    {skill.source === 'global' ? '全局' : '项目'}
                  </span>
                </div>
                {skill.description && (
                  <p className="mt-0.5 text-xs text-[var(--ink-tertiary)] truncate">{skill.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 编辑区 */}
      {showEditor && (
        <div className="w-80 shrink-0">
          <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)] uppercase tracking-wide">
            {isNew ? '新建 Skill' : '编辑 Skill'}
          </h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">名称</label>
              <input
                type="text"
                placeholder="my-skill"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">描述</label>
              <input
                type="text"
                placeholder="Skill 描述"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">内容（Markdown）</label>
              <textarea
                rows={10}
                placeholder="在此编写 Skill 内容..."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none resize-none font-mono"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink)]">范围</label>
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as 'global' | 'project' }))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="global">全局</option>
                <option value="project">项目</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              {!isNew && (
                <button
                  onClick={handleDelete}
                  className="rounded-md border border-red-400 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 主组件 ----

const TABS: { id: TabId; label: string }[] = [
  { id: 'provider', label: 'Provider' },
  { id: 'mcp', label: 'MCP' },
  { id: 'skills', label: 'Skills' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('provider');

  return (
    <div className="h-full overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-[var(--ink)]">设置</h1>

        {/* Tab 导航 */}
        <div className="mb-8 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink)] hover:bg-[var(--hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        {activeTab === 'provider' && <ProviderTab />}
        {activeTab === 'mcp' && <MCPTab />}
        {activeTab === 'skills' && <SkillsTab />}
      </div>
    </div>
  );
}
