import {test, expect} from '@playwright/test';
import type {Page} from '@playwright/test';

async function section(page: Page, title: string) {
  const selector = page.getByRole('combobox', {name: '설명 페이지 선택'});
  const value = await selector.locator('option').filter({hasText: title}).first().getAttribute('value');
  await selector.selectOption(value!);
}

test.beforeEach(async ({page}) => {
  // Unseeded runtime explanations must stay inside this isolated fixture server.
  await page.route('**/api/v1/tutor/explain', route => route.fulfill({json: {
    items: route.request().postDataJSON().items.map((item: {kind: string; text: string}) => ({
      kind: item.kind, category: 'unmapped', title: '문맥', summary: item.text, detail: '',
    })),
  }}));
});

test('switching C lines does not cancel or restart pending ASM explanations', async ({page}) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  let asmRequests = 0;
  await page.route('**/api/v1/tutor/explain', async route => {
    const items = route.request().postDataJSON().items as {kind: string; text: string}[];
    if (items.some(item => item.kind !== 'c')) {
      asmRequests++;
      await pending;
    }
    await route.fulfill({json: {items: items.map(item => ({
      kind: item.kind, category: 'test', title: '문맥', summary: `loaded ${item.text}`, detail: '',
    }))}});
  });
  await page.goto('/tests/browser/tutor.html');
  try {
    await expect.poll(() => asmRequests).toBe(1);
    await page.getByRole('button', {name: 'select second C line'}).click();
    await expect(page.getByText('loaded return x;', {exact: true})).toBeVisible();
    const received = page.waitForResponse(response => response.url().endsWith('/api/v1/tutor/explain')
      && response.request().postDataJSON().items.some((item: {kind: string}) => item.kind === 'crt'));
    release();
    await expect((await received).ok()).toBe(true);
    await page.getByRole('button', {name: 'select unmapped ASM'}).click();
    await expect(page.locator('[data-asm-index="2"]')).toBeVisible();
    expect(asmRequests).toBe(1);
  } finally {
    release();
  }
});

test('ASM errors survive a successful C explanation and remain manually retryable', async ({page}) => {
  let asmRequests = 0;
  await page.route('**/api/v1/tutor/explain', route => {
    const items = route.request().postDataJSON().items as {kind: string; text: string}[];
    if (items.some(item => item.kind !== 'c') && ++asmRequests === 1) {
      return route.fulfill({status: 503, json: {detail: 'temporary failure'}});
    }
    return route.fulfill({json: {items: items.map(item => ({
      kind: item.kind, category: 'test', title: '문맥', summary: `loaded ${item.text}`, detail: '',
    }))}});
  });
  await page.goto('/tests/browser/tutor.html');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: 'select second C line'}).click();
  await expect(page.getByText('loaded return x;', {exact: true})).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: '다시 시도', exact: true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(asmRequests).toBe(2);
});

test('one ASM per page, fixed navigation and no integrated dialog', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  const panel = page.getByRole('region', {name: '튜터 해설 패널'});
  await expect(panel.locator('[data-asm-index]')).toHaveCount(1);
  await expect(panel).toContainText('a0 = zero + 3');
  await expect(panel).not.toContainText('a1 = a0 + 1');
  await expect(panel.getByRole('button', {name: 'C·ASM 통합 보기'})).toHaveCount(0);
  await panel.getByRole('button', {name: '다음 명령어', exact: true}).click();
  await expect(panel.locator('[data-asm-index="1"]')).toBeVisible();
  await expect(panel).toContainText('a1 = a0 + 1');
  await expect(panel.getByRole('button', {name: '다음 명령어', exact: true})).toBeDisabled();
  await expect(panel.getByRole('button', {name: '이전 명령어', exact: true})).toBeEnabled();
  for (const width of [1100,390]) {
    await page.setViewportSize({width,height:844});
    const bounds = await panel.evaluate(element => {const nav=element.querySelector('nav')!;return {height:element.getBoundingClientRect().height, bottom:nav.getBoundingClientRect().bottom,panelBottom:element.getBoundingClientRect().bottom,overflow:element.scrollWidth-element.clientWidth};});
    expect(bounds.height).toBeLessThan(650);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.panelBottom);
    expect(bounds.overflow).toBeLessThanOrEqual(1);
  }
});

