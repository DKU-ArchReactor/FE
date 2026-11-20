import {test, expect, type Page} from '@playwright/test';

async function frozenTime(page: Page) {
  const start=new Date('2026-11-20T00:00:00Z');
  await page.clock.install({time:start}); await page.clock.pauseAt(new Date(start.getTime()+1000));
}
async function pause(page: Page) {await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();}
async function seek(page: Page, id: string) {
  for(let i=0;i<30;i++) {
    if(await page.locator('[data-transfer]').getAttribute('data-transfer')===id)return;
    await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  }
  throw new Error(`Transfer not found: ${id}`);
}

test('instruction completion preserves results and updated PC, clears transfers and replays explicitly',async({page})=>{
  await page.goto('/tests/browser/line-flow.html');await page.waitForLoadState('networkidle');
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');await pause(page);
  await seek(page,'next-pc');
  const next=await page.locator('[data-transfer-value]').textContent();
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();
  await page.clock.runFor(Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'))+50);
  await expect(page.locator('[data-flow-finished]')).toHaveAttribute('data-flow-finished','true');
  await expect(page.locator('[data-transfer]')).toContainText('명령어 처리 완료');
  await expect(page.locator('[data-transfer-value]')).toContainText(next!.split(' · ')[1] ?? next!);
  await expect(page.locator('[data-flow-node="registers"]')).toContainText('18');
  await expect(page.locator('.flow-packet')).toHaveCount(0);
  await expect(page.locator('[data-device-status]')).toHaveCount(0);
  await expect(page.locator('[data-flow-route]')).toHaveCount(0);
  await expect(page.locator('[data-flow-active="true"]')).toHaveCount(0);
  await expect(page.locator('[data-flow-node="pc"]')).toContainText('다음 명령어 주소');
  await expect(page.locator('[data-execution-status]')).toHaveCount(0);
  await page.getByRole('button',{name:'흐름 다시 보기',exact:true}).click();
  await expect(page.locator('[data-flow-finished]')).toHaveAttribute('data-flow-finished','false');
  await expect(page.locator('.flow-packet')).toBeVisible();
});

test('last-cycle global Pause resumes in place and natural completion stops without looping',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?timing=1&execution_status=COMPLETED');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'step',exact:true}).click();
  await page.getByRole('button',{name:'play',exact:true}).click();await page.clock.runFor(300);
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('global-playing')).toHaveText('false');
  await expect(page.getByTestId('timing-clock')).toHaveText('4');
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('4');
  await page.clock.runFor(Number(await page.getByTestId('timing-delay').textContent())+100);
  await expect(page.getByTestId('global-playing')).toHaveText('false');
  await expect(page.locator('[data-flow-finished]')).toHaveAttribute('data-flow-finished','true');
  await expect(page.locator('[data-execution-status="COMPLETED"]')).toContainText('서버 확인');
  await expect(page.locator('.flow-packet')).toHaveCount(0);
  await page.clock.runFor(30000);await expect(page.getByTestId('timing-clock')).toHaveText('4');
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('1');
});

for(const status of ['CYCLE_LIMIT','SIMULATION_ERROR'])test(`program ${status} never displays successful program completion`,async({page})=>{
  await frozenTime(page);await page.goto(`/tests/browser/line-flow.html?execution_status=${status}`);await pause(page);
  await page.getByRole('button',{name:'next clock',exact:true}).click();await pause(page);await seek(page,'next-pc');
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(3000);
  await expect(page.locator('[data-execution-status]')).toHaveAttribute('data-execution-status',status);
  await expect(page.locator('[data-execution-status]')).not.toContainText('프로그램 실행 완료');
});

test('CPU contains its devices, memory is outside, and the architecture fits without scrollbars',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  for(const size of [{width:1400,height:900},{width:760,height:1000},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);await page.clock.runFor(32);
    const svg=page.locator('svg[data-layout]');await expect(svg).toHaveAttribute('data-layout','hardware-architecture');
    expect(await svg.evaluate(svg=>{
      const regions=Object.fromEntries(Array.from(svg.querySelectorAll<SVGRectElement>('[data-hardware-region]')).map(r=>[r.dataset.hardwareRegion,r.getBBox()]));
      return Array.from(svg.querySelectorAll<SVGGElement>('[data-flow-node]')).every(node=>{
        const memory=['instruction-memory','memory'].includes(node.dataset.flowNode!);
        const region=regions[memory?'memory':'cpu'],x=Number(node.dataset.x),y=Number(node.dataset.y),w=Number(node.dataset.width),h=Number(node.dataset.height);
        return x>=region.x&&y>=region.y&&x+w<=region.x+region.width&&y+h<=region.y+region.height;
      });
    })).toBe(true);
    expect(await svg.evaluate(svg=>{
      const region=svg.closest('section')!;
      return Array.from(region.querySelectorAll<HTMLElement>('*')).filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+1).length;
    })).toBe(0);
    for(const kind of ['address','data','control'])await expect(page.locator(`[data-system-bus-label="${kind}"]`)).toBeVisible();
  }
});

