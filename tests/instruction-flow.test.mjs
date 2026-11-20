import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/instructionFlow.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports});
const {buildInstructionFlow,instructionTransfers,transferPoint,instructionPaths,transferTimeline,instructionFlowDuration} = exports;
const {instructionFields,instructionCycleForPc} = exports;
const {immediateField,transferMotion}=exports;
const item = (op, reads, writes) => ({pc: '0x10000', text: `${op} a0,a1,a2`, explanation: {opcode: op, reads, writes}});
const frame = (op = 'add') => ({clock: 0, buffers: {}, cycle_events: {runtime_error: {has_error: false}},
  global_result: {registers: {x10: '0x0000000C'}, metrics: {accumulated_instructions: 1}},
  datapath: {pc: '0x00010000', next_pc: '0x10004', alu: {input_1: '0x00000005', input_2: '0x00000007', result: '0x0000000C'},
    registers: {rs1: {name: 'a1', num: 11, value: '0x00000005'}, rs2: {name: 'a2', num: 12, value: '0x00000007'}, rd: {num: 10, write_data: '0x0000000C'}},
    instruction: {op}, control_signals: {reg_write: true}, data_memory: {}}});
const simulation = current => ({simulator: {mode: 'single'}, initial_state: {registers: {}, metrics: {accumulated_instructions: 0}}, history: [current]});

test('Imm Gen receives packed instruction fields with a visible route rather than a stationary full word',()=>{
  for(const [raw,value,width] of [['0xFFC42783','0xFFC',12],['0x00642223','0x4',12],['0x80000537','0x80000',20],['0x008000EF','0x800',20]]) {
    assert.equal(immediateField(raw).value,value);assert.equal(immediateField(raw).width,width);
  }
  assert.equal(immediateField('0x00F707B3'),undefined);assert.equal(immediateField(undefined),undefined);
  const current=frame('lw');current.datapath.instruction.raw='0xFFC42783';
  const flow=buildInstructionFlow(item('lw',['x8'],['x15']),current,null,simulation(current));
  const transfers=instructionTransfers(flow),index=transfers.findIndex(t=>t.id==='decode-immediate');
  const route=transferTimeline(transfers,instructionPaths(flow),9000)[index];
  assert.equal(transfers[index].value,'0xFFC');assert.ok(route.motion.distance>100);
});

test('real RV32 encodings decode R/I/S/B/U/J fields, negative offsets and shift funct bits', () => {
  const cases = [
    ['0x00F707B3', {format:'R',rd:15,rs1:14,rs2:15,funct7:'0000000'}],
    ['0xFFC42783', {format:'I',rd:15,rs1:8,immediate:-4}],
    ['0xFEF42E23', {format:'S',rs1:8,rs2:15,rd:undefined,immediate:-4}],
    ['0x00F71463', {format:'B',rs1:14,rs2:15,rd:undefined,immediate:8}],
    ['0x80000537', {format:'U',rd:10,rs1:undefined,immediate:-2147483648}],
    ['0x008000EF', {format:'J',rd:1,rs1:undefined,immediate:8}],
    ['0x4025D513', {format:'I',rd:10,rs1:11,shamt:2,funct7:'0100000'}],
  ];
  for(const [raw, expected] of cases)for(const [field,value] of Object.entries(expected))assert.equal(instructionFields(raw)[field],value,`${raw} ${field}`);
  for(const invalid of [undefined,'not available','0x1','0xFFFFFFFF'])assert.equal(instructionFields(invalid),undefined);
});

test('decode and next-PC routes have real functional owners instead of treating CU as an address source', () => {
  const current=frame(), flow=buildInstructionFlow(item('bne',['x11','x12'],[]),current,null,simulation(current));
  const transfers=instructionTransfers(flow);
  assert.equal(transfers.find(t=>t.id==='fetch-instruction').target,'decoder');
  assert.equal(transfers.find(t=>t.id==='read-control').source,'decoder');
  assert.equal(transfers.find(t=>t.id==='next-pc').source,'pc-select');
  assert.equal(transfers.find(t=>t.id==='branch-decision').source,'alu');
  assert.ok(transfers.findIndex(t=>t.id==='pc-input')<transfers.findIndex(t=>t.id==='calculate'));
  assert.ok(transfers.findIndex(t=>t.id==='calculate')<transfers.findIndex(t=>t.id==='branch-decision'));
});

