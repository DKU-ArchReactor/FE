import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { ExecutionContext, ExecutionReference } from '@/type/assistant';
import { captureEditorSource, selectedEditorSource, type EditorSelection } from '@/pages/Main/utils/assistantSource';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';
import { contextAvailability, availableMemory, freezeExecutionContext } from '@/pages/Main/utils/assistantContext';
import { getAssistantStatus, isServiceNotice, streamChat, type AssistantStatus, type ChatMessage } from "@/api/assistant";

export interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  complete?: boolean;
  notice?: string;
  context?: ExecutionReference;
  requestedContext?: ExecutionContext;
  sourceInfo?: { language: 'c' | 'asm'; characters: number; label: string };
}

interface UseAssistantChatParams {
  isOpen: boolean;
  authenticated: boolean;
  simulation: SimulationResult | null;
  currentData: CycleHistoryItem | null;
  mode: "single" | "pipeline";
  beforeExecution: boolean;
  editorLanguage: 'c' | 'asm';
  editorContent: string;
  sourceSelection?: EditorSelection | null;
}

export function useAssistantChat({
  isOpen,
  authenticated,
  simulation,
  currentData,
  mode,
  beforeExecution,
  editorLanguage,
  editorContent,
  sourceSelection,
}: UseAssistantChatParams) {
  const [inputMessage, setInputMessage] = useState("");
  const [attachSource, setAttachSource] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedSource = selectedEditorSource(sourceSelection, editorLanguage, editorContent);
  const sourceContent = selectedSource?.content ?? editorContent;
  const sourceLabel = selectedSource
    ? `${editorLanguage.toUpperCase()} 코드 ${selectedSource.startLine}–${selectedSource.endLine}줄`
    : `${editorLanguage.toUpperCase()} 원문 전체`;

  useEffect(() => {
    if (selectedEditorSource(sourceSelection, editorLanguage, editorContent)) {
      setAttachSource(true);
    }
  }, [sourceSelection, editorLanguage, editorContent]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "코드와 실행 과정에서 궁금한 점을 물어보세요.",
      time: "방금 전",
    },
  ]);
  const [responsePhase, setResponsePhase] = useState<"waiting" | "receiving" | null>(null);
  const isThinking = responsePhase !== null;
  const requestRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusRevision, setStatusRevision] = useState(0);
  const [localError, setLocalError] = useState('');
  const [now, setNow] = useState(Date.now);

  const descriptor = simulation?.assistant_context;
  const scope = descriptor?.available ? `${mode}:${descriptor.execution_id}` : '';
  const [attachment, setAttachment] = useState({ scope: '', enabled: false, addresses: [] as number[] });

  useLayoutEffect(() => {
    setAttachment({ scope: '', enabled: false, addresses: [] });
    setLocalError('');
  }, [scope]);

  const attach = attachment.scope === scope && attachment.enabled;
  const addresses = attachment.scope === scope ? attachment.addresses : [];
  const unavailable = contextAvailability(simulation, currentData, mode, beforeExecution, now);
  const memory = availableMemory(currentData);
  const sourceUnsupported =
    attachSource &&
    Boolean(sourceContent.trim()) &&
    status?.enabled === true &&
    status.editor_source_supported !== true;
  const canSend = authenticated && status?.enabled === true && !isThinking;

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setStatus(null);
    setStatusError('');
    getAssistantStatus(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setStatus(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStatusError(error instanceof Error ? error.message : '연결 상태 확인에 실패했습니다.');
        }
      });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isOpen, statusRevision]);

  useEffect(() => {
    if (!isOpen) requestRef.current?.abort();
  }, [isOpen]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || requestRef.current || !canSend) return;
    setLocalError('');
    if (sourceUnsupported) return;

    let context: ExecutionContext | undefined;
    let editorSource;
    try {
      editorSource = captureEditorSource(
        attachSource,
        editorLanguage,
        sourceContent,
        status?.editor_source_supported === true
      );
      if (attach) {
        context = freezeExecutionContext(simulation, currentData, mode, beforeExecution, addresses);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '실행 정보를 확인해 주세요.');
      return;
    }
    if (text.length > 8000) return;

    const controller = new AbortController();
    requestRef.current = controller;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: '방금 전',
      complete: false,
      requestedContext: context,
      sourceInfo: editorSource
        ? {
            language: editorSource.language,
            characters: [...editorSource.content].length,
            label: sourceLabel,
          }
        : undefined,
    };
    const replyId = `ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: replyId,
        sender: 'ai',
        text: '',
        time: '방금 전',
        requestedContext: context,
      },
    ]);
    setInputMessage('');
    setResponsePhase("waiting");

    const updateReply = (change: (message: Message) => Message) => {
      setMessages((prev) => prev.map((message) => (message.id === replyId ? change(message) : message)));
    };
    let responseText = '';
    try {
      const history: ChatMessage[] = [
        ...messages.filter((m) => m.id !== 'welcome' && m.complete),
        userMsg,
      ].map((m) => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));

      await streamChat(
        history,
        controller.signal,
        (event) => {
          if (controller.signal.aborted) return;
          if (event.type === 'delta' && event.text) {
            setResponsePhase('receiving');
            responseText += event.text;
            updateReply((m) => ({ ...m, text: m.text + event.text }));
          }
          if (event.type === 'done') {
            const serviceNotice = isServiceNotice(responseText);
            const complete = event.stop_reason === 'end_turn' && !serviceNotice;
            setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, complete } : m)));
            updateReply((m) => ({
              ...m,
              complete,
              context: complete ? event.context : undefined,
              requestedContext: undefined,
              notice:
                event.stop_reason === 'max_tokens'
                  ? '답변 길이 한도에 도달했습니다. 이어서 질문해 주세요.'
                  : event.stop_reason !== 'end_turn'
                    ? '모델이 답변 생성을 종료했습니다.'
                    : serviceNotice
                      ? '질문을 구체적으로 바꿔 다시 입력할 수 있습니다.'
                      : undefined,
            }));
          }
        },
        context,
        editorSource
      );
    } catch (error) {
      const notice = controller.signal.aborted
        ? '답변 생성을 중단했습니다.'
        : error instanceof Error
          ? error.message
          : 'AI 요청에 실패했습니다.';
      updateReply((m) => ({ ...m, complete: false, notice, requestedContext: undefined }));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setResponsePhase(null);
      }
    }
  };

  return {
    inputMessage,
    setInputMessage,
    attachSource,
    setAttachSource,
    settingsOpen,
    setSettingsOpen,
    sourceContent,
    sourceLabel,
    messages,
    responsePhase,
    isThinking,
    requestRef,
    status,
    statusError,
    setStatusRevision,
    localError,
    setLocalError,
    scope,
    attachment,
    setAttachment,
    attach,
    addresses,
    unavailable,
    memory,
    sourceUnsupported,
    canSend,
    handleSendMessage,
  };
}
