import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test('approved imported activity appears in its section after reload', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  async function navigate(section: string) {
    if (phone) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
    await page.getByRole('navigation', { name: phone ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
      .getByRole('button', { name: section, exact: true }).click();
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('الأنشطة');
  sheet.addRow(['النشاط']);
  sheet.addRow(['الزيارات المتبادلة بين المعلمين']);
  await page.goto('/');
  await navigate('مكتبة الخطط');
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة المدرسة');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByLabel('ملف الخطة للاستيراد').setInputFiles({
    name: 'plan.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await expect(page.getByLabel('قسم النشاط: الأنشطة، صف 2')).toHaveValue('الزيارات المتبادلة');
  await page.getByRole('button', { name: 'تحديد الكل' }).click();
  await page.getByRole('button', { name: /اعتماد 1 نشاط/ }).click();
  await navigate('الزيارات المتبادلة');
  const section = page.getByRole('region', { name: 'أنشطة الخطط: الزيارات المتبادلة' });
  await expect(section.getByText('الزيارات المتبادلة بين المعلمين', { exact: true })).toHaveCount(1);
  await page.reload();
  await navigate('الزيارات المتبادلة');
  await expect(section.getByText('الزيارات المتبادلة بين المعلمين', { exact: true })).toHaveCount(1);
  await section.getByRole('button', { name: 'فتح الخطة' }).click();
  await expect(page.locator('.plan-activity-list')).toContainText('الزيارات المتبادلة بين المعلمين');
  await page.getByLabel('قسم النشاط: الزيارات المتبادلة بين المعلمين').selectOption('الإنماء المهني');
  await navigate('الزيارات المتبادلة');
  await expect(section.getByText('الزيارات المتبادلة بين المعلمين', { exact: true })).toHaveCount(0);
  await navigate('الإنماء المهني');
  await expect(page.getByRole('region', { name: 'أنشطة الخطط: الإنماء المهني' })
    .getByText('الزيارات المتبادلة بين المعلمين', { exact: true })).toHaveCount(1);
});
