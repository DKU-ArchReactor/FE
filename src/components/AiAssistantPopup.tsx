import { streamChat, type ChatMessage, type ExecutionReference } from "@/api/assistant";
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  complete?: boolean;
  notice?: string;
  contextLabel?: string;
  scope?: string;
}

interface Props {
  execution?: ExecutionReference;
  contextKey?: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 500;

export const AiAssistantPopup: React.FC<Props> = ({ isOpen, onClose, anchorRef, execution, contextKey = "" }) => {
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "ArchReactor AI 어시스턴트입니다. 로그인 후 C 코드, RISC-V, 파이프라인에 대해 질문해 주세요.\n저장된 빌드를 실행한 뒤 선택 사이클을 포함해 질문할 수 있습니다. 그 외에는 질문에 적은 내용만 전달됩니다.",
      time: "방금 전",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const [includeExecution, setIncludeExecution] = useState(true);
  const scope = JSON.stringify([contextKey, includeExecution]);
  const cancelRequest = useCallback((notice: string) => {
    requestRef.current?.abort();
    requestRef.current = null;
    setIsThinking(false);
    setMessages(prev => prev.map(m => m.sender === 'ai' && m.id !== 'welcome' && !m.complete
      ? { ...m, notice } : m));
  }, []);
  useLayoutEffect(() => {
    cancelRequest('코드 또는 선택한 실행이 바뀌어 이전 답변을 중단했습니다.');
  }, [scope, cancelRequest]);
  useEffect(() => {
    if (!isOpen) cancelRequest('답변 생성을 중단했습니다.');
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

  // 창 열릴 때 화면 밖으로 벗어나지 않도록 좌표 보정
  useEffect(() => {
    if (isOpen && position) {
      const maxX = Math.max(12, window.innerWidth - POPUP_WIDTH - 12);
      const maxY = Math.max(12, window.innerHeight - POPUP_HEIGHT - 12);
      setPosition({
        x: Math.max(12, Math.min(maxX, position.x)),
        y: Math.max(12, Math.min(maxY, position.y)),
      });
    }
  }, [isOpen]);

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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // 메시지 전송
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || requestRef.current) return;
    if (text.length > 8000) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const userMsg: Message = {
      id: `user-${Date.now()}`, sender: 'user', text, time: '방금 전', complete: true, scope,
    };
    const replyId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, {
      id: replyId, sender: 'ai', text: '', time: '방금 전', scope,
      contextLabel: includeExecution && execution ? `선택 ${execution.cycle + 1}번째 기록 · 저장된 실행 분석` : '텍스트 질문',
    }]);
    setInputMessage('');
    setIsThinking(true);
    const updateReply = (change: (message: Message) => Message) => {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setMessages(prev => prev.map(message => message.id === replyId ? change(message) : message));
    };
    try {
      const history: ChatMessage[] = [...messages.filter(m => m.id !== 'welcome' && m.complete && m.scope === scope), userMsg]
        .map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));
      await streamChat(history, controller.signal, event => {
        if (event.type === 'delta') updateReply(m => ({ ...m, text: m.text + event.text }));
        if (event.type === 'done') updateReply(m => ({
          ...m, complete: ['end_turn', 'stop'].includes(event.stop_reason),
          notice: ['max_tokens', 'length'].includes(event.stop_reason) ? '답변 길이 한도에 도달했습니다. 이어서 질문해 주세요.'
            : !['end_turn', 'stop'].includes(event.stop_reason) ? '모델이 답변 생성을 종료했습니다.' : undefined,
        }));
      }, includeExecution ? execution : undefined);
    } catch (error) {
      const notice = controller.signal.aborted ? '답변 생성을 중단했습니다.'
        : error instanceof Error ? error.message : 'AI 요청에 실패했습니다.';
      updateReply(m => ({ ...m, complete: false, notice }));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setIsThinking(false); }
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
      className={`fixed z-50 flex flex-col rounded-xl overflow-hidden select-none border-2 border-[#005FB8]/40 dark:border-[#007ACC]/50 shadow-[0_20px_50px_-12px_rgba(0,95,184,0.2),0_4px_16px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-12px_rgba(0,122,204,0.35),0_4px_16px_-2px_rgba(0,0,0,0.5)] ${
        isDragging
          ? "ring-2 ring-[#005FB8] dark:ring-[#007ACC] shadow-[0_24px_56px_-4px_rgba(0,95,184,0.3)]"
          : ""
      } ${
        !hasAnimated ? "ai-popup-drop-anim" : ""
      } bg-white dark:bg-[#1E1E1E] text-[#1F2328] dark:text-[#CCCCCC]`}
    >
      {/* 팝업 헤더 (드래그 핸들 역할 - 4면 균일 2px 테두리) */}
      <header
        onMouseDown={startDrag}
        className={`shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-[#F6F8FA] dark:bg-[#252526] border-b border-[#005FB8]/15 dark:border-[#007ACC]/25 cursor-grab active:cursor-grabbing transition-colors ${
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
              <span className="w-1.5 h-1.5 rounded-full bg-[#005FB8] dark:bg-[#007ACC] animate-pulse" />
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
            className="p-1 rounded text-[#57606A] dark:text-[#858585] hover:text-[#005FB8] dark:hover:text-[#007ACC] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs"
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

      <div className="shrink-0 border-b border-[var(--ar-border)] px-3 py-2 text-[11px]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeExecution && !!execution}
          disabled={!execution} onChange={e => setIncludeExecution(e.target.checked)} />선택한 실행을 포함해 질문</label>
        <p className="mt-1 text-[var(--ar-text-muted)]">{execution
          ? `선택 ${execution.cycle + 1}번째 기록 · 현재 화면의 실행 결과를 서버에 보관한 자료로 분석합니다.`
          : '로그인 후 C 파일을 저장하고 다시 실행해 주세요. 보관된 실행이 없거나 만료되면 텍스트 질문만 가능합니다.'}</p>
      </div>
      {/* 대화 본문 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#1E1E1E]">
        {/* 추천 질문 칩 바 */}
        <div className="shrink-0 p-2 bg-[#F8F9FA] dark:bg-[#1A1A1A] border-b border-[#E5E5E5] dark:border-[#333333] flex items-center gap-1.5 overflow-x-auto text-[11px] [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => handleSendMessage("파이프라인 해저드의 종류와 원인을 설명해줘")}
            className="px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#007ACC] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            ⚡ 해저드 분석
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("C 코드와 어셈블리 매핑 원리 알려줘")}
            className="px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#007ACC] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            📄 C·ASM 매핑
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("스택 프레임(sp/s0) 구조 설명해줘")}
            className="px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#007ACC] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            💾 스택 구조
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("CPI 성능 개선 팁 알려줘")}
            className="px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#007ACC] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            📊 CPI 최적화
          </button>
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
                className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap break-words shadow-2xs ${
                  msg.sender === "user"
                    ? "bg-[#005FB8] dark:bg-[#007ACC] text-white rounded-tr-none font-medium"
                    : "bg-[#F3F4F6] dark:bg-[#2D2D2D] border border-[#E5E5E5] dark:border-[#3E3E42] text-[#1F2328] dark:text-[#CCCCCC] rounded-tl-none font-normal"
                }`}
              >
                {msg.contextLabel && <p className="mb-1 text-[10px] text-blue-600 dark:text-blue-300">{msg.contextLabel}</p>}
                {msg.text}
                {msg.notice && <p role="status" className="mt-1 text-[#57606A] dark:text-[#AAAAAA]">{msg.notice}</p>}
              </div>
            </div>
          ))}

          {/* AI 응답 대기 로딩 */}
          {isThinking && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F3F4F6] dark:bg-[#2D2D2D] border border-[#E5E5E5] dark:border-[#3E3E42] max-w-[140px]">
              <div className="w-4 h-4 border-2 border-[#005FB8] dark:border-[#007ACC] border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] text-[#57606A] dark:text-[#858585] font-medium animate-pulse">
                답변 분석 중...
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
              disabled={isThinking}
              maxLength={8000}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#1E1E1E] text-xs text-[#1F2328] dark:text-[#CCCCCC] placeholder:text-[#8C959F] dark:placeholder:text-[#6E7681] focus:outline-none focus:border-[#005FB8] dark:focus:border-[#007ACC] focus:ring-1 focus:ring-[#005FB8] dark:focus:ring-[#007ACC] transition-colors"
            />
            {isThinking && (
              <button type="button" onClick={() => cancelRequest('답변 생성을 중단했습니다.')}
                className="px-2 py-1.5 text-xs cursor-pointer">중단</button>
            )}
            <button
              type="submit"
              disabled={!inputMessage.trim() || isThinking}
              className="px-3 py-1.5 rounded-lg bg-[#005FB8] dark:bg-[#007ACC] hover:bg-[#004C99] dark:hover:bg-[#0062A3] text-white text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 shrink-0"
            >
              <span>전송</span>
              <span className="text-[10px]">➤</span>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};

export default AiAssistantPopup;
