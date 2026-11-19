import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/translationCompile.ts', import.meta.url), 'utf8')
  .replace('import { compileCode } from "@/api/build";', 'const compileCode = (...args) => globalThis.compileFixture(...args);')
  .replace('import { runSimulation } from "@/api/simulation";', 'const runSimulation = (...args) => globalThis.simFixture(...args);');
const { outputText } = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
const {compileTranslation, compileAssemblyDirectly} = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('compile diagnostics arrive before simulation and survive runtime failure', async () => {
  const events = [];
  let request;
  const controller = new AbortController();
  const result = {status:'success',build_id:'owned',log:'warning',analysis:{instructions:[{assembly:'li a0,1',pc:'0x1000',source_line:2}]}};
  globalThis.compileFixture = async (body, signal) => { request=body; assert.equal(signal, controller.signal); return result; };
  globalThis.simFixture = async () => { events.push('simulation'); throw new Error('unavailable'); };
  try {
    const response = await compileTranslation('int main(){}','single',{capture:true,signal:controller.signal,fileId:'saved',onCompiled:r=>{assert.equal(r,result);events.push('compiled');}});
    assert.equal(request.file_id,'saved'); assert.equal('content' in request,false);
    assert.equal(events[0],'compiled'); assert.equal(events.length,3);
    assert.equal(response.assembly,'li a0,1'); assert.equal(response.simulationResult,null);
  } finally { delete globalThis.compileFixture; delete globalThis.simFixture; }
});

test('failed builds expose diagnostics and never run simulation', async () => {
  let diagnostic;
  globalThis.compileFixture = async () => ({status:'failed',log:'syntax error'});
  globalThis.simFixture = async () => { assert.fail('must not simulate failed build'); };
  try {
    await assert.rejects(compileAssemblyDirectly('bad','single',{capture:false,signal:new AbortController().signal,onCompiled:r=>diagnostic=r}), /syntax error/);
    assert.equal(diagnostic.status,'failed');
  } finally { delete globalThis.compileFixture; delete globalThis.simFixture; }
});

test('aborted compile does not publish stale diagnostics', async () => {
  const controller = new AbortController();
  globalThis.compileFixture = async body => { assert.equal(body.content,'edited'); controller.abort(); return {status:'success'}; };
  try {
    await assert.rejects(compileTranslation('edited','single',{capture:false,signal:controller.signal,onCompiled:()=>assert.fail('stale result')}), {name:'AbortError'});
  } finally { delete globalThis.compileFixture; }
});
