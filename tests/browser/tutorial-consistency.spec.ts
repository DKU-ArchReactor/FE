import {test, expect} from '@playwright/test';

test('first-run tutorial uses its own matching source and closing restores the loop editor', async ({page}) => {
  await page.route('**/api/v1/**', route => route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
  await page.goto('/simulator?example=loop&tutorial=1');
  const source = page.locator('.monaco-editor .view-lines').first();
  await expect(source).toContainText('int a = 5', {timeout:25000});
  await expect(source).toContainText('int b = 3');
  await expect(source).not.toContainText('for (');
  await page.getByRole('dialog').getByRole('button', {name:/닫기/}).click();
  await expect(source).toContainText('for (');
  await expect(source).toContainText('sum += i');
});
