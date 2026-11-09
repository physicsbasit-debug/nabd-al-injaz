import { test, expect } from '@playwright/test';
test('creates independent plans and updates home indicators from real activities', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة المادة 2026');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبة الخطط', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'إضافة نشاط يدوي' }).click();
  await page.getByRole('textbox', { name: 'اسم النشاط *' }).fill('تنفيذ درس تطبيقي');
  await page.getByRole('button', { name: 'حفظ النشاط' }).click();
  await page
    .getByRole('combobox', { name: 'حالة النشاط: تنفيذ درس تطبيقي' })
    .selectOption('completed');
  await expect(page.getByText('100%').first()).toBeVisible();
  await page.screenshot({path:'test-results/plan-library-detail-'+testInfo.project.name+'.png',fullPage:true,animations:'disabled'});
  if (await page.locator('.desktop-navigation').isVisible()) {
    await page.locator('.desktop-navigation').getByRole('button', { name: 'الرئيسية' }).click();
  } else {
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
    await page.locator('.mobile-section-list').getByRole('button', { name: 'الرئيسية' }).click();
  }
  await expect(page.getByRole('button', { name: 'فتح خطة: خطة المادة 2026' })).toContainText(
    '100%',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'فتح خطة: خطة المادة 2026' })).toContainText(
    '100%',
  );
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
});
test('empty plans show no fabricated completion and remain separate from tasks', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('لا توجد خطط مضافة بعد')).toBeVisible();
  await expect(page.getByRole('region', { name: 'مؤشرات المهام' })).toBeVisible();
});
