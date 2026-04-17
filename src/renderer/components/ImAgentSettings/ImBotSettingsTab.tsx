/**
 * ImBotSettingsTab — 「设置 → 聊天机器人 Bot」tab 的容器
 *
 * 两种视图切换：
 *  - 列表视图：上半展示支持的平台（BotPlatformRegistry），下半列出已有 Agent 卡片（AgentCardList）
 *  - 详情视图：点击 Agent 卡片后进入 AgentSettingsPanel，编辑 Channels / Heartbeat / Memory
 */

import { useState } from 'react';
import BotPlatformRegistry from './BotPlatformRegistry';
import AgentCardList from './AgentCardList';
import AgentSettingsPanel from './AgentSettingsPanel';

export default function ImBotSettingsTab() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (selectedAgentId) {
    return (
      <AgentSettingsPanel
        agentId={selectedAgentId}
        onBack={() => setSelectedAgentId(null)}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* 上半：平台介绍 + 添加引导 */}
      <BotPlatformRegistry />

      {/* 下半：Agent 列表 */}
      <div className="border-t border-[var(--border)] pt-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--ink)]">我的 Agent</h3>
            <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
              点击 Agent 卡片进入 Channel 配置
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-[var(--ink-tertiary)]">
            在工作区「通用 → 主动 Agent 模式」可创建新的 Agent
          </span>
        </div>
        <AgentCardList onSelectAgent={(agentId) => setSelectedAgentId(agentId)} />
      </div>
    </div>
  );
}
