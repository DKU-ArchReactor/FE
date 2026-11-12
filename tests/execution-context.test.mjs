import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/pages/Main/utils/assistantContext.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  contextAvailability,
  availableMemory,
  freezeExecutionContext,
  RequestGeneration,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputText).toString("base64")
);
const descriptor = {
  available: true,
  execution_id: "owned",
  result_version: "a".repeat(64),
  artifact_sha256: "b".repeat(64),
  mode: "single",
  cycle_min: 0,
  cycle_max: 200,
  expires_at: "2099-01-01T00:00:00Z",
};
const result = () => ({ assistant_context: { ...descriptor } });
const cycle = () => ({
  clock: 0,
  global_result: {
    memory_snapshot: {
      "0x1000": "0xff",
      4100: "0x01",
      4096: "0xff",
      "0x1001": "0",
      "-4": "0",
      junk: "0",
    },
  },
});

test("single initial placeholder is never attached as actual clock zero", () => {
  assert.match(
    contextAvailability(result(), cycle(), "single", true),
    /실행 전/,
  );
  assert.equal(contextAvailability(result(), cycle(), "single", false), null);
  assert.equal(
    freezeExecutionContext(result(), cycle(), "single", false, []).cycle,
    0,
  );
});
test("attachment freezes actual CORE clock and copied memory at question time", () => {
  const current = cycle();
  const addresses = [4096];
  current.clock = 17;
  const ref = freezeExecutionContext(
    result(),
    current,
    "single",
    false,
    addresses,
  );
  current.clock = 18;
  addresses.push(4100);
  assert.equal(ref.cycle, 17);
  assert.deepEqual(ref.memory_addresses, [4096]);
  assert.deepEqual(Object.keys(ref).sort(), [
    "artifact_sha256",
    "cycle",
    "execution_id",
    "memory_addresses",
    "mode",
    "result_version",
  ]);
});
test("old server, unavailable snapshots, invalid cycle, mode and expiry fail locally", () => {
  assert.ok(contextAvailability({}, cycle(), "single", false));
  assert.ok(
    contextAvailability(
      { assistant_context: { available: false } },
      cycle(),
      "single",
      false,
    ),
  );
  assert.ok(contextAvailability(result(), cycle(), "pipeline", false));
  assert.ok(
    contextAvailability(result(), { ...cycle(), clock: 201 }, "single", false),
  );
  assert.ok(
    contextAvailability(
      result(),
      cycle(),
      "single",
      false,
      Date.parse("2100-01-01"),
    ),
  );
});
test("memory is explicit, aligned, unique, present at selected cycle and bounded to 16", () => {
  assert.deepEqual(availableMemory(cycle()), [4096, 4100]);
  for (const addresses of [[4097], [4096, 4096], [8192]])
    assert.throws(() =>
      freezeExecutionContext(result(), cycle(), "single", false, addresses),
    );
  const current = cycle();
  current.global_result.memory_snapshot = Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [String(i * 4), "0"]),
  );
  assert.equal(
    freezeExecutionContext(
      result(),
      current,
      "single",
      false,
      Array.from({ length: 16 }, (_, i) => i * 4),
    ).memory_addresses.length,
    16,
  );
  assert.throws(() =>
    freezeExecutionContext(
      result(),
      current,
      "single",
      false,
      Array.from({ length: 17 }, (_, i) => i * 4),
    ),
  );
});
test("late requests cannot replace results after a new run, edit, logout or mode change", () => {
  const gate = new RequestGeneration();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.isCurrent(), true);
  gate.invalidate();
  assert.equal(second.isCurrent(), false);
  assert.equal(second.signal.aborted, true);
});
