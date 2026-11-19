import {test, expect} from '@playwright/test';

test('one C line keeps all ASM choices while actual values follow the selected execution', async ({page}) => {
  await page.goto('/tests/browser/line-flow.html');
  const diagram = page.getByRole('group', {name: '선택 명령어의 데이터 흐름'});
  await expect(page.getByText('C 5줄 → ASM 4개', {exact: true})).toBeVisible();
  await expect(page.getByText('int sum = a + b;', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'ALU · 연산 장치 설명 보기', exact: true}).click();
  await expect(diagram.locator('[data-flow-route="operands"]')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('region', {name: '현재 동작 상세'})).toContainText('18');
  const list = page.locator('[aria-label="선택 C 줄의 ASM 명령어"]');
  await expect(list.getByRole('button')).toHaveCount(4);
  await list.getByRole('button').first().click();
  await expect(page.getByText('선택 명령어의 의미 · 현재 클록의 실행값과 구분')).toBeVisible();
  const values = page.getByRole('region', {name: '레지스터와 ALU의 실제 값'});
  await expect(values).not.toContainText('0x00000012');
  await page.getByRole('button', {name: '이 명령어의 실행 시점으로 이동'}).click();
  await page.getByRole('button', {name: '메모리 설명 보기', exact: true}).click();
  await expect(page.getByRole('region', {name: '현재 동작 상세'})).toContainText('11');
  await expect(diagram.locator('[data-flow-route="address"]')).toHaveAttribute('data-active', 'true');
});

test('store routes do not claim register writeback and CU uses real signals', async ({page}) => {
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button', {name: 'next clock'}).click();
  await page.getByRole('button', {name: '메모리 설명 보기', exact: true}).click();
  await expect(page.locator('[data-flow-route="store"]')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('region', {name: '현재 동작 상세'})).toContainText('레지스터에 결과를 쓰지 않습니다');
  await expect(page.locator('[data-flow-route="writeback"]')).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'CU 제어 신호'})).toContainText('1 · 데이터 쓰기');
});

test('full-page lesson exposes encoded fields, supports keyboard and closes with Escape', async ({page}) => {
  await page.goto('/tests/browser/line-flow.html');
  const open = page.getByRole('button', {name: 'open lesson'});
  await open.click();
  const dialog = page.getByRole('dialog', {name: 'C·ASM 통합 설명'});
  await expect(dialog).toBeVisible();
  await dialog.getByText('R형 명령어 포맷', {exact: false}).click();
  await expect(dialog.getByText('기계어', {exact: false}).last()).toContainText('0x');
  const registers = dialog.getByRole('button', {name: '레지스터 설명 보기', exact: true});
  await registers.focus();
  await registers.press('Enter');
  await expect(dialog.getByRole('region', {name: '현재 동작 상세'})).toContainText('입력 준비');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('explanation playback does not advance the CPU clock and narrow dialogs keep internal scrolling', async ({page}) => {
  await page.clock.install();
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button', {name: '흐름 설명 재생', exact: true}).click();
  await page.clock.fastForward(1200);
  await expect(page.getByRole('button', {name: /2\s*입력 준비/})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/CORE clock 12/)).toBeVisible();
  await page.getByRole('button', {name: 'open lesson'}).click();
  await page.setViewportSize({width: 390, height: 844});
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const dialog = page.getByRole('dialog');
  const sizes = await dialog.evaluate(element => ({width: element.clientWidth, scrollWidth: element.scrollWidth}));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width + 1);
  await expect(dialog.getByRole('button', {name: '통합 설명 닫기', exact: true})).toBeVisible();
});

test('the existing overview remains available beside the instruction lesson', async ({page}) => {
  await page.goto('/tests/browser/line-flow.html');
  await page.getByRole('button', {name: '전체 상태', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'SINGLE-CYCLE DATAPATH', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '명령어 흐름', exact: true}).click();
  await expect(page.getByRole('group', {name: '선택 명령어의 데이터 흐름'})).toBeVisible();
});