test('JALR uses the register base and immediate before PC calculation without presenting an ALU placeholder as its target',()=>{
  const current=frame('jalr');current.datapath.alu.result='0x00000000';current.datapath.immediate={dec:8};
  const transfers=instructionTransfers(buildInstructionFlow(item('jalr',['x11'],['x1']),current,null,simulation(current)));
  const calc=transfers.findIndex(t=>t.id==='calculate');
  assert.equal(transfers[calc].source,'pc-select');
  assert.ok(transfers.findIndex(t=>t.id==='pc-base')<calc);
  assert.ok(transfers.findIndex(t=>t.id==='pc-immediate')<calc);
  assert.ok(!transfers.some(t=>t.id==='pc-alu'||t.id==='mux-to-alu'));
  assert.equal(transfers.find(t=>t.id==='pc-base').value,'0x00000005');
});

test('all alternative physical connections remain fixed across instruction classes',()=>{
  const current=frame();let expected;
  for(const op of ['add','lw','sw','jal','auipc','bne']) {
    const paths=instructionPaths(buildInstructionFlow(item(op,[],[]),current,null,simulation(current)));
    const fixed=Object.fromEntries(Object.entries(paths).filter(([key])=>!['input-a','input-b','result-to-mux'].includes(key)));
    if(expected)assert.equal(JSON.stringify(fixed),JSON.stringify(expected));else expected=fixed;
  }
});

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
  const registerShift=instructionTransfers(buildInstructionFlow(item('sra',['x11','x12'],['x10']),current,null,simulation(current)));
  assert.equal(registerShift.find(value=>value.id==='input-b').value,'0x00000402');
  assert.equal(registerShift.find(value=>value.id==='mux-to-alu').value,'0x00000402');
  const system=instructionTransfers(buildInstructionFlow(item('ecall',[],[]),current,null,simulation(current)));
  assert.ok(system.some(value=>value.id==='environment'));
  assert.ok(system.every(value=>value.id!=='memory-address'&&value.id!=='calculate'));
  const jump=instructionTransfers(buildInstructionFlow(item('jal',[],['x1']),current,null,simulation(current)));
  assert.equal(jump.find(value=>value.id==='result-to-mux').source,'pc-select');
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


test('short connections stay readable and long returns use a bounded quicker schedule',()=>{
  const current=frame();
  for(const op of ['add','lw','sw','bne','ecall']) {
    const flow=buildInstructionFlow(item(op,['x11','x12'],['x10']),current,null,simulation(current));
    const transfers=instructionTransfers(flow);
    const timeline=transferTimeline(transfers,instructionPaths(flow),9000);
    for(const entry of timeline) {
      if(transfers[timeline.indexOf(entry)].id==='calculate')assert.ok(entry.duration>=300&&entry.duration<=600);else assert.ok(entry.duration>=840-1e-9);
      assert.ok(entry.duration<=2200);
      if(entry.motion.route) assert.ok(entry.travel>=1050-1e-9);
    }
    assert.ok(Math.abs(instructionFlowDuration(flow,9000)-timeline.at(-1).start-timeline.at(-1).duration)<1e-9);
    const input=timeline[transfers.findIndex(transfer=>transfer.id==='input-a')];
    if(input&&!flow.pcRelative) assert.ok(input.duration>=1200&&input.duration<=2200);
    for(const [index,transfer] of transfers.entries()) if(transfer.kind==='control') assert.equal(timeline[index].travel>0,Boolean(instructionPaths(flow)[transfer.id]));
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
  assert.equal(transfers[decode].source,'decoder');
  const normal=instructionTransfers(buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current)));
  assert.ok(!normal.some(value=>value.id==='decode-immediate'));
});


