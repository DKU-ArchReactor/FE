import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/api/assistant.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const { consumeChatStream, boundedHistory } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputText).toString("base64")
);
function stream(text, split = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += split)
        controller.enqueue(bytes.slice(i, i + split));
      controller.close();
    },
  });
}

test("parses fragmented UTF-8 and CRLF, comments, and completion", async () => {
  const received = [];
  await consumeChatStream(
    stream(
      ': keepalive\r\n\r\ndata: {"type":"delta","text":"한글\\n답변"}\r\n\r\ndata: {"type":"done","stop_reason":"end_turn"}\r\n\r\n',
    ),
    (event) => received.push(event),
  );
  assert.equal(received[0].text, "한글\n답변");
  assert.equal(received[1].type, "done");
});

test("reports provider error instead of success", async () => {
  await assert.rejects(
    consumeChatStream(
      stream('data: {"type":"error","message":"권한 없음"}\n\n'),
      () => {},
    ),
    /권한 없음/,
  );
});

test("detects interrupted streams", async () => {
  await assert.rejects(
    consumeChatStream(
      stream('data: {"type":"delta","text":"partial"}\n\n'),
      () => {},
    ),
    /완료 전에/,
  );
});

test("request history remains bounded and starts with user", () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? "user" : "assistant",
    content: "x".repeat(8000),
  }));
  const result = boundedHistory(messages);
  assert.equal(result[0].role, "user");
  assert.equal(result.at(-1).role, "user");
  assert.ok(result.length <= 20);
  assert.ok(
    result.reduce((n, message) => n + message.content.length, 0) <= 24000,
  );
});

test("cancellation releases an idle reader and never emits done", async () => {
  let cancelled = false;
  const controller = new AbortController();
  const pending = consumeChatStream(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
    () => assert.fail("cancelled event"),
    controller.signal,
  );
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(cancelled, true);
});
test("done context survives SSE decoding, fixed notices do not acquire context", async () => {
  const context = { execution_id: "test", cycle: 0, mode: "single" };
  const received = [];
  await consumeChatStream(
    stream(
      `data: ${JSON.stringify({ type: "done", stop_reason: "end_turn", context })}\n\n`,
    ),
    (event) => received.push(event),
  );
  assert.deepEqual(received[0].context, context);
  const fixed = [];
  await consumeChatStream(
    stream(
      'data: {"type":"delta","text":"안내"}\n\ndata: {"type":"done","stop_reason":"end_turn","usage":{}}\n\n',
    ),
    (event) => fixed.push(event),
  );
  assert.equal(fixed.at(-1).context, undefined);
});
test("classification failure and invalid frames stop the stream", async () => {
  await assert.rejects(
    consumeChatStream(
      stream(
        'data: {"type":"error","code":"CLASSIFICATION_UNAVAILABLE","message":"일시 오류"}\n\n',
      ),
      () => {},
    ),
    (error) => error.code === "CLASSIFICATION_UNAVAILABLE",
  );
  await assert.rejects(
    consumeChatStream(
      stream('data: {"type":"delta","text":123}\n\n'),
      () => {},
    ),
    /형식/,
  );
  await assert.rejects(
    consumeChatStream(stream("data: null\n\n"), () => {}),
    /형식/,
  );
});
test("history rejects oversized individual messages and non-user final turn", () => {
  assert.throws(() =>
    boundedHistory([{ role: "user", content: "a".repeat(8001) }]),
  );
  assert.throws(() =>
    boundedHistory([{ role: "assistant", content: "reply" }]),
  );
  assert.equal(
    boundedHistory([{ role: "user", content: "😀".repeat(8000) }]).length,
    1,
  );
});
