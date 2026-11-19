import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/instructionFlow.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports});
const {buildInstructionFlow,instructionTransfers,transferPoint,instructionPaths,transferTimeline,instructionFlowDuration} = exports;
const item = (op, reads, writes) => ({pc: '0x10000', text: `${op} a0,a1,a2`, explanation: {opcode: op, reads, writes}});
const frame = (op = 'add') => ({clock: 0, buffers: {}, cycle_events: {runtime_error: {has_error: false}},
  global_result: {registers: {x10: '0x0000000C'}, metrics: {accumulated_instructions: 1}},
  datapath: {pc: '0x00010000', next_pc: '0x10004', alu: {input_1: '0x00000005', input_2: '0x00000007', result: '0x0000000C'},
    registers: {rs1: {name: 'a1', num: 11, value: '0x00000005'}, rs2: {name: 'a2', num: 12, value: '0x00000007'}, rd: {num: 10, write_data: '0x0000000C'}},
    instruction: {op}, control_signals: {reg_write: true}, data_memory: {}}});
const simulation = current => ({simulator: {mode: 'single'}, initial_state: {registers: {}, metrics: {accumulated_instructions: 0}}, history: [current]});

test('CORE clock zero is a real observed frame and num/write_data fields are read', () => {
  const current = frame();
  const flow = buildInstructionFlow(item('add', ['x11', 'x12'], ['x10']), current, null, simulation(current));
  assert.equal(flow.actual, true);
  assert.equal(flow.completed, true);
  assert.equal(flow.registerInputs[0].value, '0x00000005');
  assert.equal(flow.writeValue, '0x0000000C');
  assert.equal(flow.nextPc, '0x10004');
});

test('manual selection, reset snapshot and pipeline never borrow this frame values', () => {
  const current = frame();
  const other = {...item('add', ['x11'], ['x10']), pc: '0x10004'};
  for (const [selected, snapshot, run] of [[other, current, simulation(current)],
    [item('add', ['x11'], ['x10']), {...current}, simulation(current)],
    [item('add', ['x11'], ['x10']), current, {...simulation(current), simulator: {mode: 'pipeline'}}]]) {
    const flow = buildInstructionFlow(selected, snapshot, null, run);
    assert.equal(flow.actual, false);
    assert.equal(flow.input1, undefined);
    assert.equal(flow.writeValue, undefined);
    assert.equal(flow.registerInputs[0].value, undefined);
  }
});

test('byte store shows only written low bits and has no register writeback', () => {
  const current = frame('sb');
  current.datapath.data_memory = {address: '0x2000', write_data: '0xFFFFFFFE'};
  const flow = buildInstructionFlow(item('sb', ['x11', 'x12'], []), current, null, simulation(current));
  assert.equal(flow.width, 8);
  assert.equal(flow.memoryValue, '0xfe');
  assert.equal(flow.writeValue, undefined);
  assert.ok(flow.steps.find(step => step.id === 'memory').routes.includes('store'));
  assert.ok(!flow.steps.at(-1).routes.includes('writeback'));
});

test('load to x0 still accesses memory and never records its read value in x0', () => {
  const current = frame('lw');
  current.datapath.data_memory = {address: '0x2000', read_data: '0xFFFFFFFE'};
  const flow = buildInstructionFlow(item('lw', ['x11'], []), current, null, simulation(current));
  assert.equal(flow.memoryValue, '0xFFFFFFFE');
  assert.equal(flow.writeValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('load'));
});

test('faults cannot turn decoded reg_write into a committed register value', () => {
  const current = frame('lw');
  current.cycle_events.runtime_error = {has_error: true, message: 'unaligned'};
  current.datapath.data_memory = {address: '0x2001', read_data: '0x00000000'};
  const flow = buildInstructionFlow(item('lw', ['x11'], ['x10']), current, null, simulation(current));
  assert.equal(flow.completed, false);
  assert.equal(flow.writeValue, undefined);
  assert.equal(flow.memoryValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('load'));
});

test('SRAI masks the encoded input, ECALL skips ALU and JAL separates link data', () => {
  const current = frame('srai');
  current.datapath.alu.input_2 = '0x00000402';
  const flow = buildInstructionFlow(item('srai', ['x11'], ['x10']), current, null, simulation(current));
  assert.equal(flow.amount, 2);
  const system = buildInstructionFlow(item('ecall', [], []), current, null, simulation(current));
  assert.ok(system.steps.every(step => step.id !== 'execute'));
  const jump = buildInstructionFlow(item('jal', [], ['x1']), current, null, simulation(current));
  assert.ok(jump.steps.at(-1).routes.includes('link'));
  assert.ok(!jump.steps.at(-1).routes.includes('writeback'));
});

test('branch keeps comparison inputs separate from its PC offset and has no register result', () => {
  const current = frame('bne');
  current.datapath.immediate = {dec: -8, value: '0xFFFFFFF8'};
  current.cycle_events.control_hazard = {taken: true};
  const flow = buildInstructionFlow(item('bne', ['x11', 'x12'], []), current, null, simulation(current));
  assert.equal(flow.immediate, -8);
  assert.equal(flow.taken, true);
  assert.equal(flow.branch, true);
  assert.equal(flow.usesImmediate, false); // ALU compares registers; offset is a separate PC input.
  assert.equal(flow.writeValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('writeback'));
});

