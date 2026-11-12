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

This does not attach C source, compile-time C-line explanations, the entire trace,
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
