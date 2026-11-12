import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
const id = (mode: string, run = 1) =>
  `${mode === "single" ? "11111111" : "22222222"}-1111-4111-8111-${String(run).padStart(12, "0")}`;
const descriptor = (mode: string, run = 1) => ({
  available: true,
  execution_id: id(mode, run),
  result_version: "a".repeat(64),
  artifact_sha256: "b".repeat(64),
  mode,
  cycle_min: 0,
  cycle_max: 1,
  expires_at: "2099-01-01T00:00:00Z",
});
const result = (mode: string) => ({
  simulator: {
    mode,
    pipeline_model: mode === "single" ? "single-cycle" : "pipeline",
  },
  program: { entry_point: "0x10000" },
  summary: { total_cycles: 2 },
  status: "CYCLE_LIMIT",
  history: [0, 1].map((clock) => ({
    clock,
    buffers: {
      IF: { pc: "0x10000", assembly: "addi a0, zero, 1", status: "normal" },
    },
    global_result: {
      memory_snapshot: Object.fromEntries(
        Array.from({ length: 17 }, (_, i) => [
          `0x${(4096 + i * 4).toString(16)}`,
          "0x1",
        ]),
      ),
      registers: { x0: "0x0" },
      metrics: { accumulated_instructions: clock + 1 },
    },
  })),
});
const notice =
  "ArchReactor 또는 컴퓨터 구조와 관련된 질문을 구체적으로 알려 주세요. 다른 주제의 요청이 함께 있다면 관련 질문만 분리해서 보내 주세요. 짧은 후속 질문이라면 어떤 코드나 개념에 대한 질문인지 덧붙여 주세요.";
function sse(text = "한글 답변", context?: object, reason = "end_turn") {
  return `: connected\n\ndata: ${JSON.stringify({ type: "delta", text })}\n\ndata: ${JSON.stringify({ type: "done", stop_reason: reason, usage: {}, ...(context ? { context } : {}) })}\n\n`;
}
async function setup(
  page: Page,
  options: { enabled?: boolean; guest?: boolean; context?: boolean } = {},
) {
  if (!options.guest)
    await page.addInitScript(() =>
      localStorage.setItem("access_token", "test-account-one"),
    );
  const runs: Record<string, unknown>[] = [];
  await page.route("**/api/v1/assistant/status", (route) =>
    route.fulfill({ json: { enabled: options.enabled ?? true, code: "TEST", editor_source_supported: true } }),
  );
  await page.route("**/api/v1/build/compile", (route) =>
    route.fulfill({
      json: { status: "success", simulation_token: "synthetic-token" },
    }),
  );
  await page.route("**/api/v1/simulation/run", (route) => {
    const body = route.request().postDataJSON();
    runs.push(body);
    return route.fulfill({
      json: {
        result: result(body.mode),
        ...(options.context === false
          ? {}
          : { assistant_context: descriptor(body.mode) }),
      },
    });
  });
  await page.goto("/tests/browser/harness.html");
  return runs;
}
async function compile(page: Page) {
  await page.getByText("compile", { exact: true }).click();
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("clock")).toHaveText("0");
}
async function send(page: Page, text = "왜 스톨이야?") {
  await page
    .getByPlaceholder("C 코드나 파이프라인에 대해 질문하세요...")
    .fill(text);
  await page.getByRole("button", { name: "전송", exact: true }).click();
}
const attach = (page: Page) =>
  page.getByRole("button", { name: /\+ 실행 · clock/ });
const attached = (page: Page) => page.getByRole("button", { name: "실행 첨부 해제", exact: true });

test("capture, real clock zero, frozen selected memory and done reference", async ({
  page,
}) => {
  const runs = await setup(page);
  await compile(page);
  expect(runs).toHaveLength(2);
  expect(runs.every((run) => run.capture_assistant_context === true)).toBe(
    true,
  );
  await expect(attach(page)).toHaveCount(0);
  await page.getByText("next cycle", { exact: true }).click();
  await attach(page).click();
  await page.getByRole("button", { name: "첨부 설정 ▾" }).click();
  await page.getByText(/메모리 선택 \(0\/16\)/).click();
  await page.getByLabel("첨부할 메모리 주소").selectOption(["4096", "4100"]);
  let submitted: any;
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/assistant/chat", async (route) => {
    submitted = route.request().postDataJSON();
    await wait;
    const { memory_addresses, ...reference } = submitted.context;
    void memory_addresses;
    await route.fulfill({
      contentType: "text/event-stream",
      body: sse("한글 답변", reference),
    });
  });
  await send(page);
  await expect.poll(() => submitted?.context?.cycle).toBe(0);
  await page.getByText("next cycle", { exact: true }).click();
  release();
  await expect(page.getByTestId("execution-badge")).toContainText(
    "참고한 실행",
  );
  await expect(page.getByTestId("execution-badge")).toContainText(
    "clock 0 기준",
  );
  await expect(page.getByText("한글 답변", { exact: false })).toBeVisible();
  expect(submitted.context.memory_addresses).toEqual([4096, 4100]);
  expect(Object.keys(submitted).sort()).toEqual(["context", "messages"]);
  await page.screenshot({ path: "test-results/assistant-context.png" });
});

