import {test,expect,type Page} from '@playwright/test';

async function frozenTime(page:Page) {
  const start=new Date('2026-11-19T00:00:00Z');
  await page.clock.install({time:start});await page.clock.pauseAt(new Date(start.getTime()+1000));
}

test('the vertical circuit and memory-bus role labels fit without scrolling at desktop and mobile sizes',async ({page})=>{
  await frozenTime(page);
  await page.goto('/tests/browser/line-flow.html');
  for(const size of [{width:1400,height:900},{width:760,height:1000},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);await page.clock.runFor(32);
    const svg=page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'});
    await expect(svg).toBeInViewport();
    const bounds=await svg.evaluate(element=>{
      const region=element.closest('section')!;
      return Array.from(region.querySelectorAll<HTMLElement>('*')).filter(node=>getComputedStyle(node).overflowY==='auto'||getComputedStyle(node).overflowX==='auto').map(node=>({x:node.scrollWidth-node.clientWidth,y:node.scrollHeight-node.clientHeight}));
    });
    expect(bounds).toEqual([]);
    await expect(svg).toHaveAttribute('data-layout','vertical-datapath');
    await expect(svg.locator('[data-instruction-address-label]')).toContainText('\uBA85\uB839\uC5B4 \uC8FC\uC18C');
    await expect(svg.getByRole('button',{name:'Instruction Memory 흐름 선택'})).toBeVisible();
    await expect(svg.getByRole('button',{name:'Data Memory 흐름 선택'})).toBeVisible();
    await expect(svg.getByLabel('ALU 입력 선택')).toBeVisible();
    await expect(svg.getByLabel('기록값 선택')).toBeVisible();
    const spacing=await svg.evaluate(element=>{
      const root=element as unknown as SVGSVGElement,view=root.viewBox.baseVal,rect=root.getBoundingClientRect();
      const boxes=Array.from(root.querySelectorAll<SVGGraphicsElement>('[data-flow-node],[data-circuit-wire]')).map(node=>node.getBBox());
      const left=Math.min(...boxes.map(box=>box.x)),right=Math.max(...boxes.map(box=>box.x+box.width));
      return (right-left)*Math.min(rect.width/view.width,rect.height/view.height)/rect.width;
    });
    expect(spacing).toBeGreaterThan(.82);
    await expect(svg.locator('[data-flow-node="registers"]')).toHaveAttribute('data-hardware-shape','register-file');
    await expect(svg.locator('[data-flow-node="memory"]')).toHaveAttribute('data-hardware-shape','chip');
    await expect(svg.locator('[data-system-bus-label="address"]')).toContainText('Address Bus');
    await expect(svg.locator('[data-system-bus-label="data"]')).toContainText('Data Bus');
    await expect(svg.locator('[data-system-bus-label="control"]')).toContainText('Control Bus');
  }
});

test('the moving data word carries the real operand and freezes intact when paused',async ({page})=>{
  await frozenTime(page);await page.setViewportSize({width:1400,height:900});
  await page.goto('/tests/browser/line-flow.html');await page.clock.runFor(32);
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(150);
  const word=page.locator('[data-moving-value="11"]');
  await expect(word).toBeVisible();await expect(word).toContainText('11');
  const coordinate=()=>word.evaluate(node=>({x:node.getAttribute('data-packet-x'),y:node.getAttribute('data-packet-y')}));
  const before=await coordinate();
  await page.clock.runFor(150);expect(await coordinate()).not.toEqual(before);
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  const frozen=await word.getAttribute('data-packet-x');await page.clock.runFor(1000);
  expect(await word.getAttribute('data-packet-x')).toBe(frozen);
  const issues=await word.evaluate(element=>{
    const capsule=(element as SVGGraphicsElement).getBBox();
    const text=element.querySelector('text')!.getBBox();
    return text.x<capsule.x||text.x+text.width>capsule.x+capsule.width;
  });
  expect(issues).toBe(false);
  await page.goto('/tests/browser/line-flow.html?geometry=add');await page.clock.runFor(32);
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  await page.getByRole('button',{name:'흐름 재생',exact:true}).click();await page.clock.runFor(150);
  const large=page.locator('[data-moving-value="-2147483648"]');
  await expect(large).toBeVisible();
  expect(await large.evaluate(element=>{
    const box=element.querySelector('rect')!.getBBox(),text=element.querySelector('text')!.getBBox();
    return text.x>=box.x+10&&text.x+text.width<=box.x+box.width-5&&text.y>=box.y&&text.y+text.height<=box.y+box.height;
  })).toBe(true);
});