test('all device boxes and all available wires stay identical across instruction classes',async({page})=>{
  await frozenTime(page);let expected: unknown;
  for(const op of ['add','lw','sw','bne','jal','ecall']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);await pause(page);
    const topology=await page.locator('svg[data-layout]').evaluate(svg=>({view:svg.getAttribute('viewBox'),
      nodes:Array.from(svg.querySelectorAll<SVGGElement>('[data-flow-node]')).map(n=>[n.dataset.flowNode,n.dataset.x,n.dataset.y,n.dataset.width,n.dataset.height]),
      paths:Array.from(svg.querySelectorAll('[data-circuit-wire]')).map(n=>[n.getAttribute('data-circuit-wire'),n.querySelector('path')!.getAttribute('d')])}));
    if(expected)expect(topology).toEqual(expected);else expected=topology;
  }
});

test('memory panels match and the diagram uses its height without removed controls or footnotes',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');await pause(page);
  for(const size of [{width:1400,height:900},{width:760,height:1000}]) {
    await page.setViewportSize(size);await page.clock.runFor(32);
    const geometry=await page.locator('svg[data-layout]').evaluate(svg=>{
      const first=svg.querySelector<SVGGElement>('[data-flow-node="instruction-memory"]')!,second=svg.querySelector<SVGGElement>('[data-flow-node="memory"]')!;
      const bottom=Math.max(...Array.from(svg.querySelectorAll('[data-hardware-region]')).map(n=>n.getBoundingClientRect().bottom));
      return {equalSize:first.dataset.width===second.dataset.width&&first.dataset.height===second.dataset.height,bottomGap:svg.getBoundingClientRect().bottom-bottom};
    });expect(geometry.equalSize).toBe(true);expect(geometry.bottomGap).toBeLessThan(24);
  }
  await expect(page.locator('[data-connection-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-diagram-bottom]')).toHaveCount(0);
});

test('a load decodes its actual encoded fields, selects registers by fields and sends opcode to CU',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');await pause(page);
  const fields=page.locator('[data-instruction-fields]');await expect(fields).toContainText('I형');await expect(fields).toContainText('opcode 0000011');
  await expect(fields).toContainText('rd x15');await expect(fields).toContainText('rs1 x8');await expect(fields).toContainText('imm -4');
  await seek(page,'decode-control');await expect(page.locator('[data-flow-node="cu"]')).toHaveAttribute('data-flow-active','true');
  await expect(page.locator('[data-flow-node="cu"]')).toContainText('\uC77D\uAE30 1');
  await seek(page,'read-control');await expect(page.locator('[data-flow-node="decoder"]')).toHaveAttribute('data-flow-active','true');
  await expect(page.locator('[data-flow-node="registers"] [data-device-status]')).toHaveAttribute('data-device-status','도착');
  await expect(page.locator('[data-transfer]')).toContainText('rs1·rs2 필드');
});

test('instructions, register alignment and operation labels are explicit without supplementary actions',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');await pause(page);
  await expect(page.locator('[data-current-instruction]')).toContainText('lw a5,-4(s0)');
  await expect(page.getByRole('button',{name:'전체 상태',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'전체 연결 표시 전환',exact:true})).toHaveCount(0);
  const alignment=await page.locator('[data-register-width]').evaluate(text=>{
    const node=text.closest<SVGGElement>('[data-flow-node]')!;
    return text.getAttribute('text-anchor')==='middle'&&Number(text.getAttribute('x'))===Number(node.dataset.x)+Number(node.dataset.width)/2;
  });expect(alignment).toBe(true);
  await expect(page.locator('[data-supplementary-explanations]')).toHaveCount(0);
  await expect(page.locator('[data-cpu-package]')).toBeVisible();
  await expect(page.locator('[data-flow-node="alu"] > text').first()).toHaveText('ALU');
  await seek(page,'decode-immediate');await expect(page.locator('[data-transfer-value]')).toHaveText('0xFFC');
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(250);
  const first=await page.locator('.flow-packet').getAttribute('data-packet-y');await page.clock.runFor(250);expect(await page.locator('.flow-packet').getAttribute('data-packet-y')).not.toBe(first);await pause(page);
  await seek(page,'calculate');await expect(page.locator('[data-flow-node="alu"] [data-device-status]')).toHaveAttribute('data-device-status','주소 계산');
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(550);
  await expect(page.locator('[data-transfer]')).toHaveAttribute('data-transfer','memory-address');await expect(page.locator('.flow-packet')).toBeVisible();
  await expect(page.locator('[data-flow-node="alu"] [data-device-status]')).toHaveAttribute('data-device-status','주소 전달');
});

