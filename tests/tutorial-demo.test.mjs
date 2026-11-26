import assert from "node:assert/strict";
import test from "node:test";
import { loadTutor } from "./load-tutor-component.mjs";
const demo = loadTutor("../utils/tutorialDemoData.ts");
test("demo clocks agree with independent sequential instruction results at MEM and WB", () => {
  const simulation = demo.TUTORIAL_DEMO_SIMULATION;
  const rows = demo.TUTORIAL_DEMO_MAPPED_ROWS;
  const values = Array(32).fill(0);
  values[2] = 0x7ffffff0;
  const aliases = { sp: 2, s0: 8, a0: 10, a4: 14, a5: 15, zero: 0 };
  const stored = {};
  const writes = [];
  for (const row of rows) {
    const [op, ...args] = row.text.replaceAll(",", "").split(/\s+/);
    if (op === "addi" || op === "add") {
      const result =
        values[aliases[args[1]]] +
        (op === "addi" ? Number(args[2]) : values[aliases[args[2]]]);
      values[aliases[args[0]]] = result;
      writes.push({ register: aliases[args[0]], value: result });
    } else {
      const [, offset, base] = /(-?\d+)\((\w+)\)/.exec(args[1]);
      const address = values[aliases[base]] + Number(offset);
      if (op === "sw") {
        stored[address] = values[aliases[args[0]]];
        writes.push({ address, value: stored[address] });
      } else {
        values[aliases[args[0]]] = stored[address];
        writes.push({ register: aliases[args[0]], value: stored[address] });
      }
    }
    assert.ok(row.sourceLine <= demo.TUTORIAL_DEMO_SOURCE.split("\n").length);
  }
  const expected = Array(32).fill(0);
  expected[2] = 0x7ffffff0;
  const expectedMemory = {};
  let forwarded = 0;
  simulation.history.forEach((snapshot, index) => {
    const wb = writes[index - 4],
      mem = writes[index - 3];
    if (wb?.register != null) expected[wb.register] = wb.value;
    if (mem?.address != null) expectedMemory[mem.address] = mem.value;
    for (let r = 0; r < 32; r++)
      assert.equal(
        parseInt(snapshot.global_result.registers[`x${r}`], 16),
        expected[r],
        `clock ${index + 1}, x${r}`,
      );
    for (const [address, value] of Object.entries(expectedMemory))
      assert.equal(
        parseInt(
          snapshot.global_result.memory_snapshot[
            `0x${Number(address).toString(16).padStart(8, "0")}`
          ],
          16,
        ),
        value,
      );
    forwarded += Number(snapshot.cycle_events.forwarding.has_forwarded);
    assert.equal(
      snapshot.global_result.metrics.accumulated_forwards,
      forwarded,
    );
    assert.equal(
      snapshot.global_result.metrics.accumulated_instructions,
      Math.max(0, index - 3),
    );
  });
  assert.equal(expected[10], 8);
  assert.equal(simulation.summary.instructions_executed, rows.length);
  assert.equal(simulation.summary.total_cycles, rows.length + 4);
});

test("demo code mapping covers every instruction", () => {
  const s = demo.TUTORIAL_DEMO_SIMULATION;
  assert.equal(
    Object.keys(s.program.code_mapping).length,
    s.program.instruction_words,
  );
});

test("demo instructions appear in Code and never in Data", () => {
  const memory = loadTutor("../utils/memoryLayout.ts");
  const simulation = demo.TUTORIAL_DEMO_SIMULATION;
  const frame = demo.TUTORIAL_DEMO_CURRENT_DATA;
  const code = memory.extractCodeSegmentSummary(
    simulation,
    frame.global_result.current_pc,
  );
  const segments = memory.buildSegmentedMemory(
    frame.global_result.memory_snapshot,
    undefined,
    undefined,
    code.maxCodePcNum,
    code.userInstructions,
    code.runtimeInstructions,
  );
  assert.equal(segments.code.length, simulation.program.instruction_words);
  assert.equal(segments.data.length, 0);
});