test('the prominent payload identifies each operand and result without moving or covered text',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  const payload=page.getByLabel('현재 이동 데이터');
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  await expect(payload).toContainText('레지스터 → ALU');
  await expect(payload).toContainText('11 · 0x0000000B');
  await expect(payload).toContainText('입력 A');
  await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  await expect(payload).toContainText('7 · 0x00000007');
  await expect(payload).toContainText('입력 B');
  await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
  await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
  await expect(payload).toContainText('18 · 0x00000012');
  await expect(page.locator('[data-flow-node="alu"]')).toContainText('처리 중');
});

test('local Pause freezes packet, payload and elapsed time; Resume continues from the same position',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  await page.clock.runFor(350);
  const motion=page.locator('[data-flow-elapsed]');
  await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
  const before={elapsed:await motion.getAttribute('data-flow-elapsed'),packet:await page.locator('.flow-packet').getAttribute('data-packet-y'),text:await page.getByLabel('현재 이동 데이터').textContent()};
  await page.clock.runFor(2200);
  expect(await motion.getAttribute('data-flow-elapsed')).toBe(before.elapsed);
  expect(await page.locator('.flow-packet').getAttribute('data-packet-y')).toBe(before.packet);
  expect(await page.getByLabel('현재 이동 데이터').textContent()).toBe(before.text);
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

test('load/store use the correct system bus direction and store has no register writeback',async ({page})=>{
  await frozenTime(page);
  for(const op of ['lw','sw']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
    const seen:string[]=[];
    while(await page.getByRole('button',{name:'다음 흐름',exact:true}).isEnabled()) {
      seen.push(await page.getByLabel('현재 이동 데이터').getAttribute('data-transfer')??'');
      await page.getByRole('button',{name:'다음 흐름',exact:true}).click();
    }
    expect(seen).toContain('memory-address');expect(seen).toContain('memory-control');
    expect(seen).toContain(op==='lw'?'load-data':'store-data');
    if(op==='sw') expect(seen).not.toContain('writeback');
  }
});

test('node text, payloads and system-bus labels remain readable in every transfer layout',async ({page})=>{
  await frozenTime(page);
  for(const op of ['add','lw','sw','bne','jal','ecall']) for(const size of [{width:1400,height:900},{width:700,height:1000}]) {
    await page.setViewportSize(size);await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.clock.runFor(32);await page.getByRole('button',{name:'흐름 일시정지',exact:true}).click();
    const svg=page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'});
    const check=async()=>{
      const issues=await svg.evaluate(element=>{
        const root=element as unknown as SVGSVGElement,issues:string[]=[];
        const view=root.viewBox.baseVal;
        for(const text of root.querySelectorAll<SVGTextElement>('text')) {
          const box=text.getBBox();
          if(box.x<view.x||box.y<view.y||box.x+box.width>view.x+view.width||box.y+box.height>view.y+view.height)issues.push(`view: ${text.textContent}`);
        }
        for(const node of root.querySelectorAll<SVGGElement>('[data-flow-node]')) {
          const x=Number(node.dataset.x),y=Number(node.dataset.y),w=Number(node.dataset.width),h=Number(node.dataset.height);
          for(const text of node.querySelectorAll<SVGTextElement>('text')) {
            const box=text.getBBox();
            if(box.x<x+5||box.y<y+3||box.x+box.width>x+w-5||box.y+box.height>y+h-3)issues.push(`node: ${text.textContent}`);
          }
        }
        const payload=root.querySelector('[data-transfer]')!;
        for(const text of payload.querySelectorAll<SVGTextElement>('text')) {
          const box=text.getBBox();
          if(box.x<30||box.x+box.width>view.width-30||box.y<15||box.y+box.height>125)issues.push(`payload: ${text.textContent}`);
        }
        const layer=root.querySelector('[data-text-layer]')!;
        for(const path of root.querySelectorAll('[data-flow-route] path')) {
          if(!(path.compareDocumentPosition(layer)&Node.DOCUMENT_POSITION_FOLLOWING))issues.push('wire covers bus text');
        }
        return issues;
      });
      expect(issues,`${op} ${size.width}`).toEqual([]);
    };
    await check();
    while(await page.getByRole('button',{name:'다음 흐름',exact:true}).isEnabled()) {
      await page.getByRole('button',{name:'다음 흐름',exact:true}).click();await check();
    }
  }
});


test('register selection sends a distinct moving control signal',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
  await expect(page.locator('[data-transfer="read-control"]')).toBeVisible();
  await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();
  await page.clock.runFor(900);
  await page.setViewportSize({width:760,height:1000});await page.clock.runFor(32);
  await expect(page.locator('[data-transfer="read-control"]')).toBeVisible();
  await expect(page.locator('.flow-data-word,.flow-data-trail')).toHaveCount(0);
  await expect(page.locator('.flow-control-word')).toContainText('Read x14, x15');
  await expect(page.locator('[data-flow-node="registers"]')).toContainText('\uB3C4\uCC29');
});


