import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTutor} from './load-tutor-component.mjs';

const Carousel=loadTutor('TutorPipelineCarousel.tsx').default;
const cards=[
  {id:0,stage:'MEM',badge:'MEM',status:'메모리 접근',asm:'lw a0, 0x10(sp)',asmLine:4,meaning:'메모리 값을 읽습니다.',observation:{summary:'주소 0x1000에서 값 0x2A를 읽었습니다.'},bubble:false},
  {id:1,stage:'ID',badge:'STL',status:'스톨 발생',asm:'add a1, a0, a2',asmLine:5,cause:'앞선 메모리 읽기가 끝나지 않았습니다.',action:'필요한 값이 준비될 때까지 기다립니다.',bubble:false},
  {id:2,stage:'IF',badge:'BBL',status:'버블',asm:'addi a2, zero, 1',asmLine:6,cause:'분기로 실행 경로가 바뀌었습니다.',action:'취소한 명령어가 결과를 바꾸지 않도록 합니다.',bubble:true},
];
const render=index=>renderToStaticMarkup(createElement(Carousel,{cards,index,historyIndex:3,isUserSelected:false,unmatched:false,onSelect:()=>{}}));

test('pipeline cards separate the current cycle from instruction principles with two tabs',()=>{
  const html=render(0);
  assert.match(html,/tutor-single-card tutor-pipeline-card/);
  assert.equal((html.match(/role="tab"/g)||[]).length,2);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,1);
  assert.equal((html.match(/inert=""/g)||[]).length,2);
  assert.equal((html.match(/role="group"/g)||[]).length,1);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(html,/같은 사이클에서 함께 진행 중인 상황/);
  assert.match(html,/이번 사이클/);
  assert.match(html,/메모리에서 값을 읽는 중/);
  assert.doesNotMatch(html,/>실제 실행<\/button>/);
  assert.match(html,/lw a0, 16\(sp\)/);
  assert.doesNotMatch(html,/0x1000|0x2A/);
});

test('stall and bubble cards retain their badges and show causes and solutions rather than regular stage work',()=>{
  const stall=render(1);
  assert.match(stall,/앞선 메모리 읽기가 끝나지 않았습니다/);
  assert.match(stall,/필요한 값이 준비될 때까지 기다립니다/);
  assert.doesNotMatch(stall,/이 단계에서 하는 일/);
  const bubble=render(2);
  assert.match(bubble,/취소되기 전 명령어/);
  assert.match(bubble,/분기로 실행 경로가 바뀌었습니다/);
  assert.match(bubble,/취소한 명령어가 결과를 바꾸지 않도록 합니다/);
  assert.doesNotMatch(bubble,/이 단계에서 하는 일/);
});

test('the work title describes the current stage rather than repeating the whole instruction',()=>{
  const store={...cards[0],asm:'sw a0, 16(sp)',meaning:'레지스터의 값을 메모리에 저장합니다.'};
  for(const [stage,title] of [
    ['EX','메모리에 접근할 주소를 계산하는 중'],
    ['MEM','메모리에 값을 저장하는 중'],
    ['WB','레지스터 기록 없이 명령어를 마무리하는 중'],
  ]){
    const html=renderToStaticMarkup(createElement(Carousel,{cards:[{...store,stage}],index:0,historyIndex:3,isUserSelected:false,unmatched:false,onSelect:()=>{}}));
    assert.match(html,new RegExp(title));
  }
});

test('the context strip preserves card order including stalls, bubbles and repeated stages',()=>{
  const situations=[
    {...cards[0],id:10,stage:'WB',badge:'WB'},
    {...cards[0],id:11,stage:'MEM',badge:'MEM'},
    {...cards[1],id:12,stage:'ID',badge:'STL'},
    {...cards[1],id:13,stage:'IF',badge:'STL'},
    {...cards[2],id:14,stage:'ID',badge:'BBL'},
  ];
  for(let index=0;index<situations.length;index++){
    const html=renderToStaticMarkup(createElement(Carousel,{cards:situations,index,historyIndex:3,isUserSelected:false,unmatched:false,onSelect:()=>{}}));
    const buttons=[...html.matchAll(/<button[^>]*class="tutor-pipeline-context-button"[^>]*>/g)].map(([tag])=>({
      stage:tag.match(/data-stage="([^"]+)"/)[1],
      kind:tag.match(/data-kind="([^"]+)"/)[1],
      selected:tag.includes('aria-pressed="true"'),
    }));
    assert.deepEqual(buttons.map(b=>b.stage),situations.map(card=>card.stage));
    assert.deepEqual(buttons.map(b=>b.kind),situations.map(card=>card.badge));
    assert.deepEqual(buttons.map(b=>b.selected),situations.map((_,position)=>position===index));
  }
});

test('stall and bubble context buttons use plain event labels without nested shapes or borders',()=>{
  const situations=[{...cards[1],stage:'ID',badge:'STL'},{...cards[2],stage:'EX',badge:'BBL'}];
  const html=renderToStaticMarkup(createElement(Carousel,{cards:situations,index:0,historyIndex:3,isUserSelected:false,unmatched:false,onSelect:()=>{}}));
  const buttons=[...html.matchAll(/<button[^>]*class="tutor-pipeline-context-button"[^>]*>([\s\S]*?)<\/button>/g)].map(([,inner])=>inner);
  assert.equal(buttons.length,2);
  assert.equal(buttons[0],'STL');
  assert.equal(buttons[1],'BBL');
});
