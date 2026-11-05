import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(async () => { await server.close(); });

for (const mode of ['single', 'pipeline']) {
  test(`actual ${mode} frames render with the correct datapath and memory facts`, { skip: !process.env.CORE_FIXTURE_DIR }, async () => {
    const result = JSON.parse(fs.readFileSync(path.join(process.env.CORE_FIXTURE_DIR, mode, 'simulation_result.json'), 'utf8'));
    const { default: Datapath } = await server.ssrLoadModule('/src/pages/Main/components/PipelineVisualizer.tsx');
    const { default: Memory } = await server.ssrLoadModule('/src/pages/Main/components/MemorySegmentVisualizer.tsx');
    const { default: State } = await server.ssrLoadModule('/src/pages/Main/components/StateVisualizer.tsx');
    const currentData = result.history.at(-1);
    const props = { currentData, prevData: result.history.at(-2), simulationData: result };
    const datapath = renderToStaticMarkup(React.createElement(Datapath, { currentData, mode }));
    assert.ok(datapath.includes(mode === 'single' ? 'Single-Cycle Datapath' : '5-Stage Pipeline Datapath'));
    const memory = renderToStaticMarkup(React.createElement(Memory, props));
    assert.ok(memory.includes(result.program.instructions[0].pc.toLowerCase()));
    assert.ok(!memory.includes('NULL Pointer Guard'));
    assert.ok(!memory.includes('System Runtime Startup'));
    assert.ok(renderToStaticMarkup(React.createElement(State, props)).includes('Registers'));
  });
}
