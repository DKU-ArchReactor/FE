import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/simulation.ts', import.meta.url), 'utf8')
  .replace('import { seedTutor } from "@/pages/Main/utils/tutorAnalysis";', 'const seedTutor = () => {};')
  .replace('import apiConfig from "@/api/config";', 'const apiConfig = { post: (...args) => globalThis.simulationPost(...args) };');
const { outputText } = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
const {runSimulation} = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('saved authenticated runs capture and preserve their own snapshot descriptor', async () => {
  const previousStorage = globalThis.localStorage;
  let signedIn = true;
  const descriptor = {available:true,execution_id:'run-1',mode:'pipeline'};
  const sent = [];
  globalThis.localStorage = {getItem:()=> signedIn ? 'synthetic-local-test' : null};
  globalThis.simulationPost = async (_, payload) => {
    sent.push(payload);
    return {data:{result:{simulator:{mode:payload.mode},history:[]},assistant_context:descriptor}};
  };
  try {
    const result = await runSimulation({build_id:'saved-build',mode:'pipeline'});
    assert.equal(sent[0].capture_assistant_context, true);
    assert.deepEqual(result.assistant_context, descriptor);
    await runSimulation({simulation_token:'guest-fixture',mode:'single'});
    assert.equal(sent[1].capture_assistant_context, false);
    signedIn = false;
    await runSimulation({build_id:'saved-build',mode:'single'});
    assert.equal(sent[2].capture_assistant_context, false);
  } finally {
    delete globalThis.simulationPost;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
