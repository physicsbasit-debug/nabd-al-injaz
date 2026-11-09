import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
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

test('Word document extracts preview without auto-approval', async ({ page }, testInfo) => {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip
    .folder('_rels')
    ?.file(
      '.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    );
  zip
    .folder('word')
    ?.file(
      'document.xml',
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Visit classrooms next week</w:t></w:r></w:p></w:body></w:document>',
    );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await page.goto('/');
  if (testInfo.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة Word');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByLabel('ملف الخطة للاستيراد').setInputFiles({
    name: 'sample.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer,
  });
  await expect(page.getByRole('textbox', { name: 'عنوان مقترح: سطر 1' })).toHaveValue(
    'Visit classrooms next week',
  );
  await expect(page.getByText(/لا توجد أنشطة معتمدة لهذه الخطة/)).toBeVisible();
});
test('PDF extracts selectable text and does not auto-approve', async ({ page }, testInfo) => {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  p.drawText('Review learning outcomes weekly', { x: 60, y: 760, font, size: 14 });
  const buffer = Buffer.from(await pdf.save());
  await page.goto('/');
  if (testInfo.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: testInfo.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة PDF');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page
    .getByLabel('ملف الخطة للاستيراد')
    .setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.getByRole('textbox', { name: 'عنوان مقترح: مقطع 1' })).toHaveValue(
    'Review learning outcomes weekly',
  );
  await expect(page.getByText(/لا توجد أنشطة معتمدة لهذه الخطة/)).toBeVisible();
});

test('desktop sidebar stretches with content and review remains within viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'Desktop shell regression');
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة اختبار التوازن');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('الأنشطة');
  sheet.addRow(['النشاط', 'المسؤول']);
  for (let i = 0; i < 24; i++) sheet.addRow(['زيارة صفية رقم ' + (i + 1), 'المعلم الأول']);
  await page.getByLabel('ملف الخطة للاستيراد').setInputFiles({
    name: 'many-activities.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await expect(page.locator('.plan-import-candidates li')).toHaveCount(24);
  const dimensions = await page.evaluate(() => {
    const sidebar = document.querySelector('.layout > aside')!.getBoundingClientRect();
    const main = document.querySelector('.layout > main')!.getBoundingClientRect();
    const layout = document.querySelector('.layout')!.getBoundingClientRect();
    return {
      sidebarBottom: sidebar.bottom,
      mainBottom: main.bottom,
      layoutBottom: layout.bottom,
      viewport: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(dimensions.sidebarBottom).toBeGreaterThanOrEqual(dimensions.mainBottom - 2);
  expect(dimensions.sidebarBottom).toBeGreaterThanOrEqual(dimensions.layoutBottom - 2);
  expect(dimensions.sidebarBottom).toBeGreaterThanOrEqual(dimensions.viewport - 2);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
  await page.screenshot({
    path: 'test-results/plan-import-polished-review-laptop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'تحديد الكل' }).click();
  await expect(page.getByText(/تم اختيار 24 من أصل 24 نشاطًا/)).toBeVisible();
  await page.getByRole('button', { name: /اعتماد 24 نشاط/ }).click();
  await expect(page.locator('.plan-activity-list li')).toHaveCount(8);
  await expect(page.getByRole('navigation', { name: 'صفحات أنشطة الخطة' })).toContainText(
    '1–8 من 24',
  );
  await expect(page.getByText('24 نشاطًا معتمدًا')).toBeVisible();
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByRole('navigation', { name: 'صفحات أنشطة الخطة' })).toContainText(
    '9–16 من 24',
  );
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByRole('navigation', { name: 'صفحات أنشطة الخطة' })).toContainText(
    '17–24 من 24',
  );
  await expect(page.locator('.plan-activity-list li')).toHaveCount(8);
  await page.getByRole('button', { name: 'السابق' }).click();
  await page.getByRole('button', { name: 'السابق' }).click();
  await page.screenshot({
    path: 'test-results/plan-import-polished-approved-laptop.png',
    fullPage: true,
    animations: 'disabled',
  });
});