test('Imm Gen receives instruction bits before exposing the decoded immediate',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  const immediate=page.locator('[data-flow-node="immediate"]');
  await expect(page.locator('[data-circuit-wire="decode-immediate"]')).toBeVisible();
  await expect(immediate).toContainText('\uBA85\uB839\uC5B4 \uD574\uC11D \uB300\uAE30');
  for(let i=0;i<2;i++) await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
  await expect(page.locator('[data-transfer="decode-immediate"]')).toBeVisible();
  const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
  await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();
  await page.clock.runFor(duration*.5);
  await expect(page.locator('[data-transfer="decode-immediate"]')).toBeVisible();
  await page.clock.runFor(duration*.6);
  await expect(page.locator('[data-transfer="read-control"]')).toBeVisible();
  await expect(immediate).toContainText('-4');
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


test('focus follows memory -> MUX -> registers, and control selection names the register ports',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  const next=page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true});
  for(let i=0;i<3;i++) await next.click();
  await expect(page.locator('[data-control-selection]')).toContainText('Read: x8');
  const legendAboveRegisters=await page.locator('svg[data-layout]').evaluate(svg=>{
    const register=svg.querySelector('[data-flow-node="registers"]') as SVGGraphicsElement;
    return [...svg.querySelectorAll<SVGGraphicsElement>('[data-system-bus-label]')].every(label=>label.getBBox().y+label.getBBox().height<register.getBBox().y);
  });
  expect(legendAboveRegisters).toBe(true);
  while(await page.getByLabel('\uD604\uC7AC \uC774\uB3D9 \uB370\uC774\uD130').getAttribute('data-transfer')!=='load-data') await next.click();
  const registers=page.locator('[data-flow-node="registers"]');
  await expect(registers).toContainText('\uACB0\uACFC \uAE30\uB85D \uB300\uAE30');
  await expect(registers).toHaveAttribute('data-flow-active','false');
  await expect(page.getByLabel('\uAE30\uB85D\uAC12 \uC120\uD0DD')).toHaveAttribute('data-flow-active','true');
  await expect(page.locator('[data-flow-node="memory"]')).toHaveAttribute('data-flow-active','true');
  await next.click();
  await expect(page.locator('[data-transfer="writeback"]')).toBeVisible();
  await expect(registers).toHaveAttribute('data-flow-active','true');
  await expect(page.locator('[data-flow-node="memory"]')).toHaveAttribute('data-flow-active','false');
});