test('ALU input B goes through both sides of the input MUX',()=>{
  const current=frame();
  const transfers=instructionTransfers(buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current)));
  const input=transfers.findIndex(value=>value.id==='input-b');
  assert.equal(transfers[input].target,'operand-mux');
  assert.equal(transfers[input+1].id,'mux-to-alu');
  assert.equal(transfers[input+1].source,'operand-mux');
  assert.equal(transfers[input+1].value,transfers[input].value);
});


test('a short input MUX link has real travel distance instead of a stationary midpoint',()=>{
  const current=frame();
  const flow=buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current));
  const transfers=instructionTransfers(flow);
  const timeline=transferTimeline(transfers,instructionPaths(flow),9000);
  assert.ok(timeline[transfers.findIndex(value=>value.id==='mux-to-alu')].motion.distance>20);
});


test('the same packet joins both sides of each MUX without jumping',()=>{
  const current=frame('lw');
  for(const op of ['add','lw']) {
    const flow=buildInstructionFlow(item(op,['x11','x12'],['x10']),current,null,simulation(current));
    const transfers=instructionTransfers(flow),paths=instructionPaths(flow);
    const timeline=transferTimeline(transfers,paths,9000);
    for(const [before,after] of [['input-b','mux-to-alu'],[op==='lw'?'load-data':'result-to-mux','writeback']]) {
      const a=timeline[transfers.findIndex(value=>value.id===before)].motion;
      const b=timeline[transfers.findIndex(value=>value.id===after)].motion;
      assert.deepEqual(JSON.parse(JSON.stringify(transferPoint(paths[before],1,a.startPadding,a.endPadding))),JSON.parse(JSON.stringify(transferPoint(paths[after],0,b.startPadding,b.endPadding))));
    }
  }
});


test('memory address words keep visible travel on wide and compact paths',()=>{
  const current=frame('lw');
  const flow=buildInstructionFlow(item('lw',['x11'],['x10']),current,null,simulation(current));
  const transfer=instructionTransfers(flow).find(value=>value.id==='memory-address');
  for(const compact of [false,true]) {
    const path=instructionPaths(flow,1,compact)['memory-address'];
    const motion=transferMotion({...transfer,value:'0x7FFFFFFC'},path);
    assert.ok(motion.distance>150);
    const first=transferPoint(path,0,motion.startPadding,motion.endPadding);
    const last=transferPoint(path,1,motion.startPadding,motion.endPadding);
    assert.ok(Math.hypot(first.x-last.x,first.y-last.y)>100);
  }
});


test('input MUX output reaches the slanted ALU boundary and keeps space outside the widened MUX',()=>{
  const current=frame();
  const flow=buildInstructionFlow(item('add',['x11','x12'],['x10']),current,null,simulation(current));
  const transfer=instructionTransfers(flow).find(value=>value.id==='mux-to-alu');
  for(const scale of [1,1.35]) {
    const path=instructionPaths(flow,1,false,scale)['mux-to-alu'];
    const end=transferPoint(path,1);
    const fraction=(end.y-625*scale)/(205*scale);
    assert.ok(fraction>0&&fraction<1);
    assert.ok(end.x>=710+24*fraction&&end.x<=1010-24*fraction);
    assert.match(path,/H690/);
    assert.ok(transferMotion({...transfer,value:'0x80000000'},path).distance>200);
  }
});


test('ASM selection uses an execution occurrence, never the source row number',()=>{
 const history=[{datapath:{pc:'0x1000'}},{datapath:{pc:'0x2000'}},{datapath:{pc:'0x2000'}},{datapath:{pc:'0x100C'}}];
 assert.equal(instructionCycleForPc(history,'0x2000',1),2);
 assert.equal(instructionCycleForPc(history,'0x2000',2),2);
 assert.equal(instructionCycleForPc(history,'0x2000',3),3);
 assert.equal(instructionCycleForPc(history,'0x2000',4),2);
 assert.equal(instructionCycleForPc(history,'0x100C',1),4);
 assert.equal(instructionCycleForPc(history,'0x3000',1),undefined);
 assert.equal(instructionCycleForPc(history,'not-a-pc',1),undefined);
});
