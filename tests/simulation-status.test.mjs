import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/api/simulation.ts',import.meta.url),'utf8');
for(const status of ['COMPLETED','CYCLE_LIMIT','SIMULATION_ERROR','unknown'])test(`execution envelope preserves only supported status ${status}`,async()=>{
 const exports={};
 const result={history:[],simulator:{mode:'single'},status:'halted'};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('import.meta.env','({})'),{exports,require:name=>name.includes('config')?{default:{post:async()=>({data:{execution_status:status,result}})}}:{seedTutor:()=>{}}});
 const actual=await exports.runSimulation({simulation_token:'test'});
 assert.equal(actual.execution_status,status==='unknown'?undefined:status);
 assert.equal(actual.status,'halted');assert.equal(actual.history.length,0);
});