test('data labels stay visible on both sides of MUXes and beside memory throughout a transfer',async ({page})=>{
  await frozenTime(page);await page.setViewportSize({width:1400,height:900});
  const observed=new Set<string>();
  for(const size of [{width:1400,height:900},{width:700,height:1000}]) for(const op of ['add','lw']) {
    await page.setViewportSize(size);
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    const next=page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true});
    while(true) {
      const id=await page.locator('[data-transfer]').getAttribute('data-transfer')??'';
      if(['decode-immediate','input-b','mux-to-alu','result-to-mux','load-data','writeback'].includes(id)) {
        observed.add(id);
        await expect(page.locator('.flow-data-word')).toBeVisible();
        const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
        await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();
        for(const fraction of [.5,.46]) {
          await page.clock.runFor(duration*fraction);
          await expect(page.locator(`[data-transfer="${id}"]`)).toBeVisible();
          await expect(page.locator('.flow-data-word')).toBeVisible();
          expect(await page.locator('svg[data-layout]').evaluate(svg=>{
            const label=svg.querySelector<SVGGraphicsElement>('.flow-data-word')!.getBBox();
            const obstacles=[...svg.querySelectorAll<SVGGraphicsElement>('[data-flow-node]')].filter(node=>!(node.dataset.hardwareShape==='mux'&&node.dataset.flowActive==='true')).map(node=>({x:Number(node.dataset.x),y:Number(node.dataset.y),width:Number(node.dataset.width),height:Number(node.dataset.height)}));
            for(const selector of ['[aria-label="\uAE30\uB85D\uAC12 \uC120\uD0DD"]','[aria-label="ALU \uC785\uB825 \uC120\uD0DD"]','[data-control-selection]']) {
              const node=svg.querySelector<SVGGraphicsElement>(selector);if(node&&node.getAttribute('data-flow-active')!=='true')obstacles.push(node.getBBox());
            }
            for(const text of svg.querySelectorAll<SVGGraphicsElement>('[data-hardware-shape="mux"] text')) if(getComputedStyle(text).opacity!=='0')obstacles.push(text.getBBox());
            return obstacles.filter(box=>!(label.x+label.width<=box.x||label.x>=box.x+box.width||label.y+label.height<=box.y||label.y>=box.y+box.height)).map(box=>({label:{x:label.x,y:label.y,w:label.width,h:label.height},box:{x:box.x,y:box.y,w:box.width,h:box.height}}));
          }),`${op} ${id}: label covers device`).toEqual([]);
        }
        await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
      }
      if(!await next.isEnabled()) break;
      await next.click();
    }
  }
  expect([...observed].sort()).toEqual(['decode-immediate','input-b','load-data','mux-to-alu','result-to-mux','writeback'].sort());
});




test('the value stays centered on its moving wire position without jumps or clipping',async ({page})=>{
  await frozenTime(page);
  for(const size of [{width:1400,height:900},{width:700,height:1000}]) for(const op of ['lw','jal']) {
    await page.setViewportSize(size);await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    const next=page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true});
    for(const id of op==='lw'?['fetch-address','decode-immediate','input-b','mux-to-alu','load-data','writeback']:['fetch-address','input-a','result-to-mux','writeback']) {
      while(await page.locator('[data-transfer]').getAttribute('data-transfer')!==id)await next.click();
      const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
      let previous:{x:number;y:number}|undefined;
      await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();
      for(let sample=0;sample<13;sample++) {
        if(sample)await page.clock.runFor(duration/16);
        const geometry=await page.locator('svg[data-layout]').evaluate(svg=>{
          const word=svg.querySelector<SVGGraphicsElement>('.flow-data-word')!;
          const box=word.querySelector('rect')!.getBBox();
          const x=Number(word.dataset.packetX),y=Number(word.dataset.packetY);
          const path=svg.querySelector<SVGPathElement>('[data-flow-route] path')!;
          const view=(svg as SVGSVGElement).viewBox.baseVal;
          const clearLabels=[...svg.querySelectorAll<SVGGraphicsElement>('[data-bus-legend],[data-instruction-address-label],[data-instruction-word-label],[data-memory-address-label]')].every(label=>{
            const other=label.getBBox();return box.x+box.width<=other.x||box.x>=other.x+other.width||box.y+box.height<=other.y||box.y>=other.y+other.height;
          });
          return {x,y,error:Math.hypot(box.x+box.width/2-x,box.y+box.height/2-y),length:path.getTotalLength(),inside:box.x>=0&&box.x+box.width<=view.width&&box.y>=0&&box.y+box.height<=view.height,clearLabels};
        });
        expect(geometry.error,`${size.width} ${id}: value detached from its wire`).toBeLessThan(.01);
        expect(geometry.inside,`${id}: packet clipped`).toBe(true);
        expect(geometry.clearLabels,`${id}: packet covers caption or bus legend`).toBe(true);
        if(previous)expect(Math.hypot(geometry.x-previous.x,geometry.y-previous.y),`${id}: teleport between samples`).toBeLessThanOrEqual(geometry.length/12+2);
        previous=geometry;
      }
      await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    }
  }
});