test("mode change, edit and account switch invalidate attachment and conversation", async ({
  page,
}) => {
  await setup(page);
  await compile(page);
  await page.getByText("next cycle", { exact: true }).click();
  await attach(page).click();
  await page.getByText("pipeline", { exact: true }).click();
  await expect(attached(page)).toHaveCount(0);
  await attach(page).click();
  await page.getByText("edit source", { exact: true }).click();
  await expect(page.getByTestId("run")).toHaveText("none");
  await expect(attached(page)).toHaveCount(0);
  await compile(page);
  await attach(page).click();
  await page.route("**/api/v1/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: sse("이전 계정 답변"),
    }),
  );
  await send(page);
  await expect(page.getByText("이전 계정 답변", { exact: true })).toBeVisible();
  await page.getByText("switch account", { exact: true }).click();
  await expect(page.getByTestId("run")).toHaveText("none");
  await expect(page.getByText("이전 계정 답변", { exact: true })).toHaveCount(
    0,
  );
});

test("late compilation after source edit cannot restore a stale execution", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  let started = false;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/build/compile", async (route) => {
    started = true;
    await wait;
    await route.fulfill({
      json: { status: "success", simulation_token: "old" },
    });
  });
  await page.getByText("compile", { exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByText("edit source", { exact: true }).click();
  release();
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("run")).toHaveText("none");
  await expect(attach(page)).toHaveCount(0);
});

test("out-of-domain guidance carries no evidence badge or future history", async ({
  page,
}) => {
  await setup(page);
  await compile(page);
  await page.getByText("next cycle", { exact: true }).click();
  await attach(page).click();
  const requests: any[] = [];
  await page.route("**/api/v1/assistant/chat", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body: sse(notice),
    });
  });
  await send(page, "날씨와 CPI");
  await expect(page.getByText(notice, { exact: true })).toBeVisible();
  await expect(page.getByTestId("execution-badge")).toHaveCount(0);
  await send(page, "CPI란?");
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].messages).toEqual([{ role: "user", content: "CPI란?" }]);
});

for (const [status, code] of [
  [410, "CONTEXT_EXPIRED"],
  [409, "CONTEXT_MISMATCH"],
  [404, "CONTEXT_NOT_FOUND"],
  [422, "CONTEXT_MEMORY_UNAVAILABLE"],
  [413, "CONTEXT_TOO_LARGE"],
  [429, "DAILY_LIMIT_EXCEEDED"],
] as const) {
  test(`HTTP ${status} ${code} is visible, with no silent retry`, async ({
    page,
  }) => {
    await setup(page);
    await compile(page);
    await page.getByText("next cycle", { exact: true }).click();
    await attach(page).click();
    let count = 0;
    await page.route("**/api/v1/assistant/chat", (route) => {
      count++;
      return route.fulfill({ status, json: { detail: { code } } });
    });
    await send(page);
    await expect(
      page.getByRole("button", { name: "질문 다시 입력" }),
    ).toBeVisible();
    expect(count).toBe(1);
    await expect(attached(page)).toBeVisible();
    await expect(page.getByTestId("execution-badge")).toHaveCount(0);
  });
}

