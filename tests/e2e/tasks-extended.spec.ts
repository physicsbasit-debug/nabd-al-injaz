import { test, expect } from '@playwright/test';

async function openTasks(page: import('@playwright/test').Page, device: string) {
  await page.goto('/');
  if (device === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: device === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الخطط والمهام' })
    .click();
}

test('educational fields, filters, editing and local persistence', async ({ page }, testInfo) => {
  await openTasks(page, testInfo.project.name);
  await page.getByRole('button', { name: 'إضافة مهمة جديدة' }).click();
  await page.getByPlaceholder('مثال: متابعة تنفيذ الخطة الأسبوعية').fill('متابعة خطة المختبر');
  await page.getByLabel('المجال', { exact: true }).selectOption('متابعة فنية');
  await page.getByLabel('المسؤول عن التنفيذ').fill('فريق العلوم');
  await page.getByLabel('حالة التنفيذ').selectOption('قيد التنفيذ');
  await page.getByLabel('تاريخ الاستحقاق').fill('2026-11-20');
  await expect(page.getByText(/التاريخ المختار:.*نوفمبر/)).toBeVisible();
  await page.getByLabel('ملاحظات المتابعة').fill('مراجعة تجهيز المختبر');
  await page.getByRole('button', { name: 'إضافة المهمة' }).click();

  await expect(page.getByText('متابعة خطة المختبر')).toBeVisible();
  await expect(page.getByText('المسؤول: فريق العلوم')).toBeVisible();
  await expect(page.getByText('مراجعة تجهيز المختبر')).toBeVisible();
  await expect(page.getByText('قيد التنفيذ: 1')).toBeVisible();
  await expect(page.getByText(/الاستحقاق:.*نوفمبر/)).toBeVisible();
  await page.getByLabel('تصفية حسب المجال').selectOption('تخطيط ومناهج');
  await expect(page.getByText('لا توجد مهام تطابق خيارات العرض الحالية.')).toBeVisible();
  await page.getByLabel('تصفية حسب المجال').selectOption('متابعة فنية');
  await page.getByLabel('بحث في المهام').fill('فريق العلوم');
  await expect(page.getByText('متابعة خطة المختبر')).toBeVisible();
  await page.getByLabel('بحث في المهام').fill('غير موجود');
  await expect(page.getByText('لا توجد مهام تطابق خيارات العرض الحالية.')).toBeVisible();
  await page.getByLabel('بحث في المهام').clear();

  await page.getByRole('button', { name: 'تعديل' }).click();
  await page.getByLabel('حالة التنفيذ').selectOption('مكتملة');
  await page.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(page.getByText('قيد التنفيذ: 0')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'الخطط والمهام' })
    .click();
  await expect(page.getByText('المسؤول: فريق العلوم')).toBeVisible();
  await expect(page.getByText('مراجعة تجهيز المختبر')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await page.getByRole('checkbox').uncheck();
  await expect(page.getByText('قيد التنفيذ: 1')).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();
  await page.screenshot({
    path: 'test-results/educational-tasks-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('expanded educational forms remain within the viewport', async ({ page }, testInfo) => {
  await openTasks(page, testInfo.project.name);
  await page.getByRole('button', { name: 'إضافة مهمة جديدة' }).click();
  const size = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(size.document).toBeLessThanOrEqual(size.viewport + 1);
  await expect(page.getByLabel('المسؤول عن التنفيذ')).toBeVisible();
  await expect(page.getByLabel('ملاحظات المتابعة')).toBeVisible();
});
