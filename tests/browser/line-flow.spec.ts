import {test,expect} from '@playwright/test';

test('diagram fills the panel and values follow the observed clock without duplicated explanations',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  const diagram=page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'});
  await expect(diagram).toContainText('결과 18');
  await expect(page.getByRole('region',{name:'입력과 기록 결과'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'현재 동작 상세'})).toHaveCount(0);
  await page.getByRole('button',{name:'previous clock'}).click();
  await expect(diagram).toContainText('값 7');
  await expect(diagram).not.toContainText('결과 18');
  const bounds=await diagram.evaluate(element=>{const panel=element.closest('section')!;return {height:element.getBoundingClientRect().height,panel:panel.getBoundingClientRect().height};});
  expect(bounds.height).toBeGreaterThan(bounds.panel * .75);
});

test('data moves along a path before the next path starts; replay keeps the CPU clock',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'천천히 다시 보기'}).click();
  await expect(page.getByText('playback paused',{exact:true})).toBeVisible();
  const sample=async (time:number)=>page.locator('svg[aria-label="데이터가 이동하는 싱글 사이클 경로"]').evaluate((svg,time)=>{
    const root=svg as SVGSVGElement;root.pauseAnimations();root.setCurrentTime(time);
    const packet=root.querySelector('[data-flow-route="pc-fetch"] .flow-packet') as SVGGraphicsElement;
    const next=root.querySelector('[data-flow-route="fetch"] .flow-packet')!;
    return {matrix:packet.getCTM()?.f,nextOpacity:getComputedStyle(next).opacity};
  },time);
  const early=await sample(.1),later=await sample(.3);
  expect(later.matrix).not.toBe(early.matrix);
  expect(early.nextOpacity).toBe('0');
  await expect(page.getByText(/CORE clock 12/)).toBeVisible();
  await page.getByRole('button',{name:'ALU · 연산 / 주소 계산 설명 보기'}).click();
  await expect(page.locator('[data-flow-route="operands"]')).toHaveAttribute('data-active','true');
  await expect(page.locator('[data-flow-route="load"]')).toHaveCount(0);
});

test('store keeps memory and register writeback distinct',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'next clock'}).click();
  await expect(page.locator('[data-flow-route="store"]')).toHaveAttribute('data-active','true');
  await expect(page.locator('[data-flow-route="record"]')).toHaveCount(0);
  await expect(page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'})).toContainText('4 byte 쓰기');
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

test('the old overview is still available and diagram blocks work with keyboard',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  const alu=page.getByRole('button',{name:'ALU · 연산 / 주소 계산 설명 보기'});
  await alu.focus();await alu.press('Enter');
  await expect(page.getByText('3 / 4 · ALU 연산',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'전체 상태',exact:true}).click();
  await expect(page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'})).toHaveCount(0);
  await page.getByRole('button',{name:'명령어 흐름',exact:true}).click();
  await expect(page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'})).toBeVisible();
});

test('single playback waits for the complete slow flow; pipeline timing stays unchanged',async ({page})=>{
  const start = new Date('2026-11-19T00:00:00Z');
  await page.clock.install({time:start});
  await page.clock.pauseAt(new Date(start.getTime()+1000));
  await page.goto('/tests/browser/line-flow.html?timing=1');
  await page.getByRole('button',{name:'play',exact:true}).click();
  await expect(page.getByTestId('timing-clock')).toHaveText('1');
  await page.clock.runFor(11999);
  await expect(page.getByTestId('timing-clock')).toHaveText('1');
  await page.clock.runFor(1);
  await expect(page.getByTestId('timing-clock')).toHaveText('2');
  await page.goto('/tests/browser/line-flow.html?timing=1&mode=pipeline');
  await page.getByRole('button',{name:'play',exact:true}).click();
  await page.clock.runFor(999);
  await expect(page.getByTestId('timing-clock')).toHaveText('0');
  await page.clock.runFor(1);
  await expect(page.getByTestId('timing-clock')).toHaveText('1');
});

test('bus widths, labels and extreme values stay inside their shapes in all instruction layouts',async ({page})=>{
  for(const op of ['add','lw','sw','bne','jal','ecall']) {
    await page.goto(`/tests/browser/line-flow.html?geometry=${op}`);
    await page.getByRole('combobox',{name:'그림 크기'}).selectOption('all');
    if(op==='sw') await page.evaluate(()=>document.documentElement.classList.add('dark'));
    const svg=page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'});
    const issues=await svg.evaluate(element=>{
      const root=element as unknown as SVGSVGElement;
      const issues:string[]=[];
      const nodes=Array.from(root.querySelectorAll<SVGGElement>('[data-flow-node]'));
      for(const node of nodes) {
        const x=Number(node.dataset.x),y=Number(node.dataset.y),w=Number(node.dataset.width),h=Number(node.dataset.height);
        for(const text of node.querySelectorAll<SVGTextElement>(':scope > text')) {
          const box=text.getBBox();
          if(box.x<x+2||box.y<y+1||box.x+box.width>x+w-2||box.y+box.height>y+h-1) issues.push(`node: ${text.textContent}`);
          const shape=node.querySelector<SVGPathElement>(':scope > path');
          if(shape) for(const [px,py] of [[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]) {
            if(!shape.isPointInFill(new DOMPoint(px,py))) issues.push(`polygon: ${text.textContent}`);
          }
          if(text.textContent?.includes('…')) issues.push('truncated value');
        }
      }
      const view=root.viewBox.baseVal;
      for(const text of root.querySelectorAll<SVGTextElement>('.bus-label text,.bus-width text')) {
        const box=text.getBBox();
        if(box.x<view.x||box.y<view.y||box.x+box.width>view.x+view.width||box.y+box.height>view.y+view.height) issues.push(`viewBox: ${text.textContent}`);
        for(const node of nodes) {
          const x=Number(node.dataset.x),y=Number(node.dataset.y),w=Number(node.dataset.width),h=Number(node.dataset.height);
          if(box.x<x+w&&box.x+box.width>x&&box.y<y+h&&box.y+box.height>y) issues.push(`overlap: ${text.textContent}`);
        }
      }
      return issues;
    });
    expect(issues,op).toEqual([]);
    await expect(svg.locator('[data-connection="bus"] > path').first()).toHaveAttribute('stroke-width','12');
    await expect(svg.getByLabel('범례: 굵은 묶음선은 논리 버스, 보라 점선은 제어 신호. 실제 공유 단일 버스 회로를 뜻하지 않습니다.')).toHaveCount(1);
  }
});
