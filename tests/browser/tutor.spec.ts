import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  // Unseeded runtime explanations must stay inside this isolated fixture server.
  await page.route('**/api/v1/tutor/explain', route => route.fulfill({json: {
    items: route.request().postDataJSON().items.map((item: {kind: string; text: string}) => ({
      kind: item.kind, category: 'unmapped', title: '문맥', summary: item.text, detail: '',
    })),
  }}));
});

test('instruction detail rows have consistent spacing when closed and after toggling', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByRole('button', {name: 'select second ASM', exact: true}).click();
  const details = page.locator('[data-asm-index="1"] .tutor-instruction-details');
  await details.locator(':scope > summary').click();
  const rows = details.locator(':scope > div > details > summary');
  await expect(rows).toHaveCount(3);
  const measure = () => rows.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {top: rect.top, bottom: rect.bottom, height: rect.height};
  }));
  const check = async () => {
    const boxes = await measure();
    expect(Math.max(...boxes.map(box => box.height)) - Math.min(...boxes.map(box => box.height))).toBeLessThanOrEqual(1);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].top - boxes[i - 1].bottom).toBeLessThanOrEqual(1);
    }
  };
  await check();
  await rows.first().click();
  await rows.first().click();
  await check();
  await page.setViewportSize({width: 390, height: 844});
  await check();
});

test('CPI and instruction hazard analysis advance with history and exclude future records', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByText('CPI와 해저드 분석', {exact: true}).click();
  await expect(page.getByText('실행 이력에서 확인한 대기 원인', {exact: true})).not.toBeVisible();
  await page.getByRole('button', {name: 'follow next step'}).click();
  const summary = page.locator('details').filter({has: page.locator('summary', {hasText: 'CPI와 해저드 분석'})});
  await expect(summary).toContainText('2 ÷ 1 = 2.00');
  await summary.getByText('주요 관찰 원인', {exact: true}).click();
  await expect(summary.getByText('실행 이력에서 확인한 대기 원인', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'follow first step'}).click();
  await expect(page.getByText('실행 이력에서 확인한 대기 원인', {exact: true})).not.toBeVisible();
});

test('unmapped instructions show a short explanation and collapsed runtime context', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByRole('button', {name: 'select unmapped ASM'}).click();
  const panel = page.getByRole('region', {name: '튜터 해설 패널'});
  await expect(panel.getByText('소스 위치 미확인', {exact: true})).toBeVisible();
  await expect(panel.getByText('상태를 유지합니다.', {exact: true})).toBeVisible();
  const context = panel.locator('details').filter({has: page.locator('summary', {hasText: '소스 위치와 실행 문맥'})});
  await expect(context).not.toHaveAttribute('open', '');
  await context.locator('summary').click();
  await expect(context).toHaveAttribute('open', '');
});

test('selected C and direct ASM retain detailed instruction and cycle evidence', async ({page}) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/tests/browser/tutor.html');
  const panel = page.getByRole('region', {name: '튜터 해설 패널'});
  await expect(panel.getByText('매핑된 ASM:', {exact: true})).toBeVisible();
  await expect(panel.getByText('값 준비 → 초기값 기록', {exact: true})).toBeVisible();
  await expect(panel.getByText('a0 = zero + 3', {exact: true})).toBeVisible();
  await expect(panel.getByText('제어 흐름 판단', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'switch target'}).click();
  await expect(panel.getByText('선택한 ASM:', {exact: true})).toBeVisible();
  await expect(panel.getByText('a0 = zero + 3', {exact: true})).toBeVisible();
  await expect(panel.getByText('제어 흐름 판단', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'toggle selection'}).click();
  await expect(panel.getByText('RISC-V 어셈블리 실행 분석', {exact: true})).toBeVisible();
  await expect(panel.getByText('제어 흐름 판단', {exact: true})).toBeVisible();
  expect(failures).toEqual([]);
});

