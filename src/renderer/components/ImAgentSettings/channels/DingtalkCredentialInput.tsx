import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';

interface DingtalkCredentialInputProps {
  clientId: string;
  clientSecret: string;
  onClientIdChange: (value: string) => void;
  onClientSecretChange: (value: string) => void;
  verifyStatus: 'idle' | 'verifying' | 'valid' | 'invalid';
  botName?: string;
  showGuide?: boolean;
}

export default function DingtalkCredentialInput({
  clientId,
  clientSecret,
  onClientIdChange,
  onClientSecretChange,
  verifyStatus,
  botName,
  showGuide = true,
}: DingtalkCredentialInputProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [localClientId, setLocalClientId] = useState(clientId);
  const [localClientSecret, setLocalClientSecret] = useState(clientSecret);
  const debounceIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceSecretRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setLocalClientId(clientId); }, [clientId]);
  useEffect(() => { setLocalClientSecret(clientSecret); }, [clientSecret]);

  const handleClientIdChange = useCallback((value: string) => {
    setLocalClientId(value);
    if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
    debounceIdRef.current = setTimeout(() => onClientIdChange(value), 500);
  }, [onClientIdChange]);

  const handleClientSecretChange = useCallback((value: string) => {
    setLocalClientSecret(value);
    if (debounceSecretRef.current) clearTimeout(debounceSecretRef.current);
    debounceSecretRef.current = setTimeout(() => onClientSecretChange(value), 500);
  }, [onClientSecretChange]);

  useEffect(() => {
    return () => {
      if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
      if (debounceSecretRef.current) clearTimeout(debounceSecretRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Client ID */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-tertiary)]">
          Client ID (AppKey)
        </label>
        <input
          type="text"
          value={localClientId}
          onChange={(e) => handleClientIdChange(e.target.value)}
          placeholder="dingxxxxxxxxxx"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {/* Client Secret */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-tertiary)]">
          Client Secret (AppSecret)
        </label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={localClientSecret}
            onChange={(e) => handleClientSecretChange(e.target.value)}
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
          {botName}
        </div>
      )}
      {verifyStatus === 'invalid' && (
        <div className="text-[12px] text-[var(--error)]">
          凭证验证失败，请检查 Client ID 和 Client Secret
        </div>
      )}

      {/* Guide */}
      {showGuide && (
        <div className="rounded-lg bg-[var(--surface)] p-3">
          <p className="text-[12px] font-medium text-[var(--ink)]">如何获取钉钉应用凭证？</p>
          <ol className="mt-2 space-y-1.5 text-[12px] text-[var(--ink-tertiary)]">
            <li>1. 登录
              <a
                href="https://open-dev.dingtalk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-0.5 inline-flex items-center gap-0.5 text-[var(--accent)] hover:underline"
              >
                钉钉开放平台<ExternalLink className="inline h-2.5 w-2.5" />
              </a>
              并创建企业内部应用
            </li>
            <li>2. 在「凭证与基础信息」页获取 Client ID 和 Client Secret</li>
            <li>3. 添加「机器人」能力，消息接收模式选「Stream 模式」</li>
            <li>4. 发布应用版本后即可使用</li>
          </ol>
        </div>
      )}
    </div>
  );
}