test('transfer payloads preserve operands, computed result and architectural writeback separately',()=>{
  const current=frame();
  const transfers=instructionTransfers(buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current)));
  const byId=Object.fromEntries(transfers.map(value=>[value.id,value]));
  assert.equal(byId['input-a'].value,'0x00000005');
  assert.equal(byId['input-b'].value,'0x00000007');
  assert.equal(byId.calculate.value,'0x0000000C');
  assert.equal(byId.writeback.value,'0x0000000C');
  assert.equal(byId['input-a'].systemBus,undefined);
  assert.equal(byId['fetch-address'].systemBus,true);
});

test('memory transfers do not invent successful reads after a fault or write x0',()=>{
  const current=frame('lw');current.datapath.data_memory={address:'0x2000',read_data:'0xFFFFFFFE'};
  let transfers=instructionTransfers(buildInstructionFlow(item('lw',['x11'],[]),current,null,simulation(current)));
  assert.ok(transfers.some(value=>value.id==='discard-load'&&value.value==='0xFFFFFFFE'));
  assert.ok(transfers.every(value=>value.id!=='load-data'&&value.id!=='writeback'));
  current.cycle_events.runtime_error={has_error:true};
  transfers=instructionTransfers(buildInstructionFlow(item('lw',['x11'],['x10']),current,null,simulation(current)));
  assert.ok(transfers.every(value=>value.id!=='load-data'&&value.id!=='discard-load'&&value.id!=='writeback'));
});

test('store, ECALL, jump and shift transfers keep their distinct meanings',()=>{
  const current=frame();current.datapath.alu.input_2='0x00000402';
  const shift=instructionTransfers(buildInstructionFlow(item('srai',['x11'],['x10']),current,null,simulation(current)));
  assert.equal(shift.find(value=>value.id==='input-b').value,'2');
  const system=instructionTransfers(buildInstructionFlow(item('ecall',[],[]),current,null,simulation(current)));
  assert.ok(system.some(value=>value.id==='environment'));
  assert.ok(system.every(value=>value.id!=='memory-address'&&value.id!=='calculate'));
  const jump=instructionTransfers(buildInstructionFlow(item('jal',[],['x1']),current,null,simulation(current)));
  assert.equal(jump.find(value=>value.id==='result-to-mux').source,'pc');
  assert.equal(jump.find(value=>value.id==='writeback').source,'mux');
  const store=instructionTransfers(buildInstructionFlow(item('sw',['x11','x12'],[]),current,null,simulation(current)));
  assert.ok(store.some(value=>value.id==='store-data'&&value.source==='registers'&&value.target==='memory'));
  assert.ok(store.every(value=>value.id!=='writeback'));
});

test('packet geometry advances along the same orthogonal wire and clamps endpoints',()=>{
  const point=(progress)=>JSON.parse(JSON.stringify(transferPoint('M10 20H30V60',progress)));
  assert.deepEqual(point(-1),{x:10,y:20});
  assert.deepEqual(point(.5),{x:30,y:30});
  assert.deepEqual(point(2),{x:30,y:60});
  assert.deepEqual(JSON.parse(JSON.stringify(transferPoint('M0 0H100',0,20,20))),{x:20,y:0});
  assert.deepEqual(JSON.parse(JSON.stringify(transferPoint('M0 0H100',1,20,20))),{x:80,y:0});
});


test('long returns cannot travel faster than the reference register input and memory steps retain reading time',()=>{
  const current=frame();
  for(const op of ['add','lw','sw','bne','ecall']) {
    const flow=buildInstructionFlow(item(op,['x11','x12'],['x10']),current,null,simulation(current));
    const transfers=instructionTransfers(flow);
    const timeline=transferTimeline(transfers,instructionPaths(flow),9000);
    for(const entry of timeline) {
      assert.ok(entry.duration>=1600-1e-9);
      if(entry.motion.route) assert.ok(entry.motion.distance/entry.travel <= 195/1400+1e-9);
    }
    assert.ok(Math.abs(instructionFlowDuration(flow,9000)-timeline.at(-1).start-timeline.at(-1).duration)<1e-9);
    const input=timeline[transfers.findIndex(transfer=>transfer.id==='input-a')];
    if(input&&!flow.pcRelative) assert.equal(input.duration,1600);
    for(const [index,transfer] of transfers.entries()) if(transfer.kind==='control') assert.equal(timeline[index].travel,0);
  }
});

test('a load reaches the MUX before the register write is shown',()=>{
  const current=frame('lw');
  const flow=buildInstructionFlow(item('lw',['x11'],['x10']),current,null,simulation(current));
  const transfers=instructionTransfers(flow);
  const memory=transfers.findIndex(value=>value.id==='load-data');
  assert.equal(transfers[memory].target,'mux');
  assert.equal(transfers[memory+1].id,'writeback');
  assert.equal(transfers[memory+1].source,'mux');
  assert.equal(transfers[memory+1].value,transfers[memory].value);
});

test('immediate formats receive instruction bits before their immediate reaches the ALU',()=>{
  const current=frame('lw');
  const transfers=instructionTransfers(buildInstructionFlow(item('lw',['x11'],['x10']),current,null,simulation(current)));
  const decode=transfers.findIndex(value=>value.id==='decode-immediate');
  assert.ok(decode>0);
  assert.ok(decode<transfers.findIndex(value=>value.id==='input-b'));
  assert.equal(transfers[decode].target,'immediate');
  assert.equal(transfers[decode].source,'memory');
  const normal=instructionTransfers(buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current)));
  assert.ok(!normal.some(value=>value.id==='decode-immediate'));
});
