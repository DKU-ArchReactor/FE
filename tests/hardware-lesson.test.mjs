import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/pages/Main/utils/hardwareLesson.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {adderBits,aluLesson,binaryWord}=exports;
const hex=n=>`0x${(n>>>0).toString(16).padStart(8,'0')}`;
test('full-adder teaching model matches all eight input truth-table cases',()=>{
  for(const a of [0,1])for(const b of [0,1])for(const carry of [0,1]) {
    const bit=adderBits(hex(a*2+carry),hex(b*2+carry))[1],total=a+b+carry;
    assert.equal(bit.carryIn,carry);assert.equal(bit.sum,total%2);assert.equal(bit.carryOut,Math.floor(total/2));
  }
});
test('carry model keeps all lower bits and subtraction borrows through complement plus one',()=>{
  for(const [a,b,subtract,expected,carry] of [[11,7,false,18,0],[0xffffffff,1,false,0,1],[0x7fffffff,1,false,0x80000000,0],[0,1,true,0xffffffff,0],[5,3,true,2,1]]) {
    const bits=adderBits(hex(a),hex(b),subtract);
    assert.equal(bits.reduce((sum,bit)=>sum+bit.sum*2**bit.index,0),expected);
    assert.equal(bits[31].carryOut,carry);
  }
  assert.equal(adderBits(undefined,'0x00000001'),undefined);
});
test('hardware explanations distinguish adder, logic, shifter, comparison, LUI and environment',()=>{
  const categories={add:'adder',sub:'adder',lw:'adder',sw:'adder',and:'logic',xor:'logic',srai:'shift',sll:'shift',bltu:'compare',sltiu:'compare',lui:'pass',ecall:'environment',div:'multiply-divide',jal:'pc-target',jalr:'pc-target',unknown:'other'};
  for(const [op,expected] of Object.entries(categories))assert.equal(aluLesson({op,load:op==='lw',store:op==='sw',branch:op==='bltu',system:op==='ecall'}).category,expected);
  assert.equal(binaryWord('0x80000001'),'10000000 00000000 00000000 00000001');
  assert.equal(binaryWord(undefined),undefined);
});
