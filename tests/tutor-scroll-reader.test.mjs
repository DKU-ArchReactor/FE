import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTutor} from './load-tutor-component.mjs';

const {TutorScrollReader}=loadTutor('TutorDetailReader.tsx');
const {tutorSectionPages}=loadTutor('../utils/tutorReadingSections.ts');

test('a long section remains one complete page with arrows to the next section',()=>{
  const long='문장을 페이지 중간에서 자르지 않습니다. '.repeat(80);
  const sections=[
    {title:'첫 번째 설명',blocks:[{text:long}]},
    {title:'다음 설명',blocks:[{label:'메모리 주소',text:'0x10000'}]},
  ];
  const pages=tutorSectionPages(sections);
  assert.equal(pages.length,2);
  assert.equal(pages[0].blocks[0].text.split('문장을 페이지 중간에서 자르지 않습니다.').length-1,80);
  assert.equal(pages[1].blocks[0].text,'65536');
  const html=renderToStaticMarkup(createElement(TutorScrollReader,{sections}));
  assert.match(html,/data-section-scroll="true"/);
  assert.equal(html.split('문장을 페이지 중간에서 자르지 않습니다.').length-1,80);
  assert.match(html,/첫 번째 설명/);
  assert.doesNotMatch(html,/<h3>다음 설명/);
  assert.match(html,/1 \/ 2/);
  assert.match(html,/tutor-reader-arrows/);
  assert.match(html,/aria-label="다음 설명"/);
});

test('question, answer and reference stay in one scrollable reading area',()=>{
  const html=renderToStaticMarkup(createElement(TutorScrollReader,{sections:[
    {title:'확인해 보기',blocks:[
      {label:'질문',kind:'question',text:'어떤 값이 바뀔까요?'},
      {label:'답변',kind:'answer',text:'메모리의 내용이 바뀝니다.'},
      {text:'참고 자료',href:'https://example.com/0x10000'},
    ]},
  ]}));
  assert.match(html,/data-kind="question"/);
  assert.match(html,/data-kind="answer"/);
  assert.match(html,/어떤 값이 바뀔까요/);
  assert.match(html,/메모리의 내용이 바뀝니다/);
  assert.match(html,/href="https:\/\/example.com\/0x10000"/);
});