test('consecutive MUX transfers carry the same value across the stage boundary without teleporting',async ({page})=>{
  await frozenTime(page);
  for(const op of ['add','lw']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    for(const [before,after] of [['input-b','mux-to-alu'],[op==='lw'?'load-data':'result-to-mux','writeback']]) {
      while(await page.locator('[data-transfer]').getAttribute('data-transfer')!==before)await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
      const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
      await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();await page.clock.runFor(duration-25);
      const read=()=>page.locator('.flow-data-word').evaluate(word=>({x:Number(word.dataset.packetX),y:Number(word.dataset.packetY),value:word.textContent}));
      const a=await read();await page.clock.runFor(65);const b=await read();
      await expect(page.locator(`[data-transfer="${after}"]`)).toBeVisible();
      expect(b.value).toBe(a.value);
      expect(Math.hypot(b.x-a.x,b.y-a.y)).toBeLessThan(5);
      await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
    }
  }
});


test('writeback MUX captions stay in one place and remain clear of the moving value',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  await page.evaluate(()=>document.fonts.ready);
  const captions=()=>page.locator('[data-mux-title],[data-mux-status]').evaluateAll(nodes=>nodes.map(node=>({x:node.getAttribute('x'),y:node.getAttribute('y'),size:Number(node.getAttribute('font-size'))})));
  const before=await captions();
  expect(before[0].size).toBeGreaterThanOrEqual(20);expect(before[1].size).toBeGreaterThanOrEqual(18);
  for(const id of ['result-to-mux','writeback']) {
    while(await page.locator('[data-transfer]').getAttribute('data-transfer')!==id)await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
    expect(await captions()).toEqual(before);
    const duration=Number(await page.locator('[data-flow-step-duration]').getAttribute('data-flow-step-duration'));
    await page.getByRole('button',{name:'\uD750\uB984 \uC7AC\uC0DD',exact:true}).click();await page.clock.runFor(duration*.5);
    expect(await captions()).toEqual(before);
    expect(await page.locator('svg[data-layout]').evaluate(svg=>{
      const value=svg.querySelector<SVGGraphicsElement>('.flow-data-word')!.getBBox();
      return [...svg.querySelectorAll<SVGGraphicsElement>('[data-mux-title],[data-mux-status]')].filter(text=>getComputedStyle(text).opacity!=='0').every(text=>{
        const box=text.getBBox();return value.x+value.width<=box.x||value.x>=box.x+box.width||value.y+value.height<=box.y||value.y>=box.y+box.height;
      });
    })).toBe(true);
    await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  }
});