test("disabled service and guests cannot send; guests do not capture", async ({
  page,
}) => {
  const runs = await setup(page, { guest: true });
  await compile(page);
  expect(runs.every((run) => run.capture_assistant_context === undefined)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "전송", exact: true }),
  ).toBeDisabled();
});
test("disabled service has status retry and disabled suggestions", async ({
  page,
}) => {
  await setup(page, { enabled: false });
  await expect(
    page.getByText("AI 연결 준비 중", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /해저드 분석/ }),
  ).toBeDisabled();
  await page.route("**/api/v1/assistant/status", (route) =>
    route.fulfill({ json: { enabled: true, code: "ENABLED" } }),
  );
  await page.getByRole("button", { name: "첨부 설정 ▾" }).click();
  await page.getByRole("button", { name: "연결 다시 확인" }).click();
  await expect(page.getByRole("button", { name: /해저드 분석/ })).toBeEnabled();
});
test("old server without descriptor allows general chat", async ({ page }) => {
  await setup(page, { context: false });
  await compile(page);
  await expect(attach(page)).toHaveCount(0);
  let request: any;
  await page.route("**/api/v1/assistant/chat", (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ contentType: "text/event-stream", body: sse() });
  });
  await send(page);
  await expect(page.getByText("한글 답변", { exact: true })).toBeVisible();
  expect(request.context).toBeUndefined();
});
test("stop and close abort pending chat; failed turns are not reused", async ({
  page,
}) => {
  await setup(page);
  let started = 0;
  await page.route("**/api/v1/assistant/chat", () => {
    started++;
  });
  await send(page);
  await expect.poll(() => started).toBe(1);
  await page.getByRole("button", { name: "중단", exact: true }).click();
  await expect(
    page.getByText("답변 생성을 중단했습니다.", { exact: true }),
  ).toBeVisible();
  await send(page, "두 번째");
  await expect.poll(() => started).toBe(2);
  await page.getByTitle("창 닫기", { exact: true }).click();
  await page.getByText("open chat", { exact: true }).click();
  await expect(
    page.getByText("답변 생성을 중단했습니다.", { exact: true }),
  ).toHaveCount(2);
  let body: any;
  await page.unroute("**/api/v1/assistant/chat");
  await page.route("**/api/v1/assistant/chat", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ contentType: "text/event-stream", body: sse() });
  });
  await send(page, "다시 질문");
  await expect(page.getByText("한글 답변", { exact: true })).toBeVisible();
  expect(body.messages).toEqual([{ role: "user", content: "다시 질문" }]);
});
test("SSE classification errors and interrupted streams terminate without completion", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"error","code":"CLASSIFICATION_UNAVAILABLE","message":"주제 판별 일시 오류"}\n\n',
    }),
  );
  await send(page);
  await expect(
    page.getByText("주제 판별 일시 오류", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/v1/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"delta","text":"부분 답변"}\n\n',
    }),
  );
  await send(page);
  await expect(
    page.getByText(/답변 연결이 완료 전에 끊겼습니다/),
  ).toBeVisible();
});

test("full workspace connects captured run to the actual assistant popup", async ({
  page,
}) => {
  await setup(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        user_id: "demo",
        name: "Test",
        email: "test@example.invalid",
        role: "user",
      },
    }),
  );
  await page.route("**/api/v1/files**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/tutor/explain", (route) =>
    route.fulfill({
      json: {
        items: route
          .request()
          .postDataJSON()
          .items.map((item: any) => ({
            kind: item.kind,
            category: "sample",
            title: "테스트 해설",
            summary: "테스트 설명",
            detail: "테스트 근거",
          })),
      },
    }),
  );
  await page.route("**/api/v1/simulation/run", (route) => {
    const mode = route.request().postDataJSON().mode;
    const trace = JSON.parse(
      readFileSync(new URL(`./fixtures/${mode}.json`, import.meta.url), "utf8"),
    );
    return route.fulfill({
      json: { result: trace, assistant_context: descriptor(mode) },
    });
  });
  // Serve the installed Monaco distribution instead of depending on CDN availability.
  await page.route("https://**/*", route => route.abort());
  await page.route("https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/**", route => {
    const suffix = new URL(route.request().url()).pathname.split('/min/vs/')[1];
    return route.fulfill({path: new URL(`../../node_modules/monaco-editor/min/vs/${suffix}`, import.meta.url).pathname});
  });
  await page.goto("/pipeline");
  await page
    .getByTitle("ArchReactor AI 어시스턴트 열기", { exact: true })
    .click();
  await page
    .getByTitle("C 코드 컴파일 및 어셈블리 변환", { exact: true })
    .click();
  await expect(
    page.getByTitle("한 단계 실행 (Step Over / Forward)", { exact: true }),
  ).toBeEnabled();
  await page
    .getByTitle("한 단계 실행 (Step Over / Forward)", { exact: true })
    .click();
  await attach(page).click();
  await page.route("**/api/v1/assistant/chat", (route) => {
    const { memory_addresses, ...reference } = route
      .request()
      .postDataJSON().context;
    void memory_addresses;
    return route.fulfill({
      contentType: "text/event-stream",
      body: sse("선택 실행을 참고한 답변", reference),
    });
  });
  await send(page);
  await expect(page.getByTestId("execution-badge")).toContainText(
    "참고한 실행",
  );
  await expect(page.getByTestId("execution-badge")).toContainText(
    "clock 0 기준",
  );
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: "test-results/full-workspace.png" });
});

test("truncation and mismatched done reference never claim successful completion", async ({
  page,
}) => {
  await setup(page);
  await compile(page);
  await page.getByText("next cycle", { exact: true }).click();
  await attach(page).click();
  await page.route("**/api/v1/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: sse("긴 답변", undefined, "max_tokens"),
    }),
  );
  await send(page);
  await expect(
    page.getByText("답변 길이 한도에 도달했습니다. 이어서 질문해 주세요.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/api/v1/assistant/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: sse("다른 실행", { execution_id: "wrong" }),
    }),
  );
  await send(page);
  await expect(
    page.getByText("답변의 실행 참조가 요청과 다릅니다. 다시 실행해 주세요.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("execution-badge")).toHaveCount(0);
});
