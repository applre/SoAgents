import { TabProvider } from '../context/TabProvider';
import { useTabState } from '../context/TabContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import PermissionPrompt from '../components/PermissionPrompt';
import AskUserQuestionPrompt from '../components/AskUserQuestionPrompt';
import SessionHistoryDropdown from '../components/SessionHistoryDropdown';
import type { Tab } from '../types/tab';

interface Props {
  tab: Tab;
}

function ChatContent() {
  const { messages, isLoading, sendMessage, stopResponse, pendingPermission, pendingQuestion, respondPermission, respondQuestion } = useTabState();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-[var(--border)] bg-[var(--paper)] px-3 py-1">
        <SessionHistoryDropdown />
      </div>
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

export default function Chat({ tab }: Props) {
  if (!tab.agentDir) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--ink-secondary)]">请先选择工作区</p>
          <p className="mt-1 text-sm text-[var(--ink-tertiary)]">Phase 10 将实现 Launcher</p>
        </div>
      </div>
    );
  }

  return (
    <TabProvider tabId={tab.id} agentDir={tab.agentDir}>
      <ChatContent />
    </TabProvider>
  );
}
