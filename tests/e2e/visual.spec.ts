import { test, expect } from '@playwright/test';

test('capture reviewable dashboard and task states', async ({ page }, testInfo) => {
  const device = testInfo.project.name;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'الرئيسية', level: 1 })).toBeVisible();
  await page.screenshot({
    path: `test-results/visual-dashboard-${device}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  if (device === 'phone') {
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
    await page.screenshot({
      path: `test-results/visual-mobile-menu-${device}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page
    .getByRole('navigation', { name: device === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الخطط والمهام' })
    .click();
  await page.screenshot({
    path: `test-results/visual-tasks-empty-${device}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'إضافة مهمة جديدة' }).click();
  await page.screenshot({
    path: `test-results/visual-add-form-${device}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByPlaceholder('مثال: متابعة تنفيذ الخطة الأسبوعية').fill('متابعة خطة العلوم');
  await page.getByRole('button', { name: 'إضافة المهمة' }).click();
  await page.screenshot({
    path: `test-results/visual-tasks-list-${device}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'تعديل' }).click();
  await page.screenshot({
    path: `test-results/visual-tasks-edit-${device}.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
