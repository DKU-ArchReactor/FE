import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTutor} from './load-tutor-component.mjs';

const {tutorWheelDistance}=loadTutor('../utils/tutorScroll.ts');

test('wheel notches move a smaller bounded distance in both directions',()=>{
  assert.equal(tutorWheelDistance(100,0,400),64);
  assert.equal(tutorWheelDistance(-100,0,400),-64);
  assert.equal(tutorWheelDistance(60,0,400),39);
  assert.equal(tutorWheelDistance(1000,0,400),64);
});

test('line and page wheel events do not jump the whole tutor panel',()=>{
  assert.equal(tutorWheelDistance(3,1,400,20),39);
  assert.equal(tutorWheelDistance(1,2,400),64);
  assert.equal(tutorWheelDistance(-1,2,400),-64);
});

test('small precise trackpad movements and zero movement are preserved',()=>{
  for(const delta of [0,0.5,2,-2,10,-10])assert.equal(tutorWheelDistance(delta,0,400),delta);
});
