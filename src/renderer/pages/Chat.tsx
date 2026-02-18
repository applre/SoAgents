import { useEffect } from 'react';
import { TabProvider } from '../context/TabProvider';
import { useTabState } from '../context/TabContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import PermissionPrompt from '../components/PermissionPrompt';
import AskUserQuestionPrompt from '../components/AskUserQuestionPrompt';
import type { Tab } from '../types/tab';
import type { SessionMetadata } from '../types/session';

interface Props {
  tab: Tab;
  onSessionsChange?: (tabId: string, sessions: SessionMetadata[]) => void;
  onActiveSessionChange?: (sessionId: string | null) => void;
  onExposeReset?: (resetFn: () => Promise<void>) => void;
}

interface ChatContentProps {
  agentDir: string;
  sessionId: string | null;
  onSessionsChange?: (tabId: string, sessions: SessionMetadata[]) => void;
  onActiveSessionChange?: (sessionId: string | null) => void;
  onExposeReset?: (resetFn: () => Promise<void>) => void;
}

function ChatContent({ agentDir, sessionId, onSessionsChange, onActiveSessionChange, onExposeReset }: ChatContentProps) {
  const { tabId, messages, isLoading, sendMessage, stopResponse, pendingPermission, pendingQuestion, respondPermission, respondQuestion, sessions, sessionsFetched, loadSession, resetSession, refreshSessions, sessionId: currentSessionId } = useTabState();

  // mount 时主动拉取一次，确保左侧栏有数据
  useEffect(() => {
    refreshSessions().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 把 sessions 同步给 App（LeftSidebar 需要），仅在已完成至少一次 fetch 后才同步
  useEffect(() => {
    if (sessionsFetched) onSessionsChange?.(tabId, sessions);
  }, [sessions, sessionsFetched, onSessionsChange, tabId]);

  // 同步当前 session id 给 App
  useEffect(() => {
    onActiveSessionChange?.(currentSessionId);
  }, [currentSessionId, onActiveSessionChange]);

  // 暴露 resetSession 给 App
  useEffect(() => {
    onExposeReset?.(resetSession);
  }, [resetSession, onExposeReset]);

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
            <ChatInput onSend={sendMessage} onStop={stopResponse} isLoading={isLoading} />
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
        {pendingQuestion && (
          <AskUserQuestionPrompt
            question={pendingQuestion.question}
            options={pendingQuestion.options}
            toolUseId={pendingQuestion.toolUseId}
            onRespond={(response) => respondQuestion(pendingQuestion.toolUseId, response)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} />
      <ChatInput
        onSend={sendMessage}
        onStop={stopResponse}
        isLoading={isLoading}
      />
      {pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          toolUseId={pendingPermission.toolUseId}
          toolInput={pendingPermission.toolInput}
          onRespond={(allow) => respondPermission(pendingPermission.toolUseId, allow)}
        />
      )}
      {pendingQuestion && (
        <AskUserQuestionPrompt
          question={pendingQuestion.question}
          options={pendingQuestion.options}
          toolUseId={pendingQuestion.toolUseId}
          onRespond={(response) => respondQuestion(pendingQuestion.toolUseId, response)}
        />
      )}
    </div>
  );
}

export default function Chat({ tab, onSessionsChange, onActiveSessionChange, onExposeReset }: Props) {
  if (!tab.agentDir) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--ink-secondary)]">请先选择工作区</p>
      </div>
    );
  }

  return (
    <TabProvider tabId={tab.id} agentDir={tab.agentDir}>
      <ChatContent
        agentDir={tab.agentDir}
        sessionId={tab.sessionId}
        onSessionsChange={onSessionsChange}
        onActiveSessionChange={onActiveSessionChange}
        onExposeReset={onExposeReset}
      />
    </TabProvider>
  );
}
