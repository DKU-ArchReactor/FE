import {test, expect, type Page} from '@playwright/test';

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
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  try {
    await expect.poll(() => asmRequests).toBe(1);
    const cLoaded=page.waitForResponse(response=>response.url().endsWith('/api/v1/tutor/explain')&&response.request().postDataJSON().items.some((item:{text:string})=>item.text==='return x;'));
    await page.getByRole('button', {name: 'select second C line'}).click();
    await expect((await cLoaded).ok()).toBe(true);
    const received = page.waitForResponse(response => response.url().endsWith('/api/v1/tutor/explain')
      && response.request().postDataJSON().items.some((item: {kind: string}) => item.kind === 'crt'));
    release();
    await expect((await received).ok()).toBe(true);
    await page.getByRole('button', {name: 'select unmapped ASM'}).click();
    await page.getByRole('button', {name:'자세히 보기',exact:true}).click();
    expect(await readPages(page)).toContain('loaded nop');
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
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  await expect(page.getByRole('alert')).toBeVisible();
  const cLoaded=page.waitForResponse(response=>response.url().endsWith('/api/v1/tutor/explain')&&response.request().postDataJSON().items.some((item:{text:string})=>item.text==='return x;'));
  await page.getByRole('button', {name: 'select second C line'}).click();
  await expect((await cLoaded).ok()).toBe(true);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: '다시 시도', exact: true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(asmRequests).toBe(2);
});


