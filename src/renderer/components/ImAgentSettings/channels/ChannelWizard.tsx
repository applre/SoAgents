import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Send } from 'lucide-react';
import type { ChannelConfig } from '../../../../shared/types/agentConfig';
import { verifyToken, verifyFeishuCredentials, verifyDingtalkCredentials } from '../../../config/agentConfigService';
import FeishuCredentialInput from './FeishuCredentialInput';
import DingtalkCredentialInput from './DingtalkCredentialInput';

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
    enabled: true,
  },
  {
    id: 'dingtalk',
    label: '钉钉',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    enabled: true,
  },
];

export default function ChannelWizard({ onComplete, onCancel: _onCancel }: ChannelWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlatform, setSelectedPlatform] = useState<'telegram' | 'feishu' | 'dingtalk'>('telegram');

  // Telegram state
  const [token, setToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');

  // Feishu state
  const [feishuAppId, setFeishuAppId] = useState('');
  const [feishuAppSecret, setFeishuAppSecret] = useState('');

  // DingTalk state
  const [dingtalkClientId, setDingtalkClientId] = useState('');
  const [dingtalkClientSecret, setDingtalkClientSecret] = useState('');

  // Verification
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [botUsername, setBotUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePlatformSelect = (platform: Platform) => {
    if (!platform.enabled) return;
    setSelectedPlatform(platform.id);
    setStep(2);
    setVerifyState('idle');
    setBotUsername('');
    setErrorMessage('');
  };

  const handleVerify = async () => {
    setVerifyState('loading');
    setErrorMessage('');
    setBotUsername('');
    try {
      let name: string;
      if (selectedPlatform === 'telegram') {
        const trimmed = token.trim();
        if (!trimmed) { setVerifyState('idle'); return; }
        name = await verifyToken('telegram', trimmed, proxyUrl || undefined);
      } else if (selectedPlatform === 'feishu') {
        if (!feishuAppId.trim() || !feishuAppSecret.trim()) { setVerifyState('idle'); return; }
        name = await verifyFeishuCredentials(feishuAppId.trim(), feishuAppSecret.trim());
      } else {
        if (!dingtalkClientId.trim() || !dingtalkClientSecret.trim()) { setVerifyState('idle'); return; }
        name = await verifyDingtalkCredentials(dingtalkClientId.trim(), dingtalkClientSecret.trim());
      }
      setBotUsername(name);
      setVerifyState('valid');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '验证失败，请检查凭证');
      setVerifyState('invalid');
    }
  };

  const canVerify = () => {
    if (selectedPlatform === 'telegram') return token.trim().length > 0;
    if (selectedPlatform === 'feishu') return feishuAppId.trim().length > 0 && feishuAppSecret.trim().length > 0;
    return dingtalkClientId.trim().length > 0 && dingtalkClientSecret.trim().length > 0;
  };

  const handleComplete = () => {
    if (verifyState !== 'valid') return;
    let newChannel: ChannelConfig;
    if (selectedPlatform === 'telegram') {
      newChannel = {
        id: crypto.randomUUID(),
        type: 'telegram',
        name: botUsername.replace('@', ''),
        enabled: true,
        botToken: token.trim(),
        telegramUseDraft: true,
        allowedUsers: [],
        proxyUrl: proxyUrl || undefined,
      };
    } else if (selectedPlatform === 'feishu') {
      newChannel = {
        id: crypto.randomUUID(),
        type: 'feishu',
        name: botUsername,
        enabled: true,
        feishuAppId: feishuAppId.trim(),
        feishuAppSecret: feishuAppSecret.trim(),
        allowedUsers: [],
        groupPermissions: [],
      };
    } else {
      newChannel = {
        id: crypto.randomUUID(),
        type: 'dingtalk',
        name: botUsername,
        enabled: true,
        dingtalkClientId: dingtalkClientId.trim(),
        dingtalkClientSecret: dingtalkClientSecret.trim(),
        allowedUsers: [],
        groupPermissions: [],
      };
    }
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

  const stepTitle = () => {
    if (step === 1) return '选择平台';
    if (selectedPlatform === 'telegram') return '配置 Bot Token';
    if (selectedPlatform === 'feishu') return '配置飞书应用';
    return '配置钉钉应用';
  };

  const stepDesc = () => {
    if (step === 1) return '选择要接入的 IM 平台';
    if (selectedPlatform === 'telegram') return '前往 Telegram 的 @BotFather 创建 Bot 并获取 Token';
    if (selectedPlatform === 'feishu') return '在飞书开放平台创建自建应用并获取凭证';
    return '在钉钉开放平台创建企业内部应用并获取凭证';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">{stepTitle()}</h2>
        <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">{stepDesc()}</p>
      </div>

      {/* Step 1: Platform Select */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformSelect(platform)}
                disabled={!platform.enabled}
                className="relative flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] p-4 text-center transition-colors cursor-pointer hover:bg-[var(--hover)]"
              >
                <span className="text-[var(--ink-secondary)]">{platform.icon}</span>
                <span className="text-[13px] font-medium text-[var(--ink)]">{platform.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Credentials */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Telegram */}
          {selectedPlatform === 'telegram' && (
            <>
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
                      onKeyDown={(e) => e.key === 'Enter' && token.trim() && void handleVerify()}
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
                  <button
                    onClick={() => void handleVerify()}
                    disabled={!token.trim() || verifyState === 'loading'}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {verifyState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    验证
                  </button>
                </div>
                {verifyState === 'valid' && botUsername && (
                  <p className="flex items-center gap-1.5 text-[13px] text-[var(--success)]">
                    <Check className="h-3.5 w-3.5" />
                    验证成功：{botUsername}
                  </p>
                )}
                {verifyState === 'invalid' && (
                  <p className="text-[13px] text-[var(--error)]">
                    {errorMessage || 'Token 无效，请检查后重试'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[var(--ink)]">
                  代理地址 <span className="font-normal text-[var(--ink-tertiary)]">(可选)</span>
                </label>
                <input
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://127.0.0.1:7890"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                />
                <p className="text-[12px] text-[var(--ink-tertiary)]">
                  中国大陆用户需设置代理才能连接 Telegram API
                </p>
              </div>
            </>
          )}

          {/* Feishu */}
          {selectedPlatform === 'feishu' && (
            <div className="space-y-4">
              <FeishuCredentialInput
                appId={feishuAppId}
                appSecret={feishuAppSecret}
                onAppIdChange={setFeishuAppId}
                onAppSecretChange={setFeishuAppSecret}
                verifyStatus={verifyState === 'loading' ? 'verifying' : verifyState === 'valid' ? 'valid' : verifyState === 'invalid' ? 'invalid' : 'idle'}
                botName={botUsername}
                showGuide={true}
              />
              <button
                onClick={() => void handleVerify()}
                disabled={!canVerify() || verifyState === 'loading'}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                验证凭证
              </button>
              {verifyState === 'invalid' && errorMessage && (
                <p className="text-[13px] text-[var(--error)]">{errorMessage}</p>
              )}
            </div>
          )}

          {/* DingTalk */}
          {selectedPlatform === 'dingtalk' && (
            <div className="space-y-4">
              <DingtalkCredentialInput
                clientId={dingtalkClientId}
                clientSecret={dingtalkClientSecret}
                onClientIdChange={setDingtalkClientId}
                onClientSecretChange={setDingtalkClientSecret}
                verifyStatus={verifyState === 'loading' ? 'verifying' : verifyState === 'valid' ? 'valid' : verifyState === 'invalid' ? 'invalid' : 'idle'}
                botName={botUsername}
                showGuide={true}
              />
              <button
                onClick={() => void handleVerify()}
                disabled={!canVerify() || verifyState === 'loading'}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                验证凭证
              </button>
              {verifyState === 'invalid' && errorMessage && (
                <p className="text-[13px] text-[var(--error)]">{errorMessage}</p>
              )}
            </div>
          )}

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
  );
}
