import { useCallback, useState } from 'react';
import { useTabState } from '../context/TabContext';
import { useConfig } from '../context/ConfigContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import PermissionPrompt from '../components/PermissionPrompt';
import AskUserQuestionPrompt from '../components/AskUserQuestionPrompt';
import { ExitPlanModePrompt, EnterPlanModePrompt } from '../components/PlanModePrompt';
import UnifiedLogsPanel from '../components/UnifiedLogsPanel';
import QueuedMessagesPanel from '../components/QueuedMessagesPanel';
import WorkspaceSelector from '../components/WorkspaceSelector';

interface Props {
  agentDir: string;
  onAgentDirChange?: (agentDir: string) => void;
  injectText?: string | null;
  onInjectConsumed?: () => void;
  injectRefText?: string | null;
  onRefTextConsumed?: () => void;
  onOpenUrl?: (url: string) => void;
}

/* ── 工作区选择触发器（问候语下方的可点击工作区名） ── */
export function WorkspaceTrigger({ agentDir, onAgentDirChange }: { agentDir: string | null; onAgentDirChange?: (dir: string) => void }) {
  const { workspaces, touchWorkspace } = useConfig();
  const [showSelector, setShowSelector] = useState(false);

  const recentWorkspaces = [...workspaces].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  const dirName = (p: string) => p.split('/').filter(Boolean).pop() ?? p;

  const handleSelect = useCallback((dir: string) => {
    touchWorkspace(dir);
    setShowSelector(false);
    onAgentDirChange?.(dir);
  }, [touchWorkspace, onAgentDirChange]);

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        onClick={() => setShowSelector((v) => !v)}
        className="inline-flex items-baseline gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
      >
        <span className="text-[22px] font-medium text-[var(--ink)]">
          {agentDir ? dirName(agentDir) : '选择工作区'}
        </span>
        <span className="text-[12px] text-[var(--ink-tertiary)]">▾</span>
      </button>
      {showSelector && (
        <WorkspaceSelector
          workspaces={recentWorkspaces}
          selectedPath={agentDir}
          onSelect={handleSelect}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  );
}

export default function Chat({ agentDir, onAgentDirChange, injectText, onInjectConsumed, injectRefText, onRefTextConsumed, onOpenUrl }: Props) {
  const { messages, isLoading, sendMessage, stopResponse, pendingPermission, pendingQuestion, respondPermission, respondQuestion, pendingExitPlanMode, pendingEnterPlanMode, respondExitPlanMode, respondEnterPlanMode, unifiedLogs, clearUnifiedLogs, queuedMessages, cancelQueuedMessage, forceExecuteQueuedMessage } = useTabState();
  const { config } = useConfig();
  const [showLogs, setShowLogs] = useState(false);

  // 无消息时显示居中欢迎视图（含工作区选择器）
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col bg-[var(--paper)]">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full px-8" style={{ maxWidth: 660 }}>
            <div className="mb-6 text-center">
              <h1 className="text-[26px] font-semibold text-[var(--ink)]">👋 有什么可以帮你的？</h1>
              <div className="mt-2">
                <WorkspaceTrigger agentDir={agentDir} onAgentDirChange={onAgentDirChange} />
              </div>
            </div>
            {pendingQuestion && (
              <AskUserQuestionPrompt
                questions={pendingQuestion.questions}
                toolUseId={pendingQuestion.toolUseId}
                onRespond={(answers) => respondQuestion(pendingQuestion.toolUseId, answers)}
              />
            )}
            <ChatInput onSend={sendMessage} onStop={stopResponse} isLoading={isLoading} agentDir={agentDir} injectText={injectText} onInjectConsumed={onInjectConsumed} injectRefText={injectRefText} onRefTextConsumed={onRefTextConsumed} />
          </div>
        </div>
        {pendingPermission && (
          <PermissionPrompt
            toolName={pendingPermission.toolName}
            toolUseId={pendingPermission.toolUseId}
            toolInput={pendingPermission.toolInput}
            onRespond={(decision) => respondPermission(pendingPermission.toolUseId, decision)}
          />
        )}
        {pendingExitPlanMode && (
          <ExitPlanModePrompt requestId={pendingExitPlanMode.requestId} plan={pendingExitPlanMode.plan} onRespond={(approved) => respondExitPlanMode(pendingExitPlanMode.requestId, approved)} />
        )}
        {pendingEnterPlanMode && (
          <EnterPlanModePrompt requestId={pendingEnterPlanMode.requestId} onRespond={(approved) => respondEnterPlanMode(pendingEnterPlanMode.requestId, approved)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading} onOpenUrl={onOpenUrl} />
      {pendingQuestion && (
        <AskUserQuestionPrompt
          questions={pendingQuestion.questions}
          toolUseId={pendingQuestion.toolUseId}
          onRespond={(answers) => respondQuestion(pendingQuestion.toolUseId, answers)}
        />
      )}
      <QueuedMessagesPanel
        queuedMessages={queuedMessages}
        onCancel={(queueId) => cancelQueuedMessage(queueId)}
        onForceExecute={(queueId) => forceExecuteQueuedMessage(queueId)}
      />
      <div className="relative">
        <ChatInput
          onSend={sendMessage}
          onStop={stopResponse}
          isLoading={isLoading}
          agentDir={agentDir}
          injectText={injectText}
          onInjectConsumed={onInjectConsumed}
          injectRefText={injectRefText}
          onRefTextConsumed={onRefTextConsumed}
        />
        {/* 开发者模式: Logs 按钮 */}
        {config.showDevTools && (
          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className={`absolute right-3 bottom-2 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
              showLogs
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'text-[var(--ink-tertiary)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
            }`}
          >
            Logs
          </button>
        )}
      </div>
      {pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          toolUseId={pendingPermission.toolUseId}
          toolInput={pendingPermission.toolInput}
          onRespond={(decision) => respondPermission(pendingPermission.toolUseId, decision)}
        />
      )}
      {pendingExitPlanMode && (
        <ExitPlanModePrompt requestId={pendingExitPlanMode.requestId} plan={pendingExitPlanMode.plan} onRespond={(approved) => respondExitPlanMode(pendingExitPlanMode.requestId, approved)} />
      )}
      {pendingEnterPlanMode && (
        <EnterPlanModePrompt requestId={pendingEnterPlanMode.requestId} onRespond={(approved) => respondEnterPlanMode(pendingEnterPlanMode.requestId, approved)} />
      )}

      {/* 统一日志面板 */}
      <UnifiedLogsPanel
        sseLogs={unifiedLogs}
        isVisible={showLogs}
        onClose={() => setShowLogs(false)}
        onClearAll={clearUnifiedLogs}
      />
    </div>
  );
}
