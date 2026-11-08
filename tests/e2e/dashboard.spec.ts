import { test, expect } from '@playwright/test';

test('Arabic dashboard renders and updates real task progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'الرئيسية' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 25%' })).toBeVisible();
  await page.getByRole('button', { name: /مراجعة الاختبارات القصيرة/ }).click();
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 50%' })).toBeVisible();
  await page.screenshot({ path: `test-results/dashboard-${test.info().project.name}.png`, fullPage: true });
});

test('navigation works and the page has no document-level horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'الخطط والمهام' }).click();
  await expect(page.getByRole('heading', { name: 'الخطط والمهام' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
});