test('automatic playback focus follows successive instructions within the same C line in both modes', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  const panel = page.getByRole('region', {name: '튜터 해설 패널'});
  for (const stage of ['IF', 'EX']) {
    if (stage === 'EX') await page.getByRole('button', {name: 'toggle pipeline focus'}).click();
    await page.getByRole('button', {name: 'follow first step'}).click();
    await expect(panel).toContainText(`${stage} · 실행 따라가기`);
    await expect(panel.locator('[data-asm-index="0"]')).toContainText('현재 설명');
    await page.getByRole('button', {name: 'follow next step'}).click();
    await expect(panel.locator('[data-asm-index="1"]')).toContainText('현재 설명');
    await expect(panel.locator('[data-asm-index="0"]')).not.toContainText('현재 설명');
    const bounds = await panel.locator('[data-asm-index="1"]').evaluate(element => {
      const body = element.closest('.overflow-y-auto')!;
      return {top: element.getBoundingClientRect().top - body.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom - body.getBoundingClientRect().top, height: body.clientHeight};
    });
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
  }
});

test('contextual concepts reveal examples and answers with keyboard without mixing execution evidence', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByRole('button', {name: 'select second ASM'}).click();
  await page.locator('[data-asm-index="1"]').getByText('자세히 보기', {exact: true}).click();
  await page.getByText('관련 핵심 개념 · 1개', {exact: true}).click();
  const concepts = page.getByRole('region', {name: '관련 RISC-V 핵심 개념'});
  await expect(concepts).toContainText('현재 실행값과 별개');
  const topic = concepts.locator('summary').filter({hasText: '즉치값은 명령어 안의 상수'});
  await expect(concepts.getByText('학습 예제', {exact: true})).not.toBeVisible();
  await topic.focus();
  await topic.press('Enter');
  await expect(concepts.getByText('즉치값은 명령어에 직접 적어 넣은 숫자입니다.', {exact: true})).toBeVisible();
  await expect(concepts.getByText('I형 산술 즉치값은 부호 있는 12비트 값입니다.', {exact: true})).not.toBeVisible();
  await concepts.getByText('원리와 주의사항 더 보기', {exact: true}).click();
  await expect(concepts.getByText('I형 산술 즉치값은 부호 있는 12비트 값입니다.', {exact: true})).toBeVisible();
  await expect(concepts.getByText('학습 예제', {exact: true})).toBeVisible();
  await expect(concepts.getByText('5000은 -2048~2047 범위를 벗어납니다.', {exact: true})).toBeVisible();
  await expect(concepts.getByRole('link', {name: /RISC-V 공식/})).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('region', {name: '튜터 해설 패널'}).evaluate(element => {element.style.maxWidth = '380px';});
  const overflow = await concepts.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(topic).toBeVisible();
});

test('a selected instruction stays compact while full detail remains available on demand', async ({page}) => {
  await page.goto('/tests/browser/tutor.html');
  await page.getByRole('button', {name: 'select second ASM'}).click();
  const panel = page.getByRole('region', {name: '튜터 해설 패널'});
  await expect(panel).toContainText('전체 ASM 3개 중 C 1줄에 연결된 2개를 모두 설명합니다.');
  await expect(panel).toContainText('선택한 명령어는 이 그룹의 2번째입니다.');
  await expect(panel.getByText('a0 = zero + 3', {exact: true})).toBeVisible();
  await expect(panel.getByText('a1 = a0 + 1', {exact: true})).toBeVisible();
  await expect(panel.getByText('첫 번째 입력값을 가진 레지스터', {exact: false})).not.toBeVisible();
  const card = panel.locator('[data-asm-index="1"]');
  const size = await card.evaluate(element => ({height: element.getBoundingClientRect().height, viewport: element.closest('.overflow-y-auto')!.clientHeight}));
  expect(size.height).toBeLessThanOrEqual(size.viewport - 12);
  const offset = await panel.locator('[data-asm-index="1"]').evaluate(element => {
    const body = element.closest('.overflow-y-auto');
    return element.getBoundingClientRect().top - body!.getBoundingClientRect().top;
  });
  expect(offset).toBeGreaterThanOrEqual(0);
  expect(offset).toBeLessThanOrEqual(24);
  await card.getByText('자세히 보기', {exact: true}).click();
  await card.getByText('처리 순서와 항목별 역할', {exact: true}).click();
  await expect(card.getByRole('region', {name: '명령어 한눈에 읽기'})).toContainText('명령어에 적힌 숫자 1');
  await expect(card.getByText('같은 C 줄의 정적 레지스터 연결', {exact: true})).toBeVisible();
  await card.getByText('매핑·레지스터 정보', {exact: true}).click();
  await expect(card.getByText('PC 0x10004', {exact: true})).toBeVisible();
});
