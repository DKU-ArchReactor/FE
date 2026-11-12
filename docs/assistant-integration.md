# AI assistant and backend tutor integration

## Scope and dependencies

This frontend consumes the backend tutor APIs and SOLID assistant APIs, including
[BE #9](https://github.com/DKU-ArchReactor/BE/pull/9)'s selected execution context.
Set `VITE_API_URL` to the backend URL (currently
`https://d1j3nkcez6kncs.cloudfront.net`). No SOLID key belongs in frontend settings.
The frontend implementation is not a deployment. Merging main/develop currently
triggers existing S3 deployment workflows; confirm deployment authorization and
account/bucket configuration separately before merging.

## User flow

- Logged-in simulations request `capture_assistant_context: true` for both engine
  results. Guest simulations omit it. Outer `tutor` and `assistant_context` remain
  attached to their exact simulation response. Missing/unavailable descriptors
  disable execution attachment without disabling general questions.
- The assistant checks `/api/v1/assistant/status` whenever opened. Disabled,
  failed status checks and logged-out sessions cannot send messages or quick
  questions. The user can explicitly recheck status.
- Execution attachment is **off by default**. When selected, the question captures
  the actual history item's `clock`, execution UUID, result version, ELF hash and
  mode. It sends at most 16 explicitly selected aligned memory addresses; by
  default no memory is requested. Values/trace/tutor text are not reconstructed
  into the chat request. The backend resolves authorized evidence.
- Single mode's initial UI step 0 is a synthetic pre-execution frame and cannot
  be attached. UI step 1 attaches CORE clock 0. Pipeline uses the selected history
  item's clock directly. Playback after sending does not change a pending question.
- The answer's evidence badge uses `done.context`, and appears only when the
  server returned a matching reference. A pending request is labelled separately.
  Domain refusals, greetings and clarification notices have no completed badge.
- Code edits, editor type switches, recompilation, mode changes, logout and account
  changes invalidate the relevant attachment. In-flight compile/run requests are
  cancelled and generation checks discard late responses even if cancellation is
  ignored. Returning to an earlier cached engine still requires explicit selection.
- Chat text remains in component memory only, never localStorage. Account changes
  clear it and abort requests. Normal workspace changes preserve completed chat;
  prior messages describe prior runs, while each new context reference is explicit.

## SSE and error handling

POST fetch with Bearer auth and streaming TextDecoder handles split Korean UTF-8,
CRLF, comments and delta/done/error. An EOF before done is an error. Stop, close,
unmount and account switch abort the connection. A 90-second client deadline
bounds a stalled connection; backend classification and answer still share their
existing 60-second deadline. There is no automatic request retry.

HTTP 401/403 asks for login, 429 explains limits and 503 explains readiness.
CONTEXT_NOT_FOUND / EXPIRED / MISMATCH / CYCLE_UNAVAILABLE / MEMORY_UNAVAILABLE /
TOO_LARGE offer explicit corrective action; they never silently drop context and
retry. Schema 422 arrays receive a readable format error. SSE provider and
classification errors terminate the loading state. max_tokens shows truncation.
“질문 다시 입력” restores the question into the editor; the user reviews the current
attachment and submits a **new** request, which may consume another quota unit.

Only completed user/assistant pairs are included in subsequent bounded history
(maximum 20 messages, 8,000 Unicode code points each, 24,000 total). Failed,
cancelled and truncated pairs are excluded. The current server has no decision
field in done, so its three exact fixed service notices are excluded using
`isServiceNotice`; synchronize these strings if the backend changes them. Empty
usage alone never means a refusal, and is never displayed as zero token usage.

## Limits

Execution references do not attach compile-time C-line explanations, the entire trace,
console output or a full memory dump. It is not an autonomous execution analyzer.
Snapshot defaults remain server-controlled (three recent executions / 30 minutes).
Each compile currently runs both modes, so two snapshots can be retained. Local
expiry disables attachment; eviction before expiry is reported by the server.
The frontend cannot guarantee model accuracy or domain containment.

## Verification

```sh
npm ci
npm test
npx playwright install chromium --only-shell
npm run test:browser
npm run build
```

Browser tests use a local-only harness rendering the real popup, session hook,
playback hook and auth-session hook, with mocked compile/simulation/status/chat
responses, plus a full workspace smoke test with two-cycle excerpts of CORE
`tests/program2.elf` (commit `7e9e6c856522f4af4c2e62a7fc3b2f1074ad228c`). They do not call SOLID, modify production data or spend model quota.
`tests/` is not a production build entry. Use `PLAYWRIGHT_BROWSERS_PATH` if a
separate browser cache is desired. Screenshots are saved in ignored test-results/.

Before release, verify the deployed backend schema and exercise real login,
compile, single/pipeline, optional memory, streaming, expiry and quota behaviour
against the intended environment. This PR's browser tests establish frontend
contract behaviour; they do not substitute for an authenticated production E2E.

## Markdown and attachment guidance follow-up

Assistant messages render Markdown headings, lists, tables, quotes, code and KaTeX math. Both dollar delimiters and SOLID-style LaTeX delimiters are supported; code examples remain literal. The renderer loads on demand and keeps streaming text available while loading. Raw HTML is skipped, remote Markdown images are not loaded, and links are limited to HTTP(S). KaTeX trust is disabled and expansion/size are bounded. All KaTeX consumers use the same patched version through the package override.

Each question records whether execution evidence was attached. The popup explains how to compile/assemble, step and attach when there is no result, and explicitly warns when an available result is not selected. At that earlier follow-up, editor source was not attached. The current editor-source section below supersedes that behavior.

Validation: 20 Node tests (including Markdown/math, unsafe output, partial streaming syntax), production build and changed-source lint pass. Static browser preview: `/tests/browser/markdown.html` (development only, synthetic data, no model call). This follow-up does not rerun the previous 17 browser scenarios or the production model smoke test. The existing dependency audit findings outside the added rendering dependency chain remain a separate maintenance task.


## Current editor source (requires the editor-source backend API)

When a question is sent, the active C editor or editable ASM input is captured as `editor_source: { language, content }`. It defaults on, can be disabled, and sends nothing while typing. Compiled assembly from an older build is never substituted. The popup shows language/length and each question's attachment state. A draft is not proof of execution and may differ from an attached snapshot.

Limits: 12,000 Unicode code points / 48,000 UTF-8 bytes. Empty text is omitted; oversize text is rejected rather than silently truncated. If `/assistant/status` lacks `editor_source_supported: true`, the UI explains that the backend is not ready and does not send the source request. Deploy the supporting backend first. Turning attachment off omits the current editor field; previous answers may still contain quoted code in conversation history.

Latest verification: 23 Node tests, build and changed-source lint passed. Browser checks on the actual PR main screen verified C/ASM selection, source counts and logged-out blocking. The isolated `/tests/browser/source-attachment.html` fixture verified C capture, edit refresh, ASM capture, opt-out, and unsupported-server blocking with an unchanged request count. This fixture uses synthetic code and mock SSE, not SOLID. The production backend remains the separate live API; source-bearing SOLID smoke testing is pending deployment of the new backend.


## Compact attachments and selected code

Attachment chips now sit below the send input; details and memory selection are collapsed under attachment settings. Dragging (or keyboard-selecting) nonblank text in the active C/ASM Monaco editor automatically selects that snippet for the next question. The chip shows original line numbers, and the message records the sent range. Moving focus to chat retains the selection. Clearing the selection uses the whole current draft; changing language or document invalidates an old selection. Removing the code chip disables source attachment until re-enabled or a new valid selection is made.

The API contract remains `editor_source: { language, content }`; only the selected text is sent, without a full-document copy or local range metadata. Existing source size checks and backend capability gating still apply. Prior answer text can still quote previously attached code.

Execution is separate: use `+ 실행 · clock N` to attach the currently selected cycle, and the chip's remove button to omit it. There is no duplicate execution checkbox. Code selection does not infer an execution cycle, and cycle ranges are not supported. Memory selection, expiry and request-time snapshot validation remain unchanged.

Validation: 25 Node tests and production build; local UI checks use actual C/ASM Monaco drag selections and isolated mock chat requests. These do not constitute a live SOLID source-attachment test.

Welcome copy is one sentence with seven collapsible question examples for selected/full C, selected/full ASM, cycle events, CPI, and code/execution comparison. Examples and top suggestion chips fill the input without sending; users review attachments and press Send.

## 컴파일 안내 및 질문 예시

- C 컴파일 또는 ASM 어셈블 결과가 도착하면 어시스턴트 버튼을 강조하고, 코드 흐름을 질문하도록 안내하는 말풍선을 표시합니다. 실패하거나 무효화된 요청에는 표시하지 않습니다.
- 말풍선 닫기·어시스턴트 열기·새 빌드·코드/작성 모드 변경 시 안내를 정리합니다. 닫은 안내는 단순 스텝 이동에 다시 나타나지 않습니다.
- 첫 인사는 “코드와 실행 과정에서 궁금한 점을 물어보세요.”입니다. 질문 예시는 기본 접힘이며, 펼치면 한 줄의 가로 스크롤 버튼을 표시합니다. 예시 선택은 입력창만 채우고 자동 전송하지 않습니다.
- 로컬 모의 검증: `/tests/browser/compile-hint.html`에서 실제 Main 화면의 컴파일·어셈블·실패·닫기·열기를 확인할 수 있습니다. 앱 API 요청은 모의 응답이며 실제 SOLID를 호출하지 않습니다.
- `develop` 병합은 DEV S3 자동 배포를 실행합니다. `main` 운영 배포는 별도입니다. 이 UI 변경은 백엔드 질문 한도 변경과 독립적입니다.
