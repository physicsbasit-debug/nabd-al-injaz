import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

async function openSchedules(page: import('@playwright/test').Page, mobile: boolean) {
  await page.goto('/');
  if (mobile) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: mobile ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الجداول والاحتياط' }).click();
}
test('manual schedules persist, reject conflicts and show free teachers', async ({ page }, testInfo) => {
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('أحمد');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('سالم');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByLabel('معلم الحصة').selectOption('أحمد');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await expect(page.getByText('تم تسجيل الحصة.')).toBeVisible();
  await expect(page.getByText('المتفرغون من بين المعلمين المسجلين:')).toContainText('1 من 2');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await expect(page.getByText('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.')).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الجداول والاحتياط' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
  await page.screenshot({ path: 'test-results/schedules-' + testInfo.project.name + '.png', fullPage: true });
});
test('Excel preview requires approval and rejects duplicate rows', async ({ page }, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('جدول');
  sheet.addRow(['المعلم', 'اليوم', 'الحصة', 'المادة']);
  sheet.addRow(['نورة', 'الإثنين', 2, 'العلوم']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({ name: 'schedule.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (1)' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'اعتماد الجدول (1)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({ name: 'schedule.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await page.getByRole('button', { name: 'اعتماد الجدول (1)' }).click();
  await expect(page.getByText('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
});
