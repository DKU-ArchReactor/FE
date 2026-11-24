import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/v1/tutor/explain',route=>route.fulfill({json:{items:route.request().postDataJSON().items.map((item:{text:string})=>({...item,category:'test',title:'해설',summary:item.text,detail:''}))}}));await page.goto('/tests/browser/tutor.html');});
test('single starts with full-width ASM and switches to its mapped C and back',async({page})=>{
  const asm=page.getByRole('region',{name:'선택한 어셈블리 설명'});
  await expect(asm).toBeVisible();
  await expect(page.getByRole('complementary',{name:'선택한 C 줄 설명'})).toHaveCount(0);
  await page.getByRole('button',{name:'연결된 C 설명 보기'}).click();
  await expect(asm).toHaveCount(0);
  await expect(page.getByRole('complementary',{name:'선택한 C 줄 설명'})).toContainText('int x = 3;');
  await page.getByRole('button',{name:'연결된 ASM 설명 보기'}).click();
  await expect(asm).toContainText('addi a0, zero, 3');
  await page.getByRole('button',{name:'다음 ASM',exact:true}).click();
  await expect(asm).toContainText('addi a1, a0, 1');
  await expect(page.getByRole('button',{name:'다음 ASM',exact:true})).toBeDisabled();
});
test('manual source selection chooses the matching screen and Play restores ASM',async({page})=>{
  await page.getByRole('button',{name:'click C source'}).click();
  await expect(page.getByRole('complementary',{name:'선택한 C 줄 설명'})).toBeVisible();
  await page.getByRole('button',{name:'click ASM source'}).click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toBeVisible();
  await page.getByRole('button',{name:'click C source'}).click();
  await page.getByRole('button',{name:'global play'}).click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toBeVisible();
});
test('unmapped ASM has no enabled C link',async({page})=>{
  await page.getByRole('button',{name:'select unmapped ASM'}).click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('nop');
  await expect(page.getByRole('button',{name:'연결된 C 설명 보기'})).toBeDisabled();
  await page.getByRole('button',{name:'global play'}).click();
  await expect(page.getByRole('region',{name:'선택한 어셈블리 설명'})).toContainText('addi a0, zero, 3');
  await expect(page.getByRole('button',{name:'연결된 C 설명 보기'})).toBeEnabled();
});