test('memory address stays visible throughout travel and large MUX words fit; explanations remain screen sized',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw&large=1');await pause(page);
  await seek(page,'memory-address');
  const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();
  for(let i=0;i<48;i++) {
    await page.clock.runFor(duration/50);
    await expect(page.locator('.flow-packet')).toBeVisible();
    await expect(page.locator('.flow-packet')).toHaveAttribute('data-moving-value','0x7FFFFFFC');
    expect(await page.locator('.flow-packet').evaluate(n=>getComputedStyle(n).opacity)).toBe('1');
  }
  await pause(page);await seek(page,'writeback');
  await expect(page.locator('[data-flow-node="mux"]')).toContainText('-2147483648');
  const fit=await page.locator('[data-flow-node="mux"]').evaluate(n=>{
    const x=Number(n.getAttribute('data-x')),w=Number(n.getAttribute('data-width'));
    return [...n.querySelectorAll('text')].filter(t=>!t.closest('[data-device-status]')).every(t=>{const b=t.getBBox();return b.x>=x+18&&b.x+b.width<=x+w-18;});
  });expect(fit).toBe(true);
  for(const width of [1400,760]) {
    await page.setViewportSize({width,height:1000});
    const text=page.locator('[data-operation-description]');await expect(text).toBeVisible();
    expect(await text.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(13);
    expect(await page.locator('main').innerText()).not.toMatch(/\?{2,}|\uFFFD|\\u[0-9a-f]{4}/i);
  }
});

test('actual operands and results remain visible as device inputs and outputs',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');await pause(page);
  await seek(page,'input-a');await expect(page.locator('[data-transfer-value]')).toHaveText('11 · 0x0000000B');
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(300);
  const word=page.locator('[data-moving-value="11"]');await expect(word).toBeVisible();const before=await word.evaluate(p=>[p.getAttribute('data-packet-x'),p.getAttribute('data-packet-y')]);
  await page.clock.runFor(150);expect(await word.evaluate(p=>[p.getAttribute('data-packet-x'),p.getAttribute('data-packet-y')])).not.toEqual(before);await pause(page);
  await seek(page,'input-b');await expect(page.locator('[data-transfer-value]')).toHaveText('7 · 0x00000007');
  await seek(page,'calculate');await expect(page.locator('[data-transfer-value]')).toHaveText('18 · 0x00000012');
  await expect(page.locator('[data-flow-node="alu"]')).toContainText('\uAC00\uC0B0\uAE30');
});

test('register shifts transport the register word and immediate shifts transport shamt',async({page})=>{
  await frozenTime(page);
  for(const op of ['sra','srai']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);await pause(page);await seek(page,'input-b');
    await expect(page.locator('[data-transfer-value]')).toContainText(op==='sra'?'1026':'2');
    await seek(page,'calculate');await expect(page.locator('[data-flow-node="alu"]')).toContainText('2비트 이동');
    if(op==='srai')await expect(page.locator('[data-instruction-fields]')).toContainText('shamt 2');
  }
});

