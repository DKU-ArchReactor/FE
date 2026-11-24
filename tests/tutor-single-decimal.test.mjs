import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTutor} from './load-tutor-component.mjs';

const {TutorSingleMode}=loadTutor('TutorSingleMode.tsx');

test('the current single tutor keeps decimal code and runtime summaries after develop integration',()=>{
  const row={pc:'0x10000',text:'addi a0, zero, 0x2A',sourceLine:2};
  const item={...row,explanation:{summary:'숫자 0x2A를 a0에 저장합니다.'}};
  const simulation={tutor:{asm_instructions:[item],execution_steps:[{
    history_index:0,display_clock:1,cycle:0,
    instruction_observations:[{pc:row.pc,stage:'WB',summary:'a0에 42 (0x0000002A)를 기록했습니다.'}],
  }]}};
  const before=JSON.stringify(simulation);
  const html=renderToStaticMarkup(createElement(TutorSingleMode,{
    rows:[row],source:['int main(void) {','int answer = 0x2A;'],line:2,selectedIndex:0,
    simulation,historyIndex:0,onSelect:()=>{},
  }));
  assert.match(html,/addi a0, zero, 42/);
  assert.match(html,/int answer = 42;/);
  assert.match(html,/실제 실행 요약/);
  assert.doesNotMatch(html,/0x[0-9a-f]+|CORE|확인된 완료|실행 이력에 관찰됨/i);
  assert.equal(JSON.stringify(simulation),before);
});
