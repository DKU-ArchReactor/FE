import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTutor} from './load-tutor-component.mjs';

const {TutorSingleMode}=loadTutor('TutorSingleMode.tsx');
const rows=[
  {pc:'0x10000',text:'auipc ra, 0',sourceLine:null},
  {pc:'0x10004',text:'jalr ra, ra, 20',sourceLine:null},
  {pc:'0x10008',text:'addi a0, zero, 5',sourceLine:2},
];
const simulation={tutor:{asm_instructions:rows.map(row=>({...row,explanation:{title:'명령어',summary:`동작: ${row.text}`,detail:'레지스터와 주소를 사용합니다.'}}))}};
function render(selectedIndex,requestedView='asm') {
  return renderToStaticMarkup(createElement(TutorSingleMode,{
    rows,source:['int main(void) {','int a = 5;'],line:2,selectedIndex,
    requestedView,simulation,onSelect:()=>{},hasC:true,
  }));
}
test('unmapped ASM never inherits the previously selected C line or screen',()=>{
  const html=render(1,'c');
  assert.match(html,/data-view="asm"/);
  assert.match(html,/연결된 C 줄 없음/);
  assert.match(html,/jalr ra, ra, 20/);
  assert.doesNotMatch(html,/int a = 5;|C: L2 설명 보기|tutor-single-page-c/);
  assert.match(html.replace(/<[^>]*>/g,''),/동작: jalr ra, ra, 20/);
});
test('mapped instructions still expose the correct C explanation',()=>{
  const html=render(2);
  assert.match(html,/int a = 5;/);
  assert.match(html,/C: L2 설명 보기/);
  assert.doesNotMatch(html,/연결된 C 줄 없음/);
});

test('startup file evidence is distinguished from unknown origin without replacing ASM meaning',()=>{
  const original=simulation.tutor;
  simulation.tutor={...original,asm_instructions:original.asm_instructions.map((item,index)=>index===0?{...item,source_file:'/build/start.S',source_context:'startup_source'}:item)};
  try {
    const html=render(0);
    assert.match(html,/프로그램 시작 코드 · C 연결 없음/);
    assert.match(html,/ASM 기준으로 설명합니다/);
    assert.match(html.replace(/<[^>]*>/g,''),/동작: auipc ra, 0/);
    assert.doesNotMatch(html,/C: L2 설명 보기/);
  } finally { simulation.tutor=original; }
});

test('missing source metadata does not claim startup or hide the instruction meaning',()=>{
  const html=render(1);
  assert.match(html,/C 줄 정보가 없어도 명령어의 동작과 실행 결과는 확인할 수 있습니다/);
  assert.doesNotMatch(html,/프로그램 시작 코드|start.S 파일/);
});