async function readPages(page:Page) {
  const window=page.locator('.dev-tutor-detail-window').filter({visible:true}).last();
  await expect(window.locator('.tutor-reading-block').first()).toBeVisible();
  let text='';
  for(let index=0;index<100;index++){
    const viewport=window.locator('.tutor-reader-viewport');
    await expect.poll(()=>viewport.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    expect(await viewport.evaluate(el=>el.scrollTop)).toBe(0);
    text+=await window.locator('.tutor-reader').innerText();
    const next=window.getByRole('button',{name:'다음 설명'});
    if(!await next.count()||await next.isDisabled())break;
    const before=await window.locator('.tutor-reader>header>span').textContent();
    await next.click();
    await expect(window.locator('.tutor-reader>header>span')).not.toHaveText(before!);
  }
  return text;
}
test('C and ASM are separated and their arrows navigate different scopes',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  const c=page.getByRole('complementary',{name:'선택한 C 줄 설명'});
  const asm=page.getByRole('region',{name:'선택한 어셈블리 설명'});
  await expect(c).toContainText('int x = 3;');
  await expect(asm).toContainText('addi a0, zero, 3');
  await expect(page.getByRole('button',{name:'이전 ASM',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'다음 ASM',exact:true}).click();
  await expect(asm).toContainText('addi a1, a0, 1');
  await expect(c).toContainText('int x = 3;');
  await expect(page.getByRole('button',{name:'다음 ASM',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'다음 C 줄',exact:true}).click();
  await expect(c).toContainText('return x;');
  await expect(asm).toContainText('addi a2, a1, 1');
  await expect(page.getByRole('button',{name:'이전 ASM',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'다음 ASM',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'이전 C 줄',exact:true}).click();
  await expect(c).toContainText('int x = 3;');
  await expect(asm).toContainText('addi a0, zero, 3');
});
test('ASM detail stays on the right and C context remains visible while all content is paged',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  await page.getByRole('button',{name:'select second ASM'}).click();
  const c=page.getByRole('complementary',{name:'선택한 C 줄 설명'});
  const cText=await c.locator('.dev-tutor-c-reading>code').innerText();
  await page.getByRole('button',{name:'자세히 보기',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(c).toBeVisible();
  const text=await readPages(page);
  expect(text).toContain('첫 번째 입력값을 가진 레지스터');
  expect(text).toContain('즉치값은 명령어에 직접 적어 넣은 숫자');
  expect(text).toContain('5000은 -2048~2047 범위를 벗어납니다.');
  expect(text).toContain('PC 0x10004');
  expect(await c.locator('.dev-tutor-c-reading>code').innerText()).toBe(cText);
  await page.getByRole('button',{name:'기본 해설로'}).click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('addi a1, a0, 1');
});
test('CPI snapshots exclude future hazards and reopening reflects the selected clock',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  await page.getByRole('button',{name:'CPI와 해저드 분석',exact:true}).click();
  expect(await readPages(page)).toContain('1 ÷ 1 = 1.00');
  await page.getByRole('button',{name:'follow next step'}).click();
  expect(await readPages(page)).not.toContain('실행 이력에서 확인한 대기 원인');
  await page.getByRole('button',{name:'기본 해설로'}).click();
  await page.getByRole('button',{name:'CPI와 해저드 분석',exact:true}).click();
  const later=await readPages(page);
  expect(later).toContain('2 ÷ 1 = 2.00');
  expect(later).toContain('실행 이력에서 확인한 대기 원인');
});
test('pipeline flow selects an ASM and detail reading does not stop playback',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  await page.getByRole('button',{name:'follow next step'}).click();
  await page.getByRole('button',{name:'toggle pipeline focus'}).click();
  const flow=page.getByLabel('현재 클록의 파이프라인 흐름');
  await expect(flow.locator('[data-stage]')).toHaveCount(5);
  await expect(flow.locator('[data-stage=IF]')).toContainText('비어 있음');
  await flow.locator('[data-stage=EX]').click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('addi a1, a0, 1');
  await page.getByRole('button',{name:'global play'}).click();
  await page.getByRole('button',{name:'자세히 보기',exact:true}).click();
  await page.getByRole('button',{name:'follow first step'}).click();
  await expect(page.getByTestId('playback-state')).toHaveText('playing');
  await expect(page.getByRole('region',{name:'튜터 자세히 보기'}).locator('.dev-tutor-detail-bar')).toContainText('addi a1, a0, 1');
});
test('resized pipeline panels keep navigation visible and all detailed text accessible',async({page})=>{
  for(const pipeline of [false,true]){
    await page.goto('/tests/browser/tutor.html?mode=pipeline');
    if(pipeline){await page.getByRole('button',{name:'follow next step'}).click();await page.getByRole('button',{name:'toggle pipeline focus'}).click();}
    else await page.getByRole('button',{name:'select second ASM'}).click();
    await page.locator('.dev-tutor-host').first().evaluate(el=>Object.assign((el as HTMLElement).style,{flex:'none',height:'390px',maxWidth:'530px'}));
    await expect(page.getByRole('button',{name:'자세히 보기',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'다음 ASM',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'자세히 보기',exact:true}).click();
    await page.evaluate(()=>document.documentElement.classList.add('dark'));
    const text=await readPages(page);
    expect(text).toContain('I형 산술 즉치값은 부호 있는 12비트');
    expect(text).toContain('값입니다.');
    const window=page.getByRole('region',{name:'튜터 자세히 보기'});
    expect(await window.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(window).toHaveCount(0);
  }
});
test('direct ASM has no C navigation and no-source instructions stay explicit',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  await page.getByRole('button',{name:'select unmapped ASM'}).click();
  await expect(page.getByRole('complementary',{name:'선택한 C 줄 설명'})).toContainText('C 위치 미확인');
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('nop');
  await page.getByRole('button',{name:'switch target'}).click();
  await expect(page.getByRole('button',{name:'다음 C 줄',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('nop');
});

test('C and ASM details stay inside their own sections and close independently',async({page})=>{
  await page.goto('/tests/browser/tutor.html?mode=pipeline');
  const asm=page.getByRole('region',{name:'선택한 어셈블리 설명'});
  await page.getByRole('button',{name:'C 설명 자세히',exact:true}).click();
  const cDetail=page.getByRole('region',{name:'C 줄 자세히 보기',exact:true});
  await expect(cDetail).toBeVisible();
  await expect(asm.locator('.dev-tutor-asm-code')).toBeVisible();
  const cBox=await cDetail.boundingBox();
  const asmBox=await asm.boundingBox();
  expect(cBox!.x+cBox!.width).toBeLessThanOrEqual(asmBox!.x+1);
  await page.getByRole('button',{name:'다음 ASM',exact:true}).click();
  await expect(asm).toContainText('addi a1, a0, 1');
  await expect(cDetail).toBeVisible();
  await asm.getByRole('button',{name:'자세히 보기',exact:true}).click();
  const asmDetail=page.getByRole('region',{name:'튜터 자세히 보기',exact:true});
  await expect(asmDetail).toBeVisible();
  await expect(cDetail).toBeVisible();
  await cDetail.getByRole('button',{name:'기본 해설로'}).click();
  await expect(cDetail).toHaveCount(0);
  await expect(asmDetail).toBeVisible();
  await expect(page.getByRole('complementary',{name:'선택한 C 줄 설명'})).toBeVisible();
  await asmDetail.getByRole('button',{name:'기본 해설로'}).click();
  await expect(asm.locator('.dev-tutor-asm-code')).toBeVisible();
});
