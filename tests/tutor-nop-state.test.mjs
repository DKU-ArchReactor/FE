import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTutor} from './load-tutor-component.mjs';
const {isValidStageInst}=loadTutor('../utils/multiCycleTrace.ts');

test('an actual nop instruction is distinct from an empty or cancelled pipeline slot',()=>{
  assert.equal(isValidStageInst({pc:'0x10000',assembly:'nop',status:'normal'}),true);
  for(const status of ['empty','bubble','flush','flushed']){
    assert.equal(isValidStageInst({pc:'0x10000',assembly:'nop',status}),false);
  }
  assert.equal(isValidStageInst({assembly:'nop (bubble)',status:'normal'}),false);
  assert.equal(isValidStageInst({assembly:'addi a0,zero,1',status:'normal',flush_info:{is_flushed:true}}),false);
});
