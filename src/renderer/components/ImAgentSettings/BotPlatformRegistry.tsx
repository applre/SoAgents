/**
 * BotPlatformRegistry — "聊天机器人 Bot" section in Settings
 *
 * Shows supported IM platforms and a step-by-step guide for adding bots.
 * Telegram / Feishu / DingTalk are all supported; configuration goes through
 * the Agent → Channels flow (either in this Settings tab or in the workspace
 * General Tab).
 */

import { Send } from 'lucide-react';
import { Tag } from '../Tag';
import type { TagTone } from '../Tag';

interface PlatformEntry {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  badgeTone: TagTone;
  enabled: boolean;
}

const PLATFORMS: PlatformEntry[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: '通过 Telegram Bot 远程使用 AI Agent',
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0088cc]">
        <Send className="h-6 w-6 text-white" />
      </div>
    ),
    badge: '内置',
    badgeTone: 'info',
    enabled: true,
  },
  {
    id: 'feishu',
    name: '飞书',
    description: '通过飞书自建应用 Bot 远程使用 AI Agent',
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3370FF]">
        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    ),
    badge: '已支持',
    badgeTone: 'success',
    enabled: true,
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    description: '通过钉钉自建应用 Bot 远程使用 AI Agent',
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0089FF]">
        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
    ),
    badge: '已支持',
    badgeTone: 'success',
    enabled: true,
  },
];

const GUIDE_STEPS = [
  '在启动页找到目标工作区，hover 出现设置按钮，点击进入 Agent 设置',
  '在「通用」Tab 找到「主动 Agent 模式」，打开开关',
  '开启后出现「聊天机器人 Channels」，点击「+ 添加」选择平台并配置凭证',
];

export default function BotPlatformRegistry() {
  return (
    <div className="space-y-10">
      {/* Section 1: Supported Platforms */}
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">聊天机器人 Bot</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
          以下平台可作为 Agent 的聊天渠道接入，让 AI Agent 通过即时通讯与你互动
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5 ${
                !p.enabled ? 'opacity-60' : ''
              }`}
            >
              {p.icon}
              <div className="text-center">
                <p className="text-[14px] font-medium text-[var(--ink)]">{p.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--ink-tertiary)]">{p.description}</p>
              </div>
              <Tag variant="attribute" tone={p.enabled ? p.badgeTone : 'neutral'}>
                {p.badge}
              </Tag>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: How to add bots */}
      <div>
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">如何添加聊天机器人</h3>
        <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
          聊天机器人以渠道（Channel）的方式挂载在 Agent 上，以下是添加方式
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-5">
          <h4 className="text-[14px] font-semibold text-[var(--ink)]">
            将已有工作区升级为主动型 Agent
          </h4>
          <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
            适合已经有项目文件夹、想为其增加 IM 聊天能力的场景
          </p>
          <div className="mt-4 space-y-3">
            {GUIDE_STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-[13px] text-[var(--ink-secondary)]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