test('large hardware details show real addition, selectable carry bits, PC components and instruction decoding',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');await pause(page);
  await page.getByRole('button',{name:'ALU 역할과 동작 보기',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('[data-numeric-equation]')).toContainText('11 + 7 → 18');
  await expect(dialog).toContainText('전가산기');await page.getByLabel('가산기 비트 구간').selectOption('1');await expect(dialog.getByRole('columnheader',{name:'15',exact:true})).toBeVisible();
  await dialog.getByText('전가산기 한 개 자세히',{exact:true}).click();await page.getByLabel('전가산기 비트 선택').selectOption('1');
  await expect(dialog.locator('[data-full-adder]')).toContainText('1 XOR 1 XOR 1 = 1');await expect(dialog.locator('[data-full-adder]')).toContainText('2번 자리로 전달');
  expect(await dialog.locator('[data-alu-formula]').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(24);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'PC 가산·선택 역할과 동작 보기',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('PC 선택 MUX');await expect(page.getByRole('dialog')).toContainText('0x00010040');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'명령어 해독 역할과 동작 보기',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('funct7');await expect(page.getByRole('dialog')).toContainText('x14');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-flow-playing]')).toHaveAttribute('data-flow-playing','false');
});

test('jump address explanation keeps CORE ALU placeholders separate from real PC inputs',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=jalr');await pause(page);
  await seek(page,'pc-base');await expect(page.locator('[data-transfer-value]')).toContainText('0x0001003C');
  await seek(page,'calculate');await expect(page.locator('[data-flow-node="pc-select"]')).toHaveAttribute('data-flow-active','true');
  await expect(page.locator('[data-flow-node="alu"]')).toHaveAttribute('data-flow-active','false');
  await page.getByRole('button',{name:'ALU 역할과 동작 보기',exact:true}).click();await expect(page.getByRole('dialog').locator('[data-numeric-equation]')).toHaveCount(0);await expect(page.getByRole('dialog')).toContainText('PC 주소 연산');
});

test('reference store example distinguishes the ALU address from the register data on its buses',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=sw');await pause(page);
  await expect(page.locator('[data-flow-node="registers"]')).toContainText('t1:');await expect(page.locator('[data-flow-node="registers"]')).toContainText('s0:');
  await expect(page.locator('[data-flow-node="alu"]')).toContainText('s0 + 4');
  await seek(page,'memory-address');await expect(page.locator('[data-transfer-value]')).toHaveText('0x00002004');await expect(page.locator('[data-transfer]')).toContainText('Address Bus');
  await seek(page,'store-data');await expect(page.locator('[data-transfer-value]')).toHaveText('305419896 · 0x12345678');await expect(page.locator('[data-transfer]')).toContainText('t1');await expect(page.locator('[data-transfer]')).toContainText('Data Bus');
  await page.getByRole('button',{name:'ALU 역할과 동작 보기',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('주소와 데이터의 구분')).toContainText('0x00002004');await expect(dialog.getByLabel('주소와 데이터의 구분')).toContainText('0x12345678');
});

test('load and store use distinct bus directions; arithmetic does not access data memory',async({page})=>{
  await frozenTime(page);
  for(const op of ['add','lw','sw','ecall']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);await pause(page);const seen:string[]=[];
    for(let i=0;i<30;i++) {
      seen.push(await page.locator('[data-transfer]').getAttribute('data-transfer')??'');
      const next=page.getByRole('button',{name:'다음 흐름',exact:true});if(await next.isDisabled())break;await next.click();
    }
    if(op==='lw'||op==='sw') {expect(seen).toContain('memory-address');expect(seen).toContain('memory-control');expect(seen).toContain(op==='lw'?'load-data':'store-data');}
    else {expect(seen).not.toContain('memory-address');expect(seen).not.toContain('load-data');expect(seen).not.toContain('store-data');}
    if(op==='sw'||op==='ecall')expect(seen).not.toContain('writeback');
  }
});

test('all visible device text stays in its box and in the view at every instruction action',async({page})=>{
  await frozenTime(page);
  for(const op of ['add','lw','sw','bne','jal','ecall']) for(const size of [{width:1400,height:900},{width:760,height:1000}]) {
    await page.setViewportSize(size);await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);await pause(page);
    for(let i=0;i<30;i++) {
      const issues=await page.locator('svg[data-layout]').evaluate(svg=>{
        const issues:string[]=[];
        for(const node of svg.querySelectorAll<SVGGElement>('[data-flow-node]')) {
          const x=Number(node.dataset.x),y=Number(node.dataset.y),w=Number(node.dataset.width),h=Number(node.dataset.height);
          for(const text of node.querySelectorAll<SVGTextElement>('text')) {
            if(text.closest('[data-device-status]')||text.getAttribute('opacity')==='0')continue;
            const b=text.getBBox();if(b.x<x+3||b.y<y+3||b.x+b.width>x+w-3||b.y+b.height>y+h-3)issues.push(`${node.dataset.flowNode}: ${text.textContent}`);
          }
        }
        return issues;
      });
      expect(issues,op).toEqual([]);
      const next=page.getByRole('button',{name:'다음 흐름',exact:true});if(await next.isDisabled())break;await next.click();
    }
  }
});

