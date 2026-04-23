import { useCallback, useEffect, useRef, useState } from 'react';
import { useTabState } from '../context/TabContext';
import { useConfig } from '../context/ConfigContext';
import { FileActionProvider } from '../context/FileActionContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import PermissionPrompt from '../components/PermissionPrompt';
import AskUserQuestionPrompt from '../components/AskUserQuestionPrompt';
import { ExitPlanModePrompt, EnterPlanModePrompt } from '../components/PlanModePrompt';
import UnifiedLogsPanel from '../components/UnifiedLogsPanel';
import WorkspaceSelector from '../components/WorkspaceSelector';
import ChatSearchPanel from '../components/ChatSearchPanel';
import QueryNavigator from '../components/chat/QueryNavigator';
import ConfirmDialog from '../components/ConfirmDialog';
import { useVirtuosoScroll } from '../hooks/useVirtuosoScroll';
import { useChatSearch } from '../hooks/useChatSearch';

interface Props {
  agentDir: string;
  onAgentDirChange?: (agentDir: string) => void;
  injectText?: string | null;
  onInjectConsumed?: () => void;
  injectRefText?: string | null;
  onRefTextConsumed?: () => void;
  onOpenUrl?: (url: string) => void;
  /** Called when user forks a message — parent (App.tsx) opens a new Tab. */
  onForkSession?: (newSessionId: string, agentDir: string, title: string) => void;
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
        <span className="text-[20px] font-medium text-[var(--ink)]">
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

export default function Chat({ agentDir, onAgentDirChange, injectText, onInjectConsumed, injectRefText, onRefTextConsumed, onOpenUrl: _onOpenUrl, onForkSession }: Props) {
  const { messages, historyMessages, streamingMessage, isLoading, sessionId, sendMessage, stopResponse, pendingPermission, pendingQuestion, respondPermission, respondQuestion, pendingExitPlanMode, pendingEnterPlanMode, respondExitPlanMode, respondEnterPlanMode, rewindToUserMessage, forkFromAssistantMessage, unifiedLogs, clearUnifiedLogs } = useTabState();
  const { config } = useConfig();
  const [showLogs, setShowLogs] = useState(false);

  // ── Shared scroll controls — owned by Chat so ChatSearch + QueryNavigator
  // can read scrollerRef + drive scrollToIndex from here.
  const scrollControls = useVirtuosoScroll();
  const { virtuosoRef, scrollerRef, pauseAutoScroll } = scrollControls;

  // ── In-page search (Cmd/Ctrl+F) ──
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const chatSearch = useChatSearch({ scrollerRef, active: chatSearchOpen });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setChatSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── QueryNavigator → scrollToIndex (virtuoso-aware jump) ──
  // Keep a ref to the latest messages so handleNavigateToQuery doesn't need
  // to be recreated on every streaming chunk.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Message Actions: Rewind / Retry / Fork ─────────────────────────
  // ConfirmDialog state 用 pending 保存即将执行的 action，用户点确认后触发。
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'rewind'; messageId: string }
    | { kind: 'retry'; assistantMessageId: string }
    | { kind: 'fork'; assistantMessageId: string }
    | null
  >(null);

  const executeRewind = useCallback(async (userMessageId: string) => {
    const result = await rewindToUserMessage(userMessageId);
    if (!result.success) {
      console.error('[rewind] failed:', result.error);
      // 失败不回滚 UI（后端可能已部分截断）— 靠 SSE chat:messages-truncated 修正
    }
    return result;
  }, [rewindToUserMessage]);

  const handleRewind = useCallback((userMessageId: string) => {
    setPendingAction({ kind: 'rewind', messageId: userMessageId });
  }, []);

  const handleRetry = useCallback((assistantMessageId: string) => {
    setPendingAction({ kind: 'retry', assistantMessageId });
  }, []);

