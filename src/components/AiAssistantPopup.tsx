import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 500;

export const AiAssistantPopup: React.FC<Props> = ({ isOpen, onClose, anchorRef }) => {
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
      text: "안녕하세요! ArchReactor AI 어시스턴트입니다. ✨\nC 소스 코드 번역, RISC-V 어셈블리 명령어, 5단계 파이프라인의 데이터 해저드나 스톨 원인에 대해 무엇이든 질문해 보세요!",
      time: "방금 전",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
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
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: "방금 전",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsThinking(true);

    setTimeout(() => {
      let replyText = "";
      const lower = text.toLowerCase();

      if (lower.includes("해저드") || lower.includes("스톨") || lower.includes("hazard") || lower.includes("stall")) {
        replyText =
          "⚡ [파이프라인 해저드 분석]\n5단계 파이프라인에서 직전 명령어가 메모리에서 값을 로드(lw)하고 바로 다음 명령어가 해당 레지스터를 참조하면 'Load-Use 데이터 해저드'가 발생하여 1사이클 스톨(버블)이 불가피합니다.\n\n해결 팁: 로드 명령어와 사용 명령어 사이에 독립적인 연산 명령어를 재배치하면 스톨 없이 100% 포워딩(Forwarding)으로 통과할 수 있습니다.";
      } else if (lower.includes("매핑") || lower.includes("번역") || lower.includes("c") || lower.includes("어셈블리")) {
        replyText =
          "📄 [C-어셈블리 매핑 안내]\n작성된 C 언어 코드는 GCC RV32IM 컴파일러를 통해 스택 기반 명령어로 변환됩니다. 상단 에디터에서 원하는 코드 줄을 클릭하시면 하단 Tutor 패널에 각 C 행에 정확히 대응되는 RISC-V 명령어 목록과 하드웨어 레지스터 동작이 실시간 표시됩니다.";
      } else if (lower.includes("스택") || lower.includes("메모리") || lower.includes("stack") || lower.includes("sp")) {
        replyText =
          "💾 [스택 프레임 구조]\n함수 호출 시 `addi sp, sp, -32`로 스택 포인터를 낮춰 프레임을 할당하고, 이전 프레임 포인터(`s0`)와 복귀 주소(`ra`)를 스택 상단에 저장합니다. 지역 변수는 `s0` 기준 마이너스 오프셋(예: -20(s0))에 기록되어 함수 종료 시 안전하게 정리됩니다.";
      } else if (lower.includes("cpi") || lower.includes("성능") || lower.includes("최적화")) {
        replyText =
          "📊 [CPI 및 파이프라인 최적화]\n이상적인 5-Stage 파이프라인의 CPI는 1.0입니다. 그러나 브랜치 미스예측(2 Flush)과 Load-Use 스톨(1 Stall)로 인해 실제 CPI는 1.2~1.5 수준이 됩니다. 루프 언롤링(Loop Unrolling)과 명령어 재배치 기법을 통해 CPI를 1.0에 근접하도록 단축할 수 있습니다.";
      } else {
        replyText = `💡 [AI 분석 답변]\n"${text}"에 관한 질문이 접수되었습니다. 현재 시뮬레이션 중인 RISC-V 32-bit 프로세서 아키텍처 관점에서 파이프라인 제어와 레지스터 상태를 연계하여 최적의 실행 흐름을 지원합니다. 추가적으로 궁금한 레지스터 번호나 명령어(예: addi, lw, bne)를 말씀해 주세요!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          time: "방금 전",
        },
      ]);
      setIsThinking(false);
    }, 600);
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
      className={`fixed z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl border select-none ${
        isDragging
          ? "shadow-blue-500/25 ring-2 ring-[#005FB8] dark:ring-[#007ACC]"
          : ""
      } ${
        !hasAnimated ? "ai-popup-drop-anim" : ""
      } bg-white dark:bg-[#1E1E1E] border-[#D0D7DE] dark:border-[#3E3E42] text-[#1F2328] dark:text-[#CCCCCC]`}
    >
      {/* 팝업 헤더 (드래그 핸들 역할) */}
      <header
        onMouseDown={startDrag}
        className={`shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-[#F6F8FA] dark:bg-[#252526] border-b border-[#E5E5E5] dark:border-[#3E3E42] cursor-grab active:cursor-grabbing transition-colors ${
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

      {/* 대화 본문 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#1E1E1E]">
        {/* 추천 질문 칩 바 */}
        <div className="shrink-0 p-2 bg-[#F8F9FA] dark:bg-[#1A1A1A] border-b border-[#E5E5E5] dark:border-[#333333] flex items-center gap-1.5 overflow-x-auto text-[11px] [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => handleSendMessage("현재 파이프라인 해저드 분석해줘")}
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
                {msg.text}
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
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#1E1E1E] text-xs text-[#1F2328] dark:text-[#CCCCCC] placeholder:text-[#8C959F] dark:placeholder:text-[#6E7681] focus:outline-none focus:border-[#005FB8] dark:focus:border-[#007ACC] focus:ring-1 focus:ring-[#005FB8] dark:focus:ring-[#007ACC] transition-colors"
            />
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
