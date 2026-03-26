import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Send, X } from 'lucide-react';
import type { ChannelConfig } from '../../../../shared/types/imAgent';
import { verifyToken } from '../../../config/imAgentConfigService';

interface ChannelWizardProps {
  onComplete: (channel: ChannelConfig) => void;
  onCancel: () => void;
}

type VerifyState = 'idle' | 'loading' | 'valid' | 'invalid';

interface Platform {
  id: 'telegram' | 'feishu' | 'dingtalk';
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

const PLATFORMS: Platform[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    icon: <Send className="h-6 w-6" />,
    enabled: true,
  },
  {
    id: 'feishu',
    label: '飞书',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    enabled: false,
  },
  {
    id: 'dingtalk',
    label: '钉钉',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    enabled: false,
  },
];

export default function ChannelWizard({ onComplete, onCancel }: ChannelWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlatform, setSelectedPlatform] = useState<'telegram' | 'feishu' | 'dingtalk'>('telegram');
  const [token, setToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [botUsername, setBotUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePlatformSelect = (platform: Platform) => {
    if (!platform.enabled) return;
    setSelectedPlatform(platform.id);
    setStep(2);
  };

  const handleVerify = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setVerifyState('loading');
    setErrorMessage('');
    setBotUsername('');
    try {
      const username = await verifyToken(selectedPlatform, trimmed);
      setBotUsername(username);
      setVerifyState('valid');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Token 无效，请检查后重试');
      setVerifyState('invalid');
    }
  };

  const handleComplete = () => {
    if (verifyState !== 'valid') return;
    const newChannel: ChannelConfig = {
      id: crypto.randomUUID(),
      type: selectedPlatform,
      name: botUsername,
      enabled: true,
      botToken: token.trim(),
      telegramUseDraft: true,
      allowedUsers: [],
    };
    onComplete(newChannel);
  };

  const handleBack = () => {
    setStep(1);
    setToken('');
    setTokenVisible(false);
    setVerifyState('idle');
    setBotUsername('');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-2xl bg-[var(--paper)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[var(--ink)]">
            {step === 1 ? '添加频道' : '配置 Bot Token'}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-[var(--ink-tertiary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
              step === 1
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--success-bg)] text-[var(--success)]'
            }`}
          >
            {step === 1 ? '1' : <Check className="h-3.5 w-3.5" />}
          </div>
          <div className="h-px flex-1 bg-[var(--border)]" />
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
              step === 2
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-[var(--ink-tertiary)]'
            }`}
          >
            2
          </div>
        </div>

        {/* Step 1: Platform Select */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--ink-secondary)]">选择要接入的 IM 平台</p>
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformSelect(platform)}
                  disabled={!platform.enabled}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] p-4 text-center transition-colors ${
                    platform.enabled
                      ? 'cursor-pointer hover:bg-[var(--hover)]'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-[var(--ink-secondary)]">{platform.icon}</span>
                  <span className="text-[13px] font-medium text-[var(--ink)]">{platform.label}</span>
                  {!platform.enabled && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-tertiary)] border border-[var(--border)]">
                      即将推出
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Token Input */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-[14px] text-[var(--ink-secondary)]">
              前往 Telegram 的 @BotFather 创建 Bot 并获取 Token
            </p>

            {/* Token input row */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[var(--ink)]">Bot Token</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={tokenVisible ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (verifyState !== 'idle') {
                        setVerifyState('idle');
                        setBotUsername('');
                        setErrorMessage('');
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && token.trim() && handleVerify()}
                    placeholder="123456789:ABCDEfghij..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 pr-10 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTokenVisible(!tokenVisible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
                  >
                    {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Verify button */}
                <button
                  onClick={handleVerify}
                  disabled={!token.trim() || verifyState === 'loading'}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifyState === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  验证
                </button>
              </div>

              {/* Verification feedback */}
              {verifyState === 'valid' && botUsername && (
                <p className="flex items-center gap-1.5 text-[13px] text-[var(--success)]">
                  <Check className="h-3.5 w-3.5" />
                  验证成功：@{botUsername}
                </p>
              )}
              {verifyState === 'invalid' && (
                <p className="text-[13px] text-[var(--error)]">
                  {errorMessage || 'Token 无效，请检查后重试'}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleBack}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]"
              >
                返回
              </button>
              <button
                onClick={handleComplete}
                disabled={verifyState !== 'valid'}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
