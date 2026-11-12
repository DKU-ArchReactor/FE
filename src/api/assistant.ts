import type { EditorSource, ExecutionContext, ExecutionReference } from "@/type/assistant";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      stop_reason: string;
      usage?: Record<string, number>;
      context?: ExecutionReference;
    }
  | { type: "error"; code: string; message: string };
export type AssistantStatus = { enabled: boolean; code: string; editor_source_supported?: boolean };

export class ChatApiError extends Error {
  code: string;
  constructor(message: string, code = "REQUEST_FAILED") {
    super(message);
    this.code = code;
  }
}
const contextErrors: Record<string, string> = {
  CONTEXT_NOT_FOUND:
    "실행 정보가 없거나 보관 기간·개수를 초과했습니다. 다시 실행하거나 실행 첨부를 해제해 주세요.",
  CONTEXT_EXPIRED:
    "실행 정보가 만료되었습니다. 다시 실행하거나 실행 첨부를 해제해 주세요.",
  CONTEXT_MISMATCH: "실행 버전이 일치하지 않습니다. 다시 실행해 주세요.",
  CONTEXT_CYCLE_UNAVAILABLE: "첨부 가능한 사이클을 다시 선택해 주세요.",
  CONTEXT_MEMORY_UNAVAILABLE:
    "해당 사이클에 없는 메모리 주소입니다. 주소 선택을 해제해 주세요.",
  CONTEXT_TOO_LARGE:
    "실행 정보가 너무 큽니다. 메모리 선택을 줄이거나 실행 첨부를 해제해 주세요.",
};
const baseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export async function getAssistantStatus(
  signal: AbortSignal,
): Promise<AssistantStatus> {
  const response = await fetch(`${baseUrl()}/api/v1/assistant/status`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });
  if (!response.ok)
    throw new Error("AI 연결 상태를 확인하지 못했습니다. 다시 확인해 주세요.");
  const status = await response.json();
  if (typeof status.enabled !== "boolean" || typeof status.code !== "string")
    throw new Error("AI 연결 상태를 확인하지 못했습니다.");
  return status;
}
export function boundedHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((m) => !m.content.trim() || [...m.content].length > 8000))
    throw new Error("메시지는 1~8,000자여야 합니다.");
  const result: ChatMessage[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    const length = [...message.content].length;
    if (result.length === 20 || size + length > 24000) break;
    result.unshift(message);
    size += length;
  }
  while (result[0]?.role === "assistant") result.shift();
  if (!result.length || result.at(-1)?.role !== "user")
    throw new Error("질문을 입력해 주세요.");
  return result;
}

export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (!completed) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      if (buffer.length > 1048576)
        throw new Error("AI 응답 크기가 한도를 초과했습니다.");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const event = JSON.parse(data) as ChatEvent;
        if (!event || !["delta", "done", "error"].includes(event.type))
          throw new Error("AI 응답 형식이 올바르지 않습니다.");
        if (event.type === "error")
          throw new ChatApiError(
            event.message || "AI 응답에 실패했습니다.",
            event.code,
          );
        if (event.type === "delta" && typeof event.text !== "string")
          throw new Error("AI 응답 형식이 올바르지 않습니다.");
        if (event.type === "done" && typeof event.stop_reason !== "string")
          throw new Error("AI 종료 형식이 올바르지 않습니다.");
        onEvent(event);
        if (event.type === "done") {
          completed = true;
          break;
        }
      }
      if (done) break;
    }
    if (!completed)
      throw new Error("답변 연결이 완료 전에 끊겼습니다. 다시 시도해 주세요.");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onEvent: (event: ChatEvent) => void,
  context?: ExecutionContext,
  editorSource?: EditorSource,
): Promise<void> {
  const token = localStorage.getItem("access_token");
  if (!token)
    throw new ChatApiError(
      "AI 어시스턴트는 로그인 후 이용할 수 있습니다.",
      "AUTH_REQUIRED",
    );
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(90000)]);
  const response = await fetch(`${baseUrl()}/api/v1/assistant/chat`, {
    method: "POST",
    signal: combinedSignal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: boundedHistory(messages),
      ...(context ? { context } : {}),
      ...(editorSource ? { editor_source: editorSource } : {}),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const code =
      typeof payload?.detail?.code === "string"
        ? payload.detail.code
        : "REQUEST_FAILED";
    const message =
      contextErrors[code] ||
      (response.status === 401 || response.status === 403
        ? "로그인이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요."
        : response.status === 429
          ? "사용 한도에 도달했거나 요청 간격이 짧습니다. 잠시 후 다시 요청해 주세요."
          : response.status === 503
            ? "AI 어시스턴트 연결 준비 중입니다. 잠시 후 상태를 다시 확인해 주세요."
            : response.status === 422
              ? "질문 또는 실행 참조 형식을 확인해 주세요."
              : payload?.detail?.message ||
                "AI 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    throw new ChatApiError(message, code);
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  )
    throw new Error("AI 응답 형식을 확인할 수 없습니다.");
  await consumeChatStream(
    response.body,
    (event) => {
      if (event.type === "done" && event.context) {
        const fields = [
          "execution_id",
          "result_version",
          "artifact_sha256",
          "mode",
          "cycle",
        ] as const;
        if (
          !context ||
          fields.some((field) => event.context![field] !== context[field])
        )
          throw new Error(
            "답변의 실행 참조가 요청과 다릅니다. 다시 실행해 주세요.",
          );
      }
      onEvent(event);
    },
    combinedSignal,
  );
}

// The current SSE contract has no decision field. Match only the server's fixed
// notices, never infer refusals from missing usage (usage can be unavailable).
export function isServiceNotice(text: string): boolean {
  return [
    "ArchReactor 사용법과 컴퓨터 구조 학습 질문에만 답변할 수 있어요. C 코드, RV32IM RISC-V, 레지스터·메모리, 파이프라인, 스톨·포워딩·플러시, CPI 또는 제공한 코드·실행 결과에 관해 질문해 주세요.",
    "ArchReactor 또는 컴퓨터 구조와 관련된 질문을 구체적으로 알려 주세요. 다른 주제의 요청이 함께 있다면 관련 질문만 분리해서 보내 주세요. 짧은 후속 질문이라면 어떤 코드나 개념에 대한 질문인지 덧붙여 주세요.",
    "안녕하세요! ArchReactor 사용법과 컴퓨터 구조 학습을 도와드려요. C 코드, RV32IM RISC-V, 레지스터·메모리, 파이프라인, 스톨·포워딩·플러시, CPI를 질문하거나 코드·실행 결과를 붙여 주세요. 현재 화면이나 전체 실행 기록을 자동으로 읽지는 않아요.",
  ].includes(text);
}
