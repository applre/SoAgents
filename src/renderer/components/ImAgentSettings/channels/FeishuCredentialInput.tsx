import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';

interface FeishuCredentialInputProps {
  appId: string;
  appSecret: string;
  onAppIdChange: (value: string) => void;
  onAppSecretChange: (value: string) => void;
  verifyStatus: 'idle' | 'verifying' | 'valid' | 'invalid';
  botName?: string;
  showGuide?: boolean;
}

export default function FeishuCredentialInput({
  appId,
  appSecret,
  onAppIdChange,
  onAppSecretChange,
  verifyStatus,
  botName,
  showGuide = true,
}: FeishuCredentialInputProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [localAppId, setLocalAppId] = useState(appId);
  const [localAppSecret, setLocalAppSecret] = useState(appSecret);
  const debounceIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceSecretRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setLocalAppId(appId); }, [appId]);
  useEffect(() => { setLocalAppSecret(appSecret); }, [appSecret]);

  const handleAppIdChange = useCallback((value: string) => {
    setLocalAppId(value);
    if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
    debounceIdRef.current = setTimeout(() => onAppIdChange(value), 500);
  }, [onAppIdChange]);

  const handleAppSecretChange = useCallback((value: string) => {
    setLocalAppSecret(value);
    if (debounceSecretRef.current) clearTimeout(debounceSecretRef.current);
    debounceSecretRef.current = setTimeout(() => onAppSecretChange(value), 500);
  }, [onAppSecretChange]);

  useEffect(() => {
    return () => {
      if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
      if (debounceSecretRef.current) clearTimeout(debounceSecretRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* App ID */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-tertiary)]">
          App ID
        </label>
        <input
          type="text"
          value={localAppId}
          onChange={(e) => handleAppIdChange(e.target.value)}
          placeholder="cli_xxxxxxxxxx"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {/* App Secret */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-tertiary)]">
          App Secret
        </label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={localAppSecret}
            onChange={(e) => handleAppSecretChange(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 pr-9 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
          >
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Status */}
      {verifyStatus === 'valid' && botName && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          已验证: {botName}
        </div>
      )}
      {verifyStatus === 'invalid' && (
        <div className="text-[12px] text-[var(--error)]">
          凭证验证失败，请检查 App ID 和 App Secret
        </div>
      )}

      {/* Guide */}
      {showGuide && (
        <div className="rounded-lg bg-[var(--surface)] p-3">
          <p className="text-[12px] font-medium text-[var(--ink)]">如何获取飞书应用凭证？</p>
          <ol className="mt-2 space-y-1.5 text-[12px] text-[var(--ink-tertiary)]">
            <li>1. 登录
              <a
                href="https://open.feishu.cn/app"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-0.5 inline-flex items-center gap-0.5 text-[var(--accent)] hover:underline"
              >
                飞书开放平台<ExternalLink className="inline h-2.5 w-2.5" />
              </a>
              并创建自建应用
            </li>
            <li>2. 在「凭证与基础信息」页获取 App ID 和 App Secret</li>
            <li>3. 在「权限管理」中开启消息相关权限</li>
            <li>4. 发布应用版本后即可使用</li>
          </ol>
        </div>
      )}
    </div>
  );
}
