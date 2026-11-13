import type { ExecutionContext, ExecutionReference } from '@/type/assistant';
import { captureEditorSource, selectedEditorSource, type EditorSelection } from '@/pages/Main/utils/assistantSource';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';
import { contextAvailability, availableMemory, freezeExecutionContext } from '@/pages/Main/utils/assistantContext';
import { getAssistantStatus, isServiceNotice, streamChat, type AssistantStatus, type ChatMessage } from "@/api/assistant";
import React, { lazy, Suspense, useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";

const AssistantMarkdown = lazy(() => import('./AssistantMarkdown').then(module => ({ default: module.AssistantMarkdown })));

interface Message {
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

interface Props {
  sourceSelection?: EditorSelection | null;
  editorLanguage?: 'c' | 'asm';
  editorContent?: string;
  authenticated: boolean;
  simulation: SimulationResult | null;
  currentData: CycleHistoryItem | null;
  mode: "single" | "pipeline";
  beforeExecution: boolean;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const BRIEF_ANSWER_REQUEST = ' 답변은 결론 한 문장과 핵심 근거 2~3개로, 500자 안팎으로 짧게 해줘. 표·전체 코드 재출력·반복 요약은 생략하고, 자료가 부족하면 필요한 자료만 한 문장으로 알려줘.';

const QUESTION_EXAMPLES = [
  { label: '📝 코드 설명', question: '첨부한 C 또는 RISC-V 코드의 동작과 흐름을 설명해줘. 선택한 부분만 첨부됐다면 그 범위만, 전체가 첨부됐다면 전체 흐름과 반환값·종료 조건을 설명해줘. 코드로 추론한 내용과 실제 실행 결과는 구분하고, 코드가 없으면 첨부를 요청해줘.' },
  { label: '🔗 C·ASM 매핑', question: 'C 코드의 연산과 제어 흐름이 RISC-V 명령어에 어떻게 대응하는지 설명해줘. 제공된 소스 매핑이 있으면 근거로 사용하고, 없으면 일반적인 변환 원리와 예시로 설명하되 실제 컴파일 결과의 매핑이라고 단정하지 마.' },
  { label: '🗃️ 레지스터 변화', question: '첨부한 RISC-V 명령어가 읽고 쓰는 레지스터와 변화 원리를 설명해줘. 실제 실행 상태가 있으면 그 값을 근거로 하고, 이전 값이나 명령어가 없으면 필요한 자료를 요청하고 결과값은 추측하지 마.' },
  { label: '🔀 분기·반복', question: '첨부한 코드의 분기와 반복 흐름, 종료 조건을 설명해줘. 실제로 선택된 분기나 반복 횟수는 실행 근거가 있을 때만 말하고, 선택 범위 밖의 코드가 필요하면 요청해줘.' },
  { label: '💾 스택 구조', question: 'RISC-V의 sp·s0와 스택 프레임 구조를 설명해줘. 첨부한 코드나 실행 상태에 근거가 있으면 연결해서 설명하고, 없으면 일반 원리로 설명하되 실제 주소·값·스택 배치를 만들어내지 마.' },
  { label: '⚡ 해저드 분석', question: '실행 정보가 첨부됐다면 해당 사이클의 스톨·포워딩·플러시 여부와 원인을 제공된 이벤트로 설명해줘. 실행 정보가 없다면 첨부 코드의 의존성과 해저드 발생 조건을, 코드도 없다면 일반 원리를 설명해줘. 발생 가능성과 실제 발생 사실은 구분해줘.' },
  { label: '📊 CPI 분석', question: '실행 정보가 첨부됐다면 누적 CPI와 계산에 사용된 사이클 수·완료 명령어 수, 근거가 있는 개선 가능성을 설명해줘. 실행 정보가 없으면 CPI(Cycles Per Instruction)의 계산 원리와 일반적인 개선 방법을 설명해줘. 없는 수치나 개선 효과는 추측하지 마.' },
  { label: '🔍 코드·실행 비교', question: '작성 중인 코드와 첨부 실행이 같은 코드인지 확인 가능한지 먼저 말하고, 확인되는 범위에서 실행 상태를 설명해줘. 코드나 실행 정보가 부족하면 필요한 자료를 요청하고, 코드가 비슷하다는 이유만으로 같은 실행이라고 단정하지 마.' },
];

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 500;

export const AiAssistantPopup: React.FC<Props> = ({ isOpen, onClose, anchorRef, authenticated, simulation, currentData, mode, beforeExecution, editorLanguage = 'c', editorContent = '', sourceSelection }) => {
  const isSingle = mode === "single";
  // 1. 위치 및 드래그 상태 관리
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // 첫 오픈 시에만 드롭 애니메이션을 실행하고, 드래그&드롭 등 이후 조작 시에는 재실행 방지
  const [hasAnimated, setHasAnimated] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });

  // 2. 대화 메시지 상태
  const [inputMessage, setInputMessage] = useState("");
  const [attachSource, setAttachSource] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedSource = selectedEditorSource(sourceSelection, editorLanguage, editorContent);
  const sourceContent = selectedSource?.content ?? editorContent;
  const sourceLabel = selectedSource
    ? `${editorLanguage.toUpperCase()} 코드 ${selectedSource.startLine}–${selectedSource.endLine}줄`
    : `${editorLanguage.toUpperCase()} 원문 전체`;
  useEffect(() => {
    if (selectedEditorSource(sourceSelection, editorLanguage, editorContent)) setAttachSource(true);
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
  useLayoutEffect(() => {
    setAttachment({ scope: '', enabled: false, addresses: [] });
    setLocalError('');
  }, [scope]);
  const [attachment, setAttachment] = useState({ scope: '', enabled: false, addresses: [] as number[] });
  const attach = attachment.scope === scope && attachment.enabled;
  const addresses = attachment.scope === scope ? attachment.addresses : [];
  const unavailable = contextAvailability(simulation, currentData, mode, beforeExecution, now);
  const memory = availableMemory(currentData);
  const sourceUnsupported = attachSource && Boolean(sourceContent.trim()) && status?.enabled === true && status.editor_source_supported !== true;
  const canSend = authenticated && status?.enabled === true && !isThinking;
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setStatus(null);
    setStatusError('');
    getAssistantStatus(controller.signal).then(value => { if (!controller.signal.aborted) setStatus(value); }).catch(error => {
      if (!controller.signal.aborted) setStatusError(error instanceof Error ? error.message : '연결 상태 확인에 실패했습니다.');
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [isOpen, statusRevision]);

  useEffect(() => {
    if (!isOpen) requestRef.current?.abort();
  }, [isOpen]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 버튼 바로 아래 기본 위치 계산 (버튼 오른쪽 정렬 & 바로 아래 8px)
  const getAnchorPosition = useCallback(() => {
    if (typeof window === "undefined") return { x: 100, y: 64 };
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const x = Math.max(12, Math.min(window.innerWidth - POPUP_WIDTH - 12, rect.right - POPUP_WIDTH));
      const y = Math.max(12, Math.min(window.innerHeight - POPUP_HEIGHT - 12, rect.bottom + 8));
      return { x, y };
    }
    const margin = 16;
    const x = Math.max(12, window.innerWidth - POPUP_WIDTH - margin);
    const y = 64;
    return { x, y };
  }, [anchorRef]);

  // 창이 닫힐 때는 애니메이션 상태 초기화, 열릴 때는 버튼 바로 아래 위치로 초기화
  useEffect(() => {
    if (!isOpen) {
      setHasAnimated(false);
    } else {
      setPosition(getAnchorPosition());
    }
  }, [isOpen, getAnchorPosition]);

  // 애니메이션 종료 fallback 타이머 (280ms CSS 애니메이션 완료 후 안전하게 hasAnimated=true 확정)
  useEffect(() => {
    if (isOpen && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasAnimated]);

  // 브라우저 리사이즈 시 화면 내 유지
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const maxX = Math.max(12, window.innerWidth - POPUP_WIDTH - 12);
        const maxY = Math.max(12, window.innerHeight - POPUP_HEIGHT - 12);
        return {
          x: Math.max(12, Math.min(maxX, prev.x)),
          y: Math.max(12, Math.min(maxY, prev.y)),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 드래그 시작 핸들러
  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    // 드래그가 시작되면 즉시 애니메이션 완료 상태로 처리하여 마우스를 놓을 때 바운스 방지
    setHasAnimated(true);

    const curPos = position || getAnchorPosition();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: curPos.x,
      posY: curPos.y,
    };
    setIsDragging(true);
  };

  // 전역 마우스 이동 & 마우스 업 이벤트 리스너
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(12, window.innerWidth - POPUP_WIDTH - 12);
      const maxY = Math.max(12, window.innerHeight - POPUP_HEIGHT - 12);

      const rawX = dragStartRef.current.posX + deltaX;
      const rawY = dragStartRef.current.posY + deltaY;

      setPosition({
        x: Math.max(12, Math.min(maxX, rawX)),
        y: Math.max(12, Math.min(maxY, rawY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // 대화 스크롤 하단 이동
  useEffect(() => {
    if (isOpen && messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // 메시지 전송
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || requestRef.current || !canSend) return;
    setLocalError('');
    // The attachment bar already explains unavailable source support.
    if (sourceUnsupported) return;
    let context: ExecutionContext | undefined;
    let editorSource;
    try {
      editorSource = captureEditorSource(attachSource, editorLanguage, sourceContent, status?.editor_source_supported === true);
      if (attach) context = freezeExecutionContext(simulation, currentData, mode, beforeExecution, addresses);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '실행 정보를 확인해 주세요.');
      return;
    }
    if (text.length > 8000) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const userMsg: Message = {
      id: `user-${Date.now()}`, sender: 'user', text, time: '방금 전', complete: false, requestedContext: context,
      sourceInfo: editorSource ? { language: editorSource.language, characters: [...editorSource.content].length, label: sourceLabel } : undefined,
    };
    const replyId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, {
      id: replyId, sender: 'ai', text: '', time: '방금 전', requestedContext: context,
    }]);
    setInputMessage('');
    setResponsePhase("waiting");
    const updateReply = (change: (message: Message) => Message) => {
      setMessages(prev => prev.map(message => message.id === replyId ? change(message) : message));
    };
    let responseText = '';
    try {
      const history: ChatMessage[] = [...messages.filter(m => m.id !== 'welcome' && m.complete), userMsg]
        .map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));
      await streamChat(history, controller.signal, event => {
        if (controller.signal.aborted) return;
        if (event.type === 'delta' && event.text) {
          setResponsePhase('receiving');
          responseText += event.text;
          updateReply(m => ({ ...m, text: m.text + event.text }));
        }
        if (event.type === 'done') {
          const serviceNotice = isServiceNotice(responseText);
          const complete = event.stop_reason === 'end_turn' && !serviceNotice;
          setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, complete } : m));
          updateReply(m => ({
          ...m, complete, context: complete ? event.context : undefined, requestedContext: undefined,
          notice: event.stop_reason === 'max_tokens' ? '답변 길이 한도에 도달했습니다. 이어서 질문해 주세요.'
            : event.stop_reason !== 'end_turn' ? '모델이 답변 생성을 종료했습니다.'
            : serviceNotice ? '질문을 구체적으로 바꿔 다시 입력할 수 있습니다.' : undefined,
          }));
        }
      }, context, editorSource);
    } catch (error) {
      const notice = controller.signal.aborted ? '답변 생성을 중단했습니다.'
        : error instanceof Error ? error.message : 'AI 요청에 실패했습니다.';
      updateReply(m => ({ ...m, complete: false, notice, requestedContext: undefined }));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setResponsePhase(null);
      }
    }
  };

  if (!isOpen) return null;

  const curPos = position || getAnchorPosition();

  // ========================================================
  // 이동 가능한 AI 어시스턴트 창 팝업
  // ========================================================
  return (
    <div
      style={{
        left: `${curPos.x}px`,
        top: `${curPos.y}px`,
        width: `${POPUP_WIDTH}px`,
        height: `${POPUP_HEIGHT}px`,
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) {
          setHasAnimated(true);
        }
      }}
      className={`fixed z-50 flex flex-col rounded-xl overflow-hidden select-none border-2 ${
        isSingle
          ? "border-[#005FB8]/40 dark:border-[#007ACC]/50 shadow-[0_20px_50px_-12px_rgba(0,95,184,0.2),0_4px_16px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-12px_rgba(0,122,204,0.35),0_4px_16px_-2px_rgba(0,0,0,0.5)]"
          : "border-[#7C3AED]/40 dark:border-[#A855F7]/50 shadow-[0_20px_50px_-12px_rgba(124,58,237,0.2),0_4px_16px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-12px_rgba(168,85,247,0.35),0_4px_16px_-2px_rgba(0,0,0,0.5)]"
      } ${
        isDragging
          ? isSingle
            ? "ring-2 ring-[#005FB8] dark:ring-[#007ACC] shadow-[0_24px_56px_-4px_rgba(0,95,184,0.3)]"
            : "ring-2 ring-[#7C3AED] dark:ring-[#A855F7] shadow-[0_24px_56px_-4px_rgba(124,58,237,0.3)]"
          : ""
      } ${
        !hasAnimated ? "ai-popup-drop-anim" : ""
      } bg-white dark:bg-[#1E1E1E] text-[#1F2328] dark:text-[#CCCCCC]`}
    >
      {/* 팝업 헤더 (드래그 핸들 역할 - 4면 균일 2px 테두리) */}
      <header
        onMouseDown={startDrag}
        className={`shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-[#F6F8FA] dark:bg-[#252526] border-b ${
          isSingle
            ? "border-[#005FB8]/15 dark:border-[#007ACC]/25"
            : "border-[#7C3AED]/15 dark:border-[#A855F7]/25"
        } cursor-grab active:cursor-grabbing transition-colors ${
          isDragging ? "bg-[#EAEAEA] dark:bg-[#2D2D2D]" : ""
        }`}
        title="드래그하여 원하는 위치로 이동할 수 있습니다."
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">✨</span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-[#1F2328] dark:text-[#CCCCCC] truncate">
                ArchReactor AI 어시스턴트
              </h3>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isSingle ? "bg-[#005FB8] dark:bg-[#007ACC]" : "bg-[#7C3AED] dark:bg-[#A855F7]"
              } animate-pulse`} />
            </div>
            <span className="text-[10px] text-[#57606A] dark:text-[#858585] truncate font-mono">
              헤더를 잡고 드래그하여 이동
            </span>
          </div>
        </div>

        {/* 우측 컨트롤 버튼 (버튼 아래 원위치 / 닫기) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 버튼 바로 아래로 원위치 복귀 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPosition(getAnchorPosition());
            }}
            title="버튼 바로 아래 기본 위치로 복귀"
            className={`p-1 rounded text-[#57606A] dark:text-[#858585] ${
              isSingle
                ? "hover:text-[#005FB8] dark:hover:text-[#007ACC]"
                : "hover:text-[#7C3AED] dark:hover:text-[#A855F7]"
            } hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs`}
          >
            ↺
          </button>

          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="창 닫기"
            className="p-1 rounded text-[#57606A] dark:text-[#858585] hover:text-[#CF222E] dark:hover:text-[#F85149] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-bold"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 대화 본문 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#1E1E1E]">
        {/* 추천 질문 칩 바 */}
        <div aria-label="추천 질문" tabIndex={0} className="shrink-0 min-w-0 p-2 bg-[#F8F9FA] dark:bg-[#1A1A1A] border-b border-[#E5E5E5] dark:border-[#333333] flex flex-nowrap items-center gap-1.5 overflow-x-auto text-[11px]">
          {QUESTION_EXAMPLES.map(example => (
            <button key={example.label} type="button" disabled={!canSend}
              onClick={() => setInputMessage(example.question + BRIEF_ANSWER_REQUEST)} title={example.question}
              className={`px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] ${
                isSingle
                  ? 'hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#007ACC]'
                  : 'hover:border-[#7C3AED] dark:hover:border-[#A855F7] hover:text-[#7C3AED] dark:hover:text-[#A855F7]'
              } whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50`}>
              {example.label}
            </button>
          ))}
        </div>

        {/* 메시지 리스트 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 select-text text-xs leading-relaxed">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-[#57606A] dark:text-[#858585] px-1">
                <span>{msg.sender === "user" ? "나" : "ArchReactor AI"}</span>
                <span>·</span>
                <span>{msg.time}</span>
              </div>
              <div
                className={`rounded-2xl px-3.5 py-2.5 min-w-0 max-w-[85%] break-words shadow-2xs ${
                  msg.sender === "user"
                    ? isSingle
                      ? "bg-[#005FB8] dark:bg-[#007ACC] text-white rounded-tr-none font-medium whitespace-pre-wrap"
                      : "bg-[#7C3AED] dark:bg-[#8B5CF6] text-white rounded-tr-none font-medium whitespace-pre-wrap"
                    : "bg-[#F3F4F6] dark:bg-[#2D2D2D] border border-[#E5E5E5] dark:border-[#3E3E42] text-[#1F2328] dark:text-[#CCCCCC] rounded-tl-none font-normal"
                }`}
              >
                {msg.sender === 'ai'
                  ? <Suspense fallback={<span className="whitespace-pre-wrap">{msg.text}</span>}><AssistantMarkdown text={msg.text} /></Suspense>
                  : msg.text}
                {msg.sender === 'user' && <p className="mt-1 text-[10px]" data-testid="question-context">
                  {msg.requestedContext
                    ? `실행 첨부 · ${msg.requestedContext.mode} · clock ${msg.requestedContext.cycle}`
                    : '실행 정보 미첨부'}
                </p>}
                {msg.sender === 'user' && <p className="mt-1 text-[10px]" data-testid="question-source">
                  {msg.sourceInfo ? `${msg.sourceInfo.label} 첨부 · ${msg.sourceInfo.characters.toLocaleString()}자` : '원문 미첨부'}
                </p>}
                {msg.sender === 'ai' && (msg.context || (isThinking && msg.requestedContext)) && <p data-testid="execution-badge" className="mt-2 text-[10px]" title={(msg.context || msg.requestedContext)!.execution_id}>
                  {msg.context ? '참고한 실행' : '요청한 실행'} {(msg.context || msg.requestedContext)!.execution_id.slice(0, 8)} · {(msg.context || msg.requestedContext)!.mode} · clock {(msg.context || msg.requestedContext)!.cycle} 기준 (0부터 시작)
                </p>}
                {msg.sender === 'user' && Boolean(msg.requestedContext?.memory_addresses.length) && <p className="mt-1 text-[10px]">선택 메모리: {msg.requestedContext!.memory_addresses.map(a => `0x${a.toString(16)}`).join(', ')}</p>}
                {msg.notice && msg.sender === 'ai' && <button type="button" disabled={!canSend} className="block mt-1 underline" onClick={() => { const index = messages.findIndex(m => m.id === msg.id); setInputMessage(messages[index - 1]?.text || ''); }}>질문 다시 입력</button>}
                {msg.notice && <p role="status" className="mt-1 text-[#57606A] dark:text-[#AAAAAA]">{msg.notice}</p>}
              </div>
            </div>
          ))}

          {/* AI 응답 대기 로딩 */}
          {isThinking && (
            <div role="status" aria-live="polite" data-testid="assistant-progress" className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F3F4F6] dark:bg-[#2D2D2D] border border-[#E5E5E5] dark:border-[#3E3E42] max-w-[140px]">
              <div className={`w-4 h-4 border-2 ${
                isSingle ? "border-[#005FB8] dark:border-[#007ACC]" : "border-[#7C3AED] dark:border-[#8B5CF6]"
              } border-t-transparent rounded-full animate-spin`} />
              <span className="text-[11px] text-[#57606A] dark:text-[#858585] font-medium animate-pulse">
                {responsePhase === 'waiting' ? '답변 준비 중…' : '답변 받는 중…'}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 하단 입력 폼 */}
        <footer className="shrink-0 p-2.5 bg-[#F6F8FA] dark:bg-[#252526] border-t border-[#E5E5E5] dark:border-[#3E3E42]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="C 코드나 파이프라인에 대해 질문하세요..."
              disabled={!canSend}
              maxLength={8000}
              className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#1E1E1E] text-xs text-[#1F2328] dark:text-[#CCCCCC] placeholder:text-[#8C959F] dark:placeholder:text-[#6E7681] focus:outline-none ${
                isSingle
                  ? "focus:border-[#005FB8] dark:focus:border-[#007ACC] focus:ring-1 focus:ring-[#005FB8] dark:focus:ring-[#007ACC]"
                  : "focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6]"
              } transition-colors`}
            />
            {isThinking && (
              <button type="button" onClick={() => requestRef.current?.abort()}
                className="px-2 py-1.5 text-xs cursor-pointer">중단</button>
            )}
            <button
              type="submit"
              aria-label="전송"
              aria-busy={isThinking}
              disabled={!inputMessage.trim() || !canSend || sourceUnsupported}
              className={`px-3 py-1.5 rounded-lg ${
                isSingle
                  ? "bg-[#005FB8] dark:bg-[#007ACC] hover:bg-[#004C99] dark:hover:bg-[#0062A3]"
                  : "bg-[#7C3AED] dark:bg-[#8B5CF6] hover:bg-[#6D28D9] dark:hover:bg-[#7C3AED]"
              } text-white text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 shrink-0`}
            >
              {isThinking ? <>
                <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-white/50 border-t-white animate-spin" />
                <span>응답 대기</span>
              </> : <><span>전송</span><span aria-hidden="true" className="text-[10px]">➤</span></>}
            </button>
          </form>
        <div data-testid="attachment-bar" className="shrink-0 pt-2 mt-2 text-[11px] border-t border-[#E5E5E5] dark:border-[#333333] space-y-1.5 max-h-48 overflow-y-auto">
          <div className="flex items-center flex-wrap gap-1.5">
            {attachSource && sourceContent.trim() ? <button type="button" disabled={isThinking} aria-label="코드 첨부 해제" onClick={() => setAttachSource(false)} className="rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-1 text-blue-700 dark:text-blue-200">{sourceLabel} <span aria-hidden="true">×</span></button> : <span className="text-gray-500">코드 미첨부</span>}
            {attach && currentData ? <button type="button" disabled={isThinking} aria-label="실행 첨부 해제" onClick={() => setAttachment({ scope, enabled: false, addresses: [] })} className="rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-1 text-blue-700 dark:text-blue-200">실행 · clock {currentData.clock} <span aria-hidden="true">×</span></button> : !unavailable && <button type="button" disabled={!authenticated || isThinking} onClick={() => setAttachment({ scope, enabled: true, addresses: [] })} className="rounded-full border border-dashed border-gray-400 px-2 py-1">+ 실행 · clock {currentData?.clock}</button>}
            <button type="button" aria-expanded={settingsOpen} aria-controls="assistant-attachment-settings" onClick={() => setSettingsOpen(value => !value)} className="ml-auto text-[#57606A] dark:text-gray-300 hover:underline">첨부 설정 {settingsOpen ? '▴' : '▾'}</button>
          </div>
          <p className="text-[#57606A] dark:text-gray-400">선택된 코드를 어시스턴트가 참고합니다.</p>
          {(!authenticated || statusError || !status?.enabled) && <p role="status">{!authenticated ? '로그인 후 이용할 수 있습니다.' : statusError || (!status ? 'AI 연결 확인 중…' : 'AI 연결 준비 중')}</p>}
          {sourceUnsupported && <p role="status">원문 첨부 지원 대기 중입니다.</p>}
          {(statusError || status?.enabled === false || (sourceUnsupported)) && <button type="button" onClick={() => setStatusRevision(v => v + 1)} className="underline">연결 다시 확인</button>}
          {attach && unavailable && <p role="alert">{unavailable}</p>}
          <div id="assistant-attachment-settings" hidden={!settingsOpen} className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          <label className="flex gap-2 items-center">
            <input type="checkbox" checked={attachSource} disabled={isThinking}
              onChange={e => { setAttachSource(e.target.checked); setLocalError(''); }} />
            작성 중인 원문 자동 첨부
          </label>
          <p>{attachSource
            ? `${sourceLabel} · ${[...sourceContent].length.toLocaleString()}자 / 최대 12,000자`
            : '원문 미첨부'}</p>
          {attach && !unavailable && <details>
            <summary>메모리 선택 ({addresses.length}/16) · 기본 미전송</summary>
            <select multiple aria-label="첨부할 메모리 주소" size={3} disabled={isThinking} value={addresses.map(String)} className="w-full bg-white dark:bg-[#252526]"
              onChange={e => {
                const next = Array.from(e.currentTarget.selectedOptions, option => Number(option.value));
                if (next.length > 16) { setLocalError('메모리는 최대 16개 선택할 수 있습니다.'); return; }
                setLocalError(''); setAttachment({ scope, enabled: true, addresses: next });
              }}>
              {memory.map(address => <option key={address} value={address}>0x{address.toString(16).padStart(8, '0')}</option>)}
            </select>
            <button type="button" disabled={isThinking} className="underline" onClick={() => setAttachment({ scope, enabled: true, addresses: [] })}>메모리 선택 해제</button>
            {addresses.some(address => !memory.includes(address)) && <p>선택한 주소가 현재 사이클에 없습니다. 선택을 해제해 주세요.</p>}
          </details>}
          </div>
          {localError && <p role="alert">{localError}</p>}
        </div>
        </footer>
      </div>
    </div>
  );
};

export default AiAssistantPopup;
