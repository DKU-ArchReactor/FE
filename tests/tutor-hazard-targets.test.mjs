import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTutor} from './load-tutor-component.mjs';
const {isForwardingTarget,explainForwarding,explainStall}=loadTutor('../utils/tutorReadable.ts');

test('identical ASM in other stages does not inherit the EX forwarding event',()=>{
  const event={has_forwarded:true,stage:'EX',assembly:'add a0, a1, a2'};
  assert.equal(isForwardingTarget(event,'EX','add a0,a1,a2'),true);
  for(const stage of ['IF','ID','MEM','WB'])assert.equal(isForwardingTarget(event,stage,event.assembly),false);
  assert.equal(isForwardingTarget(event,'EX','sub a0,a1,a2'),false);
  assert.equal(isForwardingTarget({...event,has_forwarded:false},'EX',event.assembly),false);
});

test('forwarded inputs retain their individual producer and register pairing',()=>{
  const text=explainForwarding({forwarded_from:['EX/MEM','MEM/WB'],forwarded_to:['rs1','rs2'],target_register:['x5','x6'],forwarded_value:[]});
  const [first,second]=text.split('\n');
  assert.match(first,/t0.*첫 번째 입력.*EX\/MEM/);
  assert.doesNotMatch(first,/t1|MEM\/WB/);
  assert.match(second,/t1.*두 번째 입력.*MEM\/WB/);
  assert.doesNotMatch(text,/멈출 필요가 없습니다/);
});

test('equivalent load-use reason codes receive the same concrete explanation',()=>{
  const cycle={stage_activity:{EX:{assembly:'lw a0, 0(sp)'}},buffers:{},cycle_events:{stall:{assembly:'add a1,a0,a2'}}};
  const results=['load_use','load_use_hazard','data_hazard_load_use'].map(reason=>explainStall({...cycle,cycle_events:{stall:{...cycle.cycle_events.stall,stall_reason:reason}}},'ID'));
  for(const result of results){assert.deepEqual(result,results[0]);assert.match(result.cause,/lw a0/);}
});
