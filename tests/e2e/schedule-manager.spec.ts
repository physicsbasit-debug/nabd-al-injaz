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
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('0 من 2');
  await page.getByLabel('معلم التحقق').selectOption('سالم');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.locator('.schedule-absent').getByLabel('أحمد').check();
  await expect(page.getByRole('heading', { name: 'معاينة الاحتياط للغياب' }).locator('..').locator('tbody')).toContainText('سالم');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await expect(page.getByText('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.')).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الجداول والاحتياط' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
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

test('wide template imports blank free periods only after explicit completeness approval', async ({ page }, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('الجدول الأفقي');
  sheet.addRow(['مقدمة']);
  sheet.addRow(['اسم المعلم', 'اليوم', 'ح1', 'ح2', 'ح3']);
  sheet.addRow(['أحمد', 'الأحد', 'تاسع 1 علوم', '', '']);
  sheet.addRow(['سالم', 'الأحد', '', 'عاشر 2 فيزياء', '']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({ name: 'wide.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByText(/نوع القالب: جدول حصص أفقي/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (2)' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /أؤكد أن صفوف الأيام كاملة/ }).check();
  await page.getByRole('button', { name: 'اعتماد الجدول (2)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (2)' })).toBeVisible();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.locator('.schedule-absent').getByLabel('أحمد').check();
  await expect(page.getByRole('heading', { name: 'معاينة الاحتياط للغياب' }).locator('..').locator('tbody')).toContainText('سالم');
  await page.reload();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'الجداول والاحتياط' }).click();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
});
test('wide template with missing period column is rejected without partial import', async ({ page }, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('الجدول');
  sheet.addRow(['المعلم', 'اليوم', 'ح1', 'ح3']);
  sheet.addRow(['أحمد', 'الأحد', 'علوم', 'فيزياء']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({ name: 'gap.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByText(/أعمدة الحصص يجب أن تبدأ من ح1/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (2)' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (0)' })).toBeVisible();
});

test('date-scoped cover draft persists and invalidates stale assignments', async ({ page }, testInfo) => {
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('أحمد');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('سالم');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByLabel('معلم الحصة').selectOption('أحمد');
  await page.getByLabel('يوم الحصة').selectOption('الثلاثاء');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await page.getByLabel('يوم التحقق').selectOption('الثلاثاء');
  await page.getByLabel('معلم التحقق').selectOption('أحمد');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  await page.getByLabel('معلم التحقق').selectOption('سالم');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  const panel = page.getByRole('region', { name: 'مسودة توزيع الاحتياط' });
  await panel.getByLabel('تاريخ مسودة الاحتياط').fill('2026-11-10');
  await panel.getByLabel('أحمد').check();
  await panel.getByLabel('بديل أحمد الحصة 1').selectOption('سالم');
  await panel.getByRole('button', { name: 'إضافة للمسودة' }).click();
  await expect(panel.getByText('تكليفات المسودة (1)')).toBeVisible();
  await expect(panel.getByText('صالح للمراجعة اليدوية')).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'الجداول والاحتياط' }).click();
  const restored = page.getByRole('region', { name: 'مسودة توزيع الاحتياط' });
  await restored.getByLabel('تاريخ مسودة الاحتياط').fill('2026-11-10');
  await expect(restored.getByText('تكليفات المسودة (1)')).toBeVisible();
  await restored.getByLabel('أحمد').uncheck();
  await expect(restored.getByRole('alert')).toContainText('تكليف غير صالح');
  await restored.getByRole('button', { name: 'إلغاء تكليف سالم عن أحمد' }).click();
  await expect(restored.getByText('تكليفات المسودة (0)')).toBeVisible();
});