for(const size of [{width:1400,height:900},{width:760,height:1000}]) {
test(`moving values stay on wire and inside capsule/canvas at ${size.width}px`,async({page})=>{
  test.setTimeout(60000);
  await frozenTime(page);await page.setViewportSize(size);
  for(const op of ['add','lw','sw','bne','jal']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);await pause(page);
    for(let step=0;step<30;step++) {
      const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
      await page.getByRole('button',{name:'흐름 재생',exact:true}).click();
      for(let sample=0;sample<9;sample++) {
        await page.clock.runFor(duration/12);
        const issues=await page.evaluate(()=>{
          const p=document.querySelector<SVGGElement>('.flow-packet');if(!p)return [];
          const b=p.querySelector<SVGRectElement>('rect')!.getBBox(),t=p.querySelector<SVGTextElement>('text')!.getBBox(),path=document.querySelector<SVGPathElement>('[data-flow-route] path')!;
          const view=document.querySelector<SVGSVGElement>('svg[data-layout]')!.viewBox.baseVal;
          const x=Number(p.dataset.packetX),y=Number(p.dataset.packetY);let near=false,previous={x:0,y:0};
          for(const [,command,numbers] of path.getAttribute('d')!.matchAll(/([MHV])([^MHV]+)/g)) {
            const values=numbers.trim().split(/[ ,]+/).map(Number);
            const q=command==='M'?{x:values[0],y:values[1]}:command==='H'?{x:values[0],y:previous.y}:{x:previous.x,y:values[0]};
            if(command!=='M'&&x>=Math.min(previous.x,q.x)-.1&&x<=Math.max(previous.x,q.x)+.1&&y>=Math.min(previous.y,q.y)-.1&&y<=Math.max(previous.y,q.y)+.1)near=true;
            previous=q;
          }
          return [!near?'detached':'',Math.abs(b.x+b.width/2-x)>.01||Math.abs(b.y+b.height/2-y)>.01?'off-center':'',t.x<b.x||t.x+t.width>b.x+b.width||t.y<b.y||t.y+t.height>b.y+b.height?'clipped text':'',b.x<view.x||b.y<view.y||b.x+b.width>view.x+view.width||b.y+b.height>view.y+view.height?'outside':''].filter(Boolean);
        });expect(issues,`${op} ${step}`).toEqual([]);
      }
      await pause(page);const next=page.getByRole('button',{name:'다음 흐름',exact:true});if(await next.isDisabled())break;await next.click();
    }
  }
});

}

test('MUXes receive and release the same value at the same point',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');await pause(page);
  for(const [incoming,outgoing,unit] of [['input-b','mux-to-alu','operand-mux'],['load-data','writeback','mux']]) {
    await seek(page,incoming);const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
    await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(duration*.98);await pause(page);
    const read=()=>page.locator('.flow-packet').evaluate(p=>[p.getAttribute('data-packet-x'),p.getAttribute('data-packet-y'),p.getAttribute('data-moving-value')]);
    const before=await read();await expect(page.locator(`[data-flow-node="${unit}"] [data-device-status]`)).toHaveAttribute('data-device-status','도착');
    await page.getByRole('button',{name:'다음 흐름',exact:true}).click();await expect(page.locator('[data-transfer]')).toHaveAttribute('data-transfer',outgoing);
    expect(await read()).toEqual(before);await expect(page.locator(`[data-flow-node="${unit}"] [data-device-status]`)).toHaveAttribute('data-device-status','출발');
  }
});

