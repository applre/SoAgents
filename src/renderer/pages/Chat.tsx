import { useEffect, useState } from 'react';
import { TabProvider } from '../context/TabProvider';
import { useTabState } from '../context/TabContext';
import { useConfig } from '../context/ConfigContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import PermissionPrompt from '../components/PermissionPrompt';
import AskUserQuestionPrompt from '../components/AskUserQuestionPrompt';
import UnifiedLogsPanel from '../components/UnifiedLogsPanel';
import QueuedMessagesPanel from '../components/QueuedMessagesPanel';
import type { Tab } from '../types/tab';
import type { SessionMetadata } from '../../shared/types/session';

interface Props {
  tab: Tab;
  onSessionsChange?: (tabId: string, sessions: SessionMetadata[]) => void;
  onRunningSessionsChange?: (runningSessions: Set<string>) => void;
  onActiveSessionChange?: (sessionId: string | null) => void;
  onExposeReset?: (resetFn: () => Promise<void>) => void;
  onExposeDeleteSession?: (fn: (sessionId: string) => Promise<void>) => void;
  onExposeUpdateTitle?: (fn: (sessionId: string, title: string) => Promise<void>) => void;
  injectText?: string | null;
  onInjectConsumed?: () => void;
  onOpenUrl?: (url: string) => void;
}

interface ChatContentProps {
  agentDir: string;
  sessionId: string | null;
  onSessionsChange?: (tabId: string, sessions: SessionMetadata[]) => void;
  onActiveSessionChange?: (sessionId: string | null) => void;
  onExposeReset?: (resetFn: () => Promise<void>) => void;
  onExposeDeleteSession?: (fn: (sessionId: string) => Promise<void>) => void;
  onExposeUpdateTitle?: (fn: (sessionId: string, title: string) => Promise<void>) => void;
  injectText?: string | null;
  onInjectConsumed?: () => void;
  onOpenUrl?: (url: string) => void;
}

function ChatContent({ agentDir, sessionId, onSessionsChange, onActiveSessionChange, onExposeReset, onExposeDeleteSession, onExposeUpdateTitle, injectText, onInjectConsumed, onOpenUrl }: ChatContentProps) {
  const { tabId, messages, isLoading, sendMessage, stopResponse, pendingPermission, pendingQuestion, respondPermission, respondQuestion, sessions, sessionsFetched, loadSession, deleteSession, updateSessionTitle, resetSession, refreshSessions, sessionId: currentSessionId, sidecarReady, unifiedLogs, clearUnifiedLogs, queuedMessages, cancelQueuedMessage, forceExecuteQueuedMessage } = useTabState();
  const { config } = useConfig();
  const [showLogs, setShowLogs] = useState(false);

  // sidecar 就绪后拉取一次，确保左侧栏有数据
  useEffect(() => {
    if (sidecarReady) {
      refreshSessions().catch(console.error);
    }
  }, [sidecarReady, refreshSessions]);

  // 把 sessions 同步给 App（LeftSidebar 需要），仅在已完成至少一次 fetch 后才同步
  useEffect(() => {
    if (sessionsFetched) onSessionsChange?.(tabId, sessions);
  }, [sessions, sessionsFetched, onSessionsChange, tabId]);

  // 同步当前 session id 给 App
  // 守卫：当 tab 指定了目标 session 但尚未加载完成时，跳过同步，避免用旧值覆盖 activeSessionId
  useEffect(() => {
    if (sessionId && currentSessionId !== sessionId) return;
    onActiveSessionChange?.(currentSessionId);
  }, [currentSessionId, onActiveSessionChange, sessionId]);

  // 暴露 resetSession 给 App
  useEffect(() => {
    onExposeReset?.(resetSession);
  }, [resetSession, onExposeReset]);

  // 暴露 deleteSession / updateSessionTitle 给 App
  useEffect(() => {
    onExposeDeleteSession?.(deleteSession);
  }, [deleteSession, onExposeDeleteSession]);

  useEffect(() => {
    onExposeUpdateTitle?.(updateSessionTitle);
  }, [updateSessionTitle, onExposeUpdateTitle]);

  // 当 App 传入 sessionId 变化时，加载对应 session
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, currentSessionId, loadSession]);

  // 无消息时显示居中欢迎视图
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col bg-[var(--paper)]">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full px-8" style={{ maxWidth: 660 }}>
            <div className="mb-6 text-center">
              <h1 className="text-[26px] font-semibold text-[var(--ink)]">👋 有什么可以帮你的？</h1>
            </div>
            {pendingQuestion && (
              <AskUserQuestionPrompt
                questions={pendingQuestion.questions}
                toolUseId={pendingQuestion.toolUseId}
                onRespond={(answers) => respondQuestion(pendingQuestion.toolUseId, answers)}
              />
            )}
            <ChatInput onSend={sendMessage} onStop={stopResponse} isLoading={isLoading} agentDir={agentDir} injectText={injectText} onInjectConsumed={onInjectConsumed} />
          </div>
        </div>
        {pendingPermission && (
          <PermissionPrompt
            toolName={pendingPermission.toolName}
            toolUseId={pendingPermission.toolUseId}
            toolInput={pendingPermission.toolInput}
            onRespond={(allow) => respondPermission(pendingPermission.toolUseId, allow)}
          />
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
          onRespond={(allow) => respondPermission(pendingPermission.toolUseId, allow)}
        />
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

export default function Chat({ tab, onSessionsChange, onRunningSessionsChange, onActiveSessionChange, onExposeReset, onExposeDeleteSession, onExposeUpdateTitle, injectText, onInjectConsumed, onOpenUrl }: Props) {
  if (!tab.agentDir) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--ink-secondary)]">请先选择工作区</p>
      </div>
    );
  }

  return (
    <TabProvider tabId={tab.id} agentDir={tab.agentDir} onRunningSessionsChange={onRunningSessionsChange}>
      <ChatContent
        agentDir={tab.agentDir}
        sessionId={tab.sessionId}
        onSessionsChange={onSessionsChange}
        onActiveSessionChange={onActiveSessionChange}
        onExposeReset={onExposeReset}
        onExposeDeleteSession={onExposeDeleteSession}
        onExposeUpdateTitle={onExposeUpdateTitle}
        injectText={injectText}
        onInjectConsumed={onInjectConsumed}
        onOpenUrl={onOpenUrl}
      />
    </TabProvider>
  );
}