test('bus legend uses the upper-left free space and address captions sit close above their memories',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.locator('svg[data-layout]').evaluate(svg=>{
    const legend=svg.querySelector<SVGGraphicsElement>('[data-bus-legend]')!.getBBox();
    const instruction=svg.querySelector<SVGGraphicsElement>('[data-flow-node="instruction-memory"]')!;
    const captions=[['[data-instruction-address-label] text','instruction-memory'],['[data-memory-address-label]','memory']].map(([selector,node])=>{
      const label=svg.querySelector<SVGGraphicsElement>(selector)!,box=label.getBBox();
      const memory=svg.querySelector<SVGGraphicsElement>(`[data-flow-node="${node}"]`)!;
      return {gap:Number(memory.dataset.y)-box.y-box.height,size:Number(label.getAttribute('font-size'))};
    });
    return {legendRight:legend.x+legend.width,memoryLeft:Number(instruction.dataset.x),legendY:legend.y,captions};
  });
  expect(layout.legendRight).toBeLessThan(layout.memoryLeft);
  expect(layout.legendY).toBeGreaterThan(120);expect(layout.legendY).toBeLessThan(200);
  for(const caption of layout.captions) {expect(caption.size).toBeGreaterThanOrEqual(18);expect(caption.gap).toBeGreaterThanOrEqual(0);expect(caption.gap).toBeLessThanOrEqual(10);}
});


test('device geometry stays fixed from the first render when advancing instructions',async ({page})=>{
  await frozenTime(page);await page.setViewportSize({width:1400,height:900});await page.goto('/tests/browser/line-flow.html');await page.clock.runFor(32);
  const expected=await page.locator('svg[data-layout]').evaluate(svg=>[svg.getAttribute('viewBox'),...Array.from(svg.querySelectorAll<SVGGElement>('[data-flow-node]')).map(node=>[node.dataset.flowNode,node.dataset.x,node.dataset.y,node.dataset.width,node.dataset.height].join(':'))]);
  await page.evaluate(()=>{
    const snapshots:string[][]=[];Object.assign(window,{layoutSnapshots:snapshots});
    new MutationObserver(()=>{
      const svg=document.querySelector('svg[data-layout]');if(svg)snapshots.push([svg.getAttribute('viewBox')??'',...Array.from(svg.querySelectorAll<SVGGElement>('[data-flow-node]')).map(node=>[node.dataset.flowNode,node.dataset.x,node.dataset.y,node.dataset.width,node.dataset.height].join(':'))]);
    }).observe(document.querySelector('main')!,{childList:true,subtree:true});
  });
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'next clock',exact:true}).click();await page.clock.runFor(32);}
  const snapshots=await page.evaluate(()=>(window as unknown as {layoutSnapshots:string[][]}).layoutSnapshots);
  expect(snapshots.length).toBeGreaterThan(0);
  for(const snapshot of snapshots)expect(snapshot).toEqual(expected);
});


test('both MUXes show centered names, values and arrival/departure states like other devices',async ({page})=>{
  await frozenTime(page);await page.goto('/tests/browser/line-flow.html?geometry=lw');
  await page.getByRole('button',{name:'\uD750\uB984 \uC77C\uC2DC\uC815\uC9C0',exact:true}).click();
  for(const [id,unit,status] of [['input-b','operand-mux','\uB3C4\uCC29'],['mux-to-alu','operand-mux','\uCD9C\uBC1C'],['load-data','mux','\uB3C4\uCC29'],['writeback','mux','\uCD9C\uBC1C']]) {
    while(await page.locator('[data-transfer]').getAttribute('data-transfer')!==id)await page.getByRole('button',{name:'\uB2E4\uC74C \uD750\uB984',exact:true}).click();
    const node=page.locator(`[data-flow-node="${unit}"]`);await expect(node).toContainText(status);
    expect(await node.evaluate(node=>{
      const title=node.querySelector('text')!,value=node.querySelector('g text')!;
      const center=Number((node as SVGElement).dataset.x)+Number((node as SVGElement).dataset.width)/2;
      return Math.abs(Number(title.getAttribute('x'))-center)<.01&&Math.abs(Number(value.getAttribute('x'))-center)<.01;
    })).toBe(true);
  }
});
