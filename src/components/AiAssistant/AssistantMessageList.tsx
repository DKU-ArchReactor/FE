import React, { lazy, memo, Suspense, useEffect, useRef } from "react";
import type { Message } from "./useAssistantChat";

const AssistantMarkdown = lazy(() =>
  import("../AssistantMarkdown").then((module) => ({ default: module.AssistantMarkdown }))
);

interface AssistantMessageListProps {
  messages: Message[];
  isSingle: boolean;
  isThinking: boolean;
  responsePhase: "waiting" | "receiving" | null;
  canSend: boolean;
  isOpen: boolean;
  onRetryQuestion: (text: string) => void;
}

export const AssistantMessageList: React.FC<AssistantMessageListProps> = memo(
  ({ messages, isSingle, isThinking, responsePhase, canSend, isOpen, onRetryQuestion }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isOpen && messages.length > 1) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [messages, isThinking, isOpen]);

    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 select-text text-xs leading-relaxed">
        {messages.map((msg, index) => (
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
              {msg.sender === "ai" ? (
                <Suspense fallback={<span className="whitespace-pre-wrap">{msg.text}</span>}>
                  <AssistantMarkdown text={msg.text} />
                </Suspense>
              ) : (
                msg.text
              )}
              {msg.sender === "user" && (
                <p className="mt-1 text-[10px]" data-testid="question-context">
                  {msg.requestedContext
                    ? `실행 첨부 · ${msg.requestedContext.mode} · clock ${msg.requestedContext.cycle}`
                    : "실행 정보 미첨부"}
                </p>
              )}
              {msg.sender === "user" && (
                <p className="mt-1 text-[10px]" data-testid="question-source">
                  {msg.sourceInfo
                    ? `${msg.sourceInfo.label} 첨부 · ${msg.sourceInfo.characters.toLocaleString()}자`
                    : "원문 미첨부"}
                </p>
              )}
              {msg.sender === "ai" && (msg.context || (isThinking && msg.requestedContext)) && (
                <p
                  data-testid="execution-badge"
                  className="mt-2 text-[10px]"
                  title={(msg.context || msg.requestedContext)!.execution_id}
                >
                  {msg.context ? "참고한 실행" : "요청한 실행"}{" "}
                  {(msg.context || msg.requestedContext)!.execution_id.slice(0, 8)} ·{" "}
                  {(msg.context || msg.requestedContext)!.mode} · clock{" "}
                  {(msg.context || msg.requestedContext)!.cycle} 기준 (0부터 시작)
                </p>
              )}
              {msg.sender === "user" && Boolean(msg.requestedContext?.memory_addresses.length) && (
                <p className="mt-1 text-[10px]">
                  선택 메모리:{" "}
                  {msg.requestedContext!.memory_addresses.map((a) => `0x${a.toString(16)}`).join(", ")}
                </p>
              )}
              {msg.notice && msg.sender === "ai" && (
                <button
                  type="button"
                  disabled={!canSend}
                  className="block mt-1 underline"
                  onClick={() => onRetryQuestion(messages[index - 1]?.text || "")}
                >
                  질문 다시 입력
                </button>
              )}
              {msg.notice && (
                <p role="status" className="mt-1 text-[#57606A] dark:text-[#AAAAAA]">
                  {msg.notice}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* AI 응답 대기 로딩 */}
        {isThinking && (
          <div
            role="status"
            aria-live="polite"
            data-testid="assistant-progress"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F3F4F6] dark:bg-[#2D2D2D] border border-[#E5E5E5] dark:border-[#3E3E42] max-w-[140px]"
          >
            <div
              className={`w-4 h-4 border-2 ${
                isSingle ? "border-[#005FB8] dark:border-[#007ACC]" : "border-[#7C3AED] dark:border-[#8B5CF6]"
              } border-t-transparent rounded-full animate-spin`}
            />
            <span className="text-[11px] text-[#57606A] dark:text-[#858585] font-medium animate-pulse">
              {responsePhase === "waiting" ? "답변 준비 중…" : "답변 받는 중…"}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  }
);