test('clicking a device opens its own operation and allows replay with the keyboard',async({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');await pause(page);
  const memory=page.getByRole('button',{name:'데이터 메모리 역할과 동작 보기'});await memory.focus();await memory.press('Enter');
  await expect(page.locator('[data-transfer]')).toHaveAttribute('data-transfer','memory-address');
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(350);
  expect(Number(await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed'))).toBeGreaterThan(350);
});

test('compact panels measure before paint and dark mode keeps device values readable',async({page})=>{
  await frozenTime(page);await page.setViewportSize({width:760,height:1000});await page.goto('/tests/browser/line-flow.html');await pause(page);
  await expect(page.locator('svg[data-layout]')).toHaveAttribute('data-layout-compact','true');
  const expected=await page.locator('svg[data-layout]').getAttribute('viewBox');
  await page.evaluate(()=>{
    const snapshots:string[]=[];Object.assign(window,{architectureViews:snapshots});
    new MutationObserver(()=>{const svg=document.querySelector('svg[data-layout]');if(svg)snapshots.push(svg.getAttribute('viewBox')!);}).observe(document.querySelector('main')!,{childList:true,subtree:true});
  });
  await page.getByRole('button',{name:'next clock',exact:true}).click();await page.clock.runFor(32);
  const views=await page.evaluate(()=>(window as unknown as {architectureViews:string[]}).architectureViews);expect(views.length).toBeGreaterThan(0);for(const view of views)expect(view).toBe(expected);
  await page.getByRole('button',{name:'theme',exact:true}).click();
  const fills=await page.locator('[data-flow-node] text').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill));
  expect(fills.every(fill=>fill!=='rgb(0, 0, 0)'&&fill!=='none')).toBe(true);
});


test('local Pause freezes packet, payload and elapsed time; Resume continues from the same position',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  await page.clock.runFor(350);
  const motion=page.locator('[data-flow-elapsed]');
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  const before={elapsed:await motion.getAttribute('data-flow-elapsed'),packet:await page.locator('.flow-packet').getAttribute('data-packet-y'),text:await page.locator('[data-transfer]').textContent()};
  await page.clock.runFor(2200);
  expect(await motion.getAttribute('data-flow-elapsed')).toBe(before.elapsed);
  expect(await page.locator('.flow-packet').getAttribute('data-packet-y')).toBe(before.packet);
  expect(await page.locator('[data-transfer]').textContent()).toBe(before.text);
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(200);
  expect(Number(await motion.getAttribute('data-flow-elapsed'))).toBeGreaterThan(Number(before.elapsed));
});

test('global Play/Pause controls the same animation clock and preserves pipeline timing',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?timing=1');
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('1');await page.clock.runFor(350);
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('global-playing')).toHaveText('false');
  const before=await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed');
  await page.clock.runFor(2000);
  expect(await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed')).toBe(before);
  await page.getByRole('button',{name:'play',exact:true}).click();await page.clock.runFor(Number(await page.getByTestId('timing-delay').textContent())-351);
  await expect(page.getByTestId('timing-clock')).toHaveText('1');
  await page.clock.runFor(1);await expect(page.getByTestId('timing-clock')).toHaveText('2');
  await page.getByRole('button',{name:'흐름 다시 보기',exact:true}).click();
  await expect(page.getByTestId('global-playing')).toHaveText('false');
  await expect(page.locator('[data-flow-elapsed]')).toHaveAttribute('data-flow-elapsed','0');
  await page.getByRole('button',{name:'reset',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('0');
  await page.getByRole('button',{name:'step',exact:true}).click();
  await expect(page.locator('[data-flow-playing]')).toHaveAttribute('data-flow-playing','false');
  await page.clock.runFor(500);
  await expect(page.locator('[data-flow-elapsed]')).toHaveAttribute('data-flow-elapsed','0');
  await page.goto('/tests/browser/line-flow.html?timing=1&mode=pipeline');
  await page.getByRole('button',{name:'play',exact:true}).click();await page.clock.runFor(999);
  await expect(page.getByTestId('timing-clock')).toHaveText('0');
  await page.clock.runFor(1);await expect(page.getByTestId('timing-clock')).toHaveText('1');
});

test('cycle three resumes locally after pausing global playback and can replay while global Play is active',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?timing=1');
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'step',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('3');
  await page.getByRole('button',{name:'play',exact:true}).click();await page.clock.runFor(300);
  await page.getByRole('button',{name:'\uD750\uB984 \uB2E4\uC2DC \uBCF4\uAE30',exact:true}).click();
  await expect(page.getByTestId('global-playing')).toHaveText('false');
  await expect(page.locator('[data-flow-playing]')).toHaveAttribute('data-flow-playing','true');
  await page.clock.runFor(300);
  expect(Number(await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed'))).toBeGreaterThan(150);
  for(let i=0;i<2;i++) {
    await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    const elapsed=await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed');
    await page.clock.runFor(300);
    expect(await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed')).toBe(elapsed);
    await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();await page.clock.runFor(300);
    expect(Number(await page.locator('[data-flow-elapsed]').getAttribute('data-flow-elapsed'))).toBeGreaterThan(Number(elapsed));
  }
});
