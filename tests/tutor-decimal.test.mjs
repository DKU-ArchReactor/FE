import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTutor} from './load-tutor-component.mjs';

const {tutorDecimalText, tutorReadingText, tutorRegisterName}=loadTutor('../utils/tutorReadable.ts');

test('tutor addresses, data and instruction immediates display in decimal',()=>{
  assert.equal(tutorDecimalText('PC 0x00010000, lw a0, 0x10(sp), data 0xFFFFFFFF'),
    'PC 65536, lw a0, 16(sp), data 4294967295');
  assert.equal(tutorDecimalText('0X00 -0x10 0x20000000000001'), '0 -16 9007199254740993');
});

test('equivalent decimal and hex pairs collapse while preserving signed values',()=>{
  assert.equal(tutorDecimalText('65536 (0x00010000), -4 (0xFFFFFFFC), 65,536 (0x10000)'),
    '65536, -4, 65,536');
  assert.equal(tutorDecimalText('5 (0x06)'), '5 (6)');
  assert.equal(tutorDecimalText('0xFFFFFFF8(-8), 0x000000FF(255)'), '-8, 255');
});

test('register identifiers, existing decimal values and reference links remain intact',()=>{
  const text='x10 a5 sp 2147479548 https://example.com/0x10000';
  assert.equal(tutorDecimalText(text),text);
  assert.equal(tutorDecimalText('value0xFF'),'value0xFF');
});

test('detail reading uses the same decimal formatting as summary text',()=>{
  assert.equal(tutorReadingText('PC 0x00010004 = 65540 (0x00010004)'), 'PC 65540 = 65540');
});

test('older memory summaries distinguish the location from the stored data',()=>{
  const text=tutorReadingText('주소 2147479544에 65544을 저장했습니다.');
  assert.match(text,/메모리의 2147479544번 위치/);
  assert.match(text,/65544를 저장/);
  assert.match(text,/저장할 위치/);
  assert.match(text,/넣은 데이터/);
});

test('numeric register names include their familiar alias and special role',()=>{
  assert.equal(tutorRegisterName('x2'),'sp (x2 · 스택 위치를 가리키는 주소)');
  assert.equal(tutorRegisterName('x14'),'a4 (x14)');
  assert.equal(tutorRegisterName('-24(s0)'),'-24(s0)');
});

test('code connections name the register and instruction without claiming a runtime dependency',()=>{
  const {tutorInstructionDetails}=loadTutor('../utils/tutorInstructionDetails.ts');
  const item={pc:'0x10004',explanation:{reads:['x2'],writes:[]},teaching:{register_connections:[
    {register:'x2',pc:'0x10000',text:'addi sp, sp, -32'},
  ]}};
  const {pages}=tutorInstructionDetails(item,{asm_instructions:[{pc:'0x10000'}]});
  const text=JSON.stringify(pages);
  assert.match(text,/sp \(x2/);
  assert.match(text,/ASM: L1/);
  assert.match(text,/실제 실행 순서는 달라질 수/);
  assert.doesNotMatch(text,/정적 연결/);
});

test('repeated register operands are distinguished by their written positions',()=>{
  const {tutorInstructionDetails}=loadTutor('../utils/tutorInstructionDetails.ts');
  const item={pc:'0x10000',explanation:{reads:['x2'],writes:['x2']},teaching:{operand_roles:[
    {operand:'sp',role:'계산 후의 결과를 넣는 곳'},
    {operand:'sp',role:'계산 전의 값을 읽는 곳'},
    {operand:'-32',role:'명령어에 직접 적힌 숫자'},
  ]}};
  const blocks=tutorInstructionDetails(item).pages[0].blocks;
  assert.equal(blocks[0].label,'첫 번째 항목 · sp');
  assert.equal(blocks[1].label,'두 번째 항목 · sp');
  assert.equal(blocks[2].label,'세 번째 항목 · -32');
  assert.match(blocks[1].text,/계산 전/);
});

test('code metadata explains file, function and source line without developer abbreviations',()=>{
  const {tutorInstructionDetails}=loadTutor('../utils/tutorInstructionDetails.ts');
  const item={pc:'0x10000',source_file:'source.c',source_line:1,function:'main',mapping_basis:'elf_dwarf',explanation:{}};
  const text=JSON.stringify(tutorInstructionDetails(item).pages);
  assert.match(text,/함수 또는 코드 구역의 이름은 main입니다/);
  assert.match(text,/파일 이름은 source.c입니다/);
  assert.match(text,/1번째 줄/);
  assert.doesNotMatch(text,/CORE|DWARF|ELF/);
});

test('legacy developer wording is translated without renaming source identifiers',()=>{
  assert.equal(tutorReadingText('CORE clock 3'),'실행 클록 3');
  assert.equal(tutorReadingText('ELF 디버그 정보 (DWARF)'),'컴파일할 때 저장한 원본 코드의 줄 위치 정보');
  assert.equal(tutorReadingText('int CORE = 1;'),'int CORE = 1;');
});

test('instruction encoding, PC and observed data all reach the reader as decimal',()=>{
  const {tutorInstructionDetails}=loadTutor('../utils/tutorInstructionDetails.ts');
  const {tutorSectionPages}=loadTutor('../utils/tutorReadingSections.ts');
  const item={pc:'0x10000',raw_instruction:'0xFFFFFFFF',explanation:{},teaching:{principle:'입력 주소 0x2000에서 값 0x2A를 읽습니다.'}};
  const before=JSON.stringify(item);
  const pages=tutorSectionPages(tutorInstructionDetails(item).pages);
  const text=JSON.stringify(pages);
  assert.match(text,/65536/);
  assert.match(text,/8192/);
  assert.match(text,/42/);
  assert.match(text,/기계어 · 10진수/);
  assert.match(text,/4294967295/);
  assert.doesNotMatch(text,/0x[\da-f]+/i);
  assert.equal(JSON.stringify(item),before);
});