  const handleFork = useCallback((assistantMessageId: string) => {
    setPendingAction({ kind: 'fork', assistantMessageId });
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.kind === 'rewind') {
      await executeRewind(action.messageId);
    } else if (action.kind === 'retry') {
      // Retry = 找前最近 user message → rewind → 自动重发
      const all = messagesRef.current;
      const aIdx = all.findIndex((m) => m.id === action.assistantMessageId);
      if (aIdx < 0) return;
      let userMsg = null;
      for (let i = aIdx - 1; i >= 0; i--) {
        if (all[i].role === 'user') { userMsg = all[i]; break; }
      }
      if (!userMsg) return;
      const content = userMsg.blocks.find((b) => b.type === 'text');
      if (!content || content.type !== 'text') return;
      const result = await executeRewind(userMsg.id);
      if (result.success) {
        // 截断成功后重发 — 沿用上次 providerEnv/model 等由 sendMessage 内部决定
        await sendMessage(content.text);
      }
    } else if (action.kind === 'fork') {
      const result = await forkFromAssistantMessage(action.assistantMessageId);
      if (result.success && result.newSessionId && result.agentDir && onForkSession) {
        onForkSession(result.newSessionId, result.agentDir, result.title ?? '🌿 分叉对话');
      } else if (!result.success) {
        console.error('[fork] failed:', result.error);
      }
    }
  }, [pendingAction, executeRewind, sendMessage, forkFromAssistantMessage, onForkSession]);

  // 动态生成 ConfirmDialog 的文案
  const pendingDialogContent = (() => {
    if (!pendingAction) return null;
    if (pendingAction.kind === 'rewind') {
      return { title: '回溯到此条？', message: '之后的所有对话和工作区文件改动将被撤销。此操作不可恢复。', danger: true };
    }
    if (pendingAction.kind === 'retry') {
      return { title: '重新生成？', message: '将回溯到上一条用户消息（撤销之后对话和文件改动），然后重新请求 AI。', danger: true };
    }
    return { title: '从此处分叉对话？', message: '将复制到此处的所有对话到新 Tab，源对话不变。', danger: false };
  })();
  const handleNavigateToQuery = useCallback(
    (messageId: string) => {
      const idx = messagesRef.current.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      pauseAutoScroll(2000);
      virtuosoRef.current?.scrollToIndex({ index: idx, behavior: 'smooth', align: 'start' });
    },
    [virtuosoRef, pauseAutoScroll],
  );

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
      <FileActionProvider refreshTrigger={historyMessages.length}>
        {/* flex flex-col 让 MessageList 内部的 flex-1 / Virtuoso h-full 能正常计算高度 */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            streamingMessage={streamingMessage}
            sessionId={sessionId}
            isStreaming={!!streamingMessage}
            scrollControls={scrollControls}
            onRewind={handleRewind}
            onRetry={handleRetry}
            onFork={handleFork}
          />
          {chatSearchOpen && (
            <ChatSearchPanel
              controller={chatSearch}
              onClose={() => setChatSearchOpen(false)}
            />
          )}
          <QueryNavigator
            historyMessages={historyMessages}
            streamingMessage={streamingMessage}
            scrollContainerRef={scrollerRef as React.RefObject<HTMLDivElement | null>}
            pauseAutoScroll={pauseAutoScroll}
            onNavigateToQuery={handleNavigateToQuery}
          />
        </div>
      </FileActionProvider>
      {pendingQuestion && (
        <AskUserQuestionPrompt
          questions={pendingQuestion.questions}
          toolUseId={pendingQuestion.toolUseId}
          onRespond={(answers) => respondQuestion(pendingQuestion.toolUseId, answers)}
        />
      )}
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

      {/* Rewind / Retry / Fork 二次确认 */}
      {pendingAction && pendingDialogContent && (
        <ConfirmDialog
          title={pendingDialogContent.title}
          message={pendingDialogContent.message}
          danger={pendingDialogContent.danger}
          confirmText={pendingAction.kind === 'fork' ? '分叉' : pendingAction.kind === 'retry' ? '重试' : '回溯'}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

    </div>
  );
}
