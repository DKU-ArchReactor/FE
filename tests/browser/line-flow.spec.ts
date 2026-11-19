import {test,expect} from '@playwright/test';

test('mapped ASM choices use only the selected clock values',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  await expect(page.getByRole('region',{name:'입력과 기록 결과'})).toContainText('18 · 0x00000012');
  const choices=page.locator('[aria-label="선택 C 줄의 ASM 명령어"] button');
  await expect(choices).toHaveCount(4);
  await choices.first().click();
  await expect(page.getByRole('region',{name:'입력과 기록 결과'})).not.toContainText('18 ·');
  await page.getByRole('button',{name:'이 명령어의 실행 시점으로 이동'}).click();
  await expect(page.getByRole('region',{name:'입력과 기록 결과'})).toContainText('11 ·');
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
  await page.getByRole('button',{name:/3\. ALU 연산/}).click();
  await expect(page.locator('[data-flow-route="operands"]')).toHaveAttribute('data-active','true');
  await expect(page.locator('[data-flow-route="load"]')).toHaveCount(0);
});

test('store keeps memory and register writeback distinct',async ({page})=>{
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button',{name:'next clock'}).click();
  await expect(page.locator('[data-flow-route="store"]')).toHaveAttribute('data-active','true');
  await expect(page.locator('[data-flow-route="record"]')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'입력과 기록 결과'})).toContainText('쓰기');
  await page.getByText('CU가 선택한 제어 신호',{exact:true}).click();
  await expect(page.locator('dl')).toContainText('mem_write1');
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
  await expect(page.getByRole('region',{name:'현재 동작 상세'})).toContainText('ALU 연산');
  await page.getByRole('button',{name:'전체 상태',exact:true}).click();
  await expect(page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'})).toHaveCount(0);
  await page.getByRole('button',{name:'명령어 흐름',exact:true}).click();
  await expect(page.getByRole('group',{name:'데이터가 이동하는 싱글 사이클 경로'})).toBeVisible();
});
