import type { useAssistantCode } from '@/pages/Main/hooks/useAssistantCode';
import React from "react";
import type { EditorSelection } from '@/pages/Main/utils/assistantSource';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';
import {
  useFloatingWindow,
  getSiteHeaderBottom,
  MIN_POPUP_WIDTH,
  MIN_POPUP_HEIGHT,
} from "./AiAssistant/useFloatingWindow";
import { useAssistantChat } from "./AiAssistant/useAssistantChat";
import { AssistantMessageList } from "./AiAssistant/AssistantMessageList";

interface Props {
  codeEditor?: ReturnType<typeof useAssistantCode>;
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
  inline?: boolean;
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

export const AiAssistantPopup: React.FC<Props> = ({
  isOpen,
  onClose,
  anchorRef,
  inline = false,
  authenticated,
  simulation,
  currentData,
  mode,
  beforeExecution,
  editorLanguage = 'c',
  editorContent = '',
  sourceSelection,
  codeEditor,
}) => {
  const isSingle = mode === "single";

  const {
    size,
    position,
    isDragging,
    resizingDirection,
    isSmoothTransition,
    hasAnimated,
    setHasAnimated,
    getAnchorPosition,
    triggerSmoothChange,
    startDrag,
    startResize,
    handleHeaderDoubleClick,
  } = useFloatingWindow(isOpen, inline, anchorRef);

  const {
    autoApply,
    targetLanguage,
    applyProgram,
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
     setAttachment,
    attach,
    addresses,
    unavailable,
    memory,
    sourceUnsupported,
    canSend,
    handleSendMessage,
  } = useAssistantChat({
    isOpen,
    authenticated,
    simulation,
    currentData,
    mode,
    beforeExecution,
    editorLanguage,
    editorContent,
    sourceSelection,
    codeEditor,
  });

  if (!isOpen) return null;

  const curPos = position || getAnchorPosition();

  return (
    <div
      style={
        inline
          ? undefined
          : {
              left: `${curPos.x}px`,
              top: `${curPos.y}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
            }
      }
      onAnimationEnd={(e) => {
        if (!inline && e.target === e.currentTarget) {
          setHasAnimated(true);
        }
      }}
      className={
        inline
          ? "w-full h-full flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden select-none border border-[var(--ar-border)] shadow-sm bg-white text-[#1F2328]"
          : `hidden md:flex fixed z-50 flex-col rounded-xl select-none border-2 ${
              isSingle
                ? "border-[#005FB8]/40 shadow-[0_20px_50px_-12px_rgba(0,95,184,0.2),0_4px_16px_-2px_rgba(0,0,0,0.06)]"
                : "border-[#7C3AED]/40 shadow-[0_20px_50px_-12px_rgba(124,58,237,0.2),0_4px_16px_-2px_rgba(0,0,0,0.06)]"
            } ${
              isDragging || resizingDirection
                ? isSingle
                  ? "ring-2 ring-[#005FB8] shadow-[0_24px_56px_-4px_rgba(0,95,184,0.3)]"
                  : "ring-2 ring-[#7C3AED] shadow-[0_24px_56px_-4px_rgba(124,58,237,0.3)]"
                : ""
            } ${
              !hasAnimated ? "ai-popup-drop-anim" : ""
            } ${
              isSmoothTransition ? "transition-all duration-300 ease-out" : ""
            } bg-white text-[#1F2328]`
      }
    >
      {/* 테두리 리사이즈 핸들 (플로팅 모드 전용) */}
      {!inline && (
        <>
          <div
            onMouseDown={(e) => startResize(e, 'n')}
            className="absolute -top-1 left-3 right-3 h-2.5 cursor-ns-resize z-30"
            title="상단 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 's')}
            className="absolute -bottom-1 left-3 right-3 h-2.5 cursor-ns-resize z-30"
            title="하단 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'w')}
            className="absolute -left-1 top-3 bottom-3 w-2.5 cursor-ew-resize z-30"
            title="좌측 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'e')}
            className="absolute -right-1 top-3 bottom-3 w-2.5 cursor-ew-resize z-30"
            title="우측 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'nw')}
            className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nwse-resize z-40"
            title="대각선 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'ne')}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-nesw-resize z-40"
            title="대각선 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'sw')}
            className="absolute -bottom-1 -left-1 w-3.5 h-3.5 cursor-nesw-resize z-40"
            title="대각선 크기 조절"
          />
          <div
            onMouseDown={(e) => startResize(e, 'se')}
            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-nwse-resize z-40"
            title="대각선 크기 조절"
          />
          <div
            className="absolute bottom-1 right-1 w-3 h-3 z-20 flex items-end justify-end pointer-events-none"
            aria-hidden="true"
          >
            <svg className="w-2.5 h-2.5 text-gray-400 opacity-60" viewBox="0 0 6 6" fill="currentColor">
              <circle cx="5" cy="5" r="0.6" />
              <circle cx="3" cy="5" r="0.6" />
              <circle cx="5" cy="3" r="0.6" />
              <circle cx="1" cy="5" r="0.6" />
              <circle cx="3" cy="3" r="0.6" />
              <circle cx="5" cy="1" r="0.6" />
            </svg>
          </div>
        </>
      )}

      {/* 내부 콘텐츠 컨테이너 (모서리 곡률 유지) */}
      <div className={inline ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "flex-1 flex flex-col min-h-0 overflow-hidden rounded-[10px]"}>
        {/* 팝업/패널 헤더 */}
        <header
          onMouseDown={inline ? undefined : startDrag}
          onDoubleClick={handleHeaderDoubleClick}
          className={`shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-[#F6F8FA] border-b ${
            isSingle
              ? "border-[#005FB8]/15"
              : "border-[#7C3AED]/15"
          } ${inline ? "" : "cursor-grab active:cursor-grabbing"} transition-colors ${
            !inline && isDragging ? "bg-[#EAEAEA]" : ""
          }`}
          title={inline ? undefined : "드래그하여 이동 / 더블클릭하여 최대·최소 크기 전환"}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base shrink-0">✨</span>
            <div className="flex flex-col min-w-0 gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-xs font-bold text-[#1F2328] truncate">
                  ArchReactor AI 어시스턴트
                </h3>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isSingle ? "bg-[#005FB8]" : "bg-[#7C3AED]"
                } animate-pulse`} />
              </div>
              <span className="text-[10px] leading-normal text-[#8C959F] select-none font-sans tracking-tight">
                Powered by <strong className="italic font-bold text-[#0969DA]">DKU SOLID LLM</strong>
              </span>
            </div>
          </div>

          {!inline && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const siteHeaderBottom = getSiteHeaderBottom();
                  const topY = siteHeaderBottom + 8;
                  const maxW = Math.max(MIN_POPUP_WIDTH, window.innerWidth - 24);
                  const maxH = Math.max(MIN_POPUP_HEIGHT, window.innerHeight - topY - 12);
                  triggerSmoothChange(
                    { width: maxW, height: maxH },
                    { x: 12, y: topY }
                  );
                }}
                title="최대 크기로 확대"
                className={`w-5 h-5 flex items-center justify-center rounded text-[#57606A] ${
                  isSingle
                    ? "hover:text-[#005FB8]"
                    : "hover:text-[#7C3AED]"
                } hover:bg-black/5 transition-colors cursor-pointer text-xs`}
              >
                <svg className="w-3 h-3 text-current" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 4.5V1.5H4.5M10.5 4.5V1.5H7.5M1.5 7.5v3H4.5M10.5 7.5v3H7.5" />
                </svg>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSmoothChange(
                    { width: MIN_POPUP_WIDTH, height: MIN_POPUP_HEIGHT },
                    getAnchorPosition(MIN_POPUP_WIDTH, MIN_POPUP_HEIGHT)
                  );
                }}
                title="최소 크기로 축소"
                className={`w-5 h-5 flex items-center justify-center rounded text-[#57606A] ${
                  isSingle
                    ? "hover:text-[#005FB8]"
                    : "hover:text-[#7C3AED]"
                } hover:bg-black/5 transition-colors cursor-pointer text-xs`}
              >
                <svg className="w-3 h-3 text-current" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 1.5V4.5H1.5M7.5 1.5V4.5h3M4.5 10.5V7.5H1.5M7.5 10.5V7.5h3" />
                </svg>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                title="창 닫기"
                className="w-5 h-5 flex items-center justify-center rounded text-[#57606A] hover:text-[#CF222E] hover:bg-black/5 transition-colors cursor-pointer text-xs select-none"
              >
                <svg className="w-3 h-3 text-current" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* 대화 본문 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          {/* 추천 질문 칩 바 */}
          <div aria-label="추천 질문" tabIndex={0} className="shrink-0 min-w-0 p-2 bg-[#F8F9FA] border-b border-[#E5E5E5] flex flex-nowrap items-center gap-1.5 overflow-x-auto text-[11px]">
            {codeEditor && ['C', 'ASM'].map(language => (
              <button key={language} type="button" disabled={!canSend}
                onClick={() => setInputMessage(`반복문으로 1부터 10까지 합을 구하는 ${language} 예제를 만들어줘.`)}
                className="px-2 py-0.5 rounded-full border border-[#D0D7DE] dark:border-[#3E3E42] whitespace-nowrap shrink-0 disabled:opacity-50">
                ✍️ {language} 예제 생성
              </button>
            ))}
            {QUESTION_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                disabled={!canSend}
                onClick={() => setInputMessage(example.question + BRIEF_ANSWER_REQUEST)}
                title={example.question}
                className={`px-2 py-0.5 rounded-full border border-[#D0D7DE] bg-white ${
                  isSingle
                    ? 'hover:border-[#005FB8] hover:text-[#005FB8]'
                    : 'hover:border-[#7C3AED] hover:text-[#7C3AED]'
                } whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50`}
              >
                {example.label}
              </button>
            ))}
          </div>

          {/* 메시지 리스트 (memoized: 1초 주기 now 갱신 시 리렌더링 방지) */}
          <AssistantMessageList
            messages={messages}
            isSingle={isSingle}
            isThinking={isThinking}
            responsePhase={responsePhase}
            canSend={canSend}
            isOpen={isOpen}
            onRetryQuestion={setInputMessage}
            onApplyProgram={codeEditor ? applyProgram : undefined}
            codeApplyDisabled={codeEditor?.disabled ?? true}
          />

          {/* 하단 입력 폼 */}
          <footer className="shrink-0 p-2.5 bg-[#F6F8FA] border-t border-[#E5E5E5]">
          {codeEditor && (autoApply || codeEditor.canUndo) && <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            {codeEditor.canUndo && <button type="button" disabled={isThinking} className="underline disabled:opacity-40"
              onClick={codeEditor.undo}>코드 적용 되돌리기</button>}
            {autoApply && <p className="w-full text-[10px]">완성된 코드로 {targetLanguage.toUpperCase()} 영역 전체를 교체합니다. 적용 후 되돌릴 수 있습니다.</p>}
          </div>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
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
                className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#D0D7DE] bg-white text-xs text-[#1F2328] placeholder:text-[#8C959F] focus:outline-none ${
                  isSingle
                    ? "focus:border-[#005FB8] focus:ring-1 focus:ring-[#005FB8]"
                    : "focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]"
                } transition-colors`}
              />
              <button
                type={isThinking ? "button" : "submit"}
                aria-label={isThinking ? "중단" : "전송"}
                onClick={isThinking ? () => requestRef.current?.abort() : undefined}
                disabled={!isThinking && (!inputMessage.trim() || !canSend || sourceUnsupported)}
                className={`px-3 py-1.5 rounded-lg border ${
                  isThinking
                    ? "bg-white text-[#1F2328] border-[#D0D7DE] hover:bg-[#F3F4F6]"
                    : isSingle
                      ? "border-transparent bg-[#005FB8] hover:bg-[#004C99] text-white"
                      : "border-transparent bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                } text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 shrink-0`}
              >
                {isThinking ? (
                  <>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-xs bg-current" />
                    <span>중단</span>
                  </>
                ) : (
                  <>
                    <span>전송</span>
                    <span aria-hidden="true" className="text-[10px]">➤</span>
                  </>
                )}
              </button>
            </form>

            <div data-testid="attachment-bar" className="shrink-0 pt-2 mt-2 text-[11px] border-t border-[#E5E5E5] space-y-1.5 max-h-48 overflow-y-auto">
              <div className="flex items-center flex-wrap gap-1.5">
                {attachSource && sourceContent.trim() ? (
                  <button
                    type="button"
                    disabled={isThinking}
                    aria-label="코드 첨부 해제"
                    onClick={() => setAttachSource(false)}
                    className="rounded-full bg-blue-50 border border-blue-200 px-2 py-1 text-blue-700"
                  >
                    {sourceLabel} <span aria-hidden="true">×</span>
                  </button>
                ) : (
                  <span className="text-gray-500">코드 미첨부</span>
                )}
                {attach && currentData ? (
                  <button
                    type="button"
                    disabled={isThinking}
                    aria-label="실행 첨부 해제"
                    onClick={() => setAttachment({ scope, enabled: false, addresses: [] })}
                    className="rounded-full bg-blue-50 border border-blue-200 px-2 py-1 text-blue-700"
                  >
                    실행 · clock {currentData.clock} <span aria-hidden="true">×</span>
                  </button>
                ) : (
                  !unavailable && (
                    <button
                      type="button"
                      disabled={!authenticated || isThinking}
                      onClick={() => setAttachment({ scope, enabled: true, addresses: [] })}
                      className="rounded-full border border-dashed border-gray-400 px-2 py-1"
                    >
                      + 실행 · clock {currentData?.clock}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-expanded={settingsOpen}
                  aria-controls="assistant-attachment-settings"
                  onClick={() => setSettingsOpen((value) => !value)}
                  className="ml-auto text-[#57606A] hover:underline"
                >
                  첨부 설정 {settingsOpen ? '▴' : '▾'}
                </button>
              </div>
              <p className="text-[#57606A]">선택된 코드를 어시스턴트가 참고합니다.</p>
              {(!authenticated || statusError || !status?.enabled) && (
                <p role="status">
                  {!authenticated
                    ? '로그인 후 이용할 수 있습니다.'
                    : statusError || (!status ? 'AI 연결 확인 중…' : 'AI 연결 준비 중')}
                </p>
              )}
              {sourceUnsupported && <p role="status">원문 첨부 지원 대기 중입니다.</p>}
              {(statusError || status?.enabled === false || sourceUnsupported) && (
                <button type="button" onClick={() => setStatusRevision((v) => v + 1)} className="underline">
                  연결 다시 확인
                </button>
              )}
              {attach && unavailable && <p role="alert">{unavailable}</p>}
              <div id="assistant-attachment-settings" hidden={!settingsOpen} className="space-y-2 border-t border-gray-200 pt-2">
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={attachSource}
                    disabled={isThinking}
                    onChange={(e) => {
                      setAttachSource(e.target.checked);
                      setLocalError('');
                    }}
                  />
                  작성 중인 원문 자동 첨부
                </label>
                <p>
                  {attachSource
                    ? `${sourceLabel} · ${[...sourceContent].length.toLocaleString()}자 / 최대 12,000자`
                    : '원문 미첨부'}
                </p>
                {attach && !unavailable && (
                  <details>
                    <summary>메모리 선택 ({addresses.length}/16) · 기본 미전송</summary>
                    <select
                      multiple
                      aria-label="첨부할 메모리 주소"
                      size={3}
                      disabled={isThinking}
                      value={addresses.map(String)}
                      className="w-full bg-white"
                      onChange={(e) => {
                        const next = Array.from(e.currentTarget.selectedOptions, (option) => Number(option.value));
                        if (next.length > 16) {
                          setLocalError('메모리는 최대 16개 선택할 수 있습니다.');
                          return;
                        }
                        setLocalError('');
                        setAttachment({ scope, enabled: true, addresses: next });
                      }}
                    >
                      {memory.map((address) => (
                        <option key={address} value={address}>
                          0x{address.toString(16).padStart(8, '0')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isThinking}
                      className="underline"
                      onClick={() => setAttachment({ scope, enabled: true, addresses: [] })}
                    >
                      메모리 선택 해제
                    </button>
                    {addresses.some((address) => !memory.includes(address)) && (
                      <p>선택한 주소가 현재 사이클에 없습니다. 선택을 해제해 주세요.</p>
                    )}
                  </details>
                )}
              </div>
              {localError && <p role="alert">{localError}</p>}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default AiAssistantPopup;
