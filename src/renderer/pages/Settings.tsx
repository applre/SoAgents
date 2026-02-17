import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { PROVIDERS } from '../types/config';

export default function Settings() {
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
    <div className="h-full overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-[var(--ink)]">设置</h1>

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
      </div>
    </div>
  );
}
