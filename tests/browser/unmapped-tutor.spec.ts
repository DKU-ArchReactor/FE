import {test,expect} from '@playwright/test';

test('unmapped selections and startup playback do not retain a stale C explanation',async({page})=>{
  await page.goto('/tests/browser/unmapped-tutor.html');
  const tutor=page.locator('.tutor-single-container');
  await expect(tutor).toHaveAttribute('data-view','c');
  await page.getByRole('button',{name:'play startup',exact:true}).click();
  await expect(tutor).toHaveAttribute('data-view','asm');
  await expect(tutor).toHaveAttribute('data-has-c','false');
  const active=tutor.locator('.tutor-single-card-slide.active');
  await expect(active).toContainText('프로그램 시작 코드 · C 연결 없음');
  await expect(active).toContainText('현재 명령어가 놓인 주소를');
  await expect(tutor.getByRole('button',{name:'C: L2 설명 보기'})).toHaveCount(0);
  await page.getByRole('button',{name:'select ASM 2',exact:true}).click();
  await expect(active).toContainText('연결된 C 줄 없음');
  await expect(active).not.toContainText('프로그램 시작 코드');
  await expect(active).toContainText('점프합니다');
  await page.getByRole('button',{name:'select ASM 3',exact:true}).click();
  await expect(tutor.getByRole('button',{name:'C: L2 설명 보기'})).toBeVisible();
  await tutor.getByRole('button',{name:'C: L2 설명 보기'}).click();
  await expect(tutor).toHaveAttribute('data-view','c');
  await expect(tutor.locator('.tutor-single-page-c')).toContainText('int a = 5;');
});
