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
    expect(spacing).toBeGreaterThan(.9);
    await expect(svg.locator('[data-flow-node="registers"]')).toHaveAttribute('data-hardware-shape','register-file');
    await expect(svg.locator('[data-flow-node="memory"]')).toHaveAttribute('data-hardware-shape','chip');
    await expect(svg.locator('[data-system-bus-label="address"]')).toContainText('주소');
    await expect(svg.locator('[data-system-bus-label="data"]')).toContainText('데이터');
    await expect(svg.locator('[data-system-bus-label="control"]')).toContainText('제어');
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
  const before=await word.getAttribute('data-packet-x');
  await page.clock.runFor(150);expect(await word.getAttribute('data-packet-x')).not.toBe(before);
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
  await page.getByRole('button',{name:'play',exact:true}).click();await page.clock.runFor(8999);
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

test('tutor pagination shows encoded format without an integrated window and stays bounded',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'show tutor'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const select=page.getByRole('combobox',{name:'설명 페이지 선택'});
  const value=await select.locator('option').filter({hasText:'R형 포맷'}).getAttribute('value');
  await select.selectOption(value!);
  await expect(page.getByRole('region',{name:'현재 설명 페이지'})).toContainText('funct7');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  const panel=page.getByRole('region',{name:'튜터 해설 패널'});
  expect(await panel.evaluate(element=>element.scrollHeight-element.clientHeight)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button',{name:'다음 설명',exact:true})).toBeInViewport();
  await page.getByRole('button',{name:'다음 명령어',exact:true}).click();
  await expect(panel.locator('[data-asm-index="3"]')).toBeVisible();
  await expect(select).toHaveValue('0');
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
