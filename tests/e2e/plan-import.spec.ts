import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
test('file import previews Excel rows and requires explicit approval', async ({
  page,
}, testInfo) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('الأنشطة');
  sheet.addRow(['النشاط', 'المسؤول']);
  sheet.addRow(['زيارة صفية تجريبية', 'المعلم الأول']);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.goto('/');
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  }
  await page
    .getByRole('navigation', {
      name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة مستوردة');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByLabel('ملف الخطة للاستيراد').setInputFiles({
    name: 'sample.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByRole('textbox', { name: 'عنوان مقترح: الأنشطة، صف 2' })).toHaveValue(
    'زيارة صفية تجريبية',
  );
  await expect(page.getByText(/لا توجد أنشطة معتمدة لهذه الخطة/)).toBeVisible();
  await page.screenshot({
    path: 'test-results/plan-import-preview-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'تحديد الكل' }).click();
  await page.getByRole('button', { name: /اعتماد [1-9]/ }).click();
  await expect(page.locator('.plan-activity-list')).toContainText('زيارة صفية تجريبية');
  await page.screenshot({
    path: 'test-results/plan-import-approved-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.reload();
  if (testInfo.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
  await page.getByRole('button', { name: /خطة مستوردة/ }).click();
  await expect(page.locator('.plan-activity-list')).toContainText('زيارة صفية تجريبية');
});