test('all teaching content stays reachable through short pages', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByRole('button', {name:'select second ASM'}).click();
  await section(page,'처리 순서');
  const content = page.getByRole('region',{name:'현재 설명 페이지'});
  await expect(content).toContainText('명령어에 적힌 숫자 1');
  await section(page,'항목별 역할');
  await expect(content).toContainText('첫 번째 입력값을 가진 레지스터');
  await section(page,'즉치값은 명령어 안의 상수');
  await expect(content).toContainText('현재 실행값과 별개');
  await expect(content).toContainText('5000은 -2048~2047 범위를 벗어납니다.');
  await content.getByText('원리와 참고 자료',{exact:true}).focus();
  await content.getByText('원리와 참고 자료',{exact:true}).press('Enter');
  await expect(content).toContainText('부호 있는 12비트');
  await expect(content.getByRole('link')).toHaveAttribute('rel','noopener noreferrer');
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await expect(content).toBeVisible();
  await page.getByRole('button',{name:'이전 설명',exact:true}).click();
  await expect(content).not.toContainText('5000은');
});

test('C mapping summary and direct ASM explain the same selected instruction',async ({page})=>{
  await page.goto('/tests/browser/tutor.html');
  await section(page,'C 줄과의 연결');
  await expect(page.getByRole('region',{name:'현재 설명 페이지'})).toContainText('값 준비 → 초기값 기록');
  await page.getByRole('button',{name:'switch target'}).click();
  await expect(page.getByRole('region',{name:'현재 설명 페이지'})).toContainText('a0 = zero + 3');
  await expect(page.getByRole('combobox').locator('option').filter({hasText:'C 줄과의 연결'})).toHaveCount(0);
});

test('playback replaces the page with the actual focused instruction in both modes',async ({page})=>{
  await page.goto('/tests/browser/tutor.html');
  const panel=page.getByRole('region',{name:'튜터 해설 패널'});
  for (const stage of ['IF','EX']) {
    if(stage==='EX') await page.getByRole('button',{name:'toggle pipeline focus'}).click();
    await page.getByRole('button',{name:'follow first step'}).click();
    await expect(panel).toContainText(`${stage} · 실행 따라가기`);
    await expect(panel.locator('[data-asm-index="0"]')).toBeVisible();
    await page.getByRole('button',{name:'follow next step'}).click();
    await expect(panel.locator('[data-asm-index="1"]')).toBeVisible();
    await expect(panel.locator('[data-asm-index="0"]')).toHaveCount(0);
  }
});

test('current-cycle evidence and deferred CPI exclude future hazards',async ({page})=>{
  await page.goto('/tests/browser/tutor.html');
  await section(page,'현재 클록');
  const summary=page.locator('details').filter({has:page.locator('summary',{hasText:'CPI와 해저드 분석'})});
  await expect(summary.locator(':scope > div')).toHaveCount(0);
  await summary.locator(':scope > summary').click();
  await expect(summary).toContainText('1 ÷ 1 = 1.00');
  await expect(summary).not.toContainText('실행 이력에서 확인한 대기 원인');
  await page.getByRole('button',{name:'follow next step'}).click();
  await section(page,'현재 클록');
  await summary.locator(':scope > summary').click();
  await expect(summary).toContainText('2 ÷ 1 = 2.00');
  await summary.getByText('주요 관찰 원인',{exact:true}).click();
  await expect(summary).toContainText('실행 이력에서 확인한 대기 원인');
  await page.getByRole('button',{name:'follow first step'}).click();
  await section(page,'현재 클록');
  await expect(page.getByRole('region',{name:'현재 설명 페이지'})).not.toContainText('실행 이력에서 확인한 대기 원인');
});
