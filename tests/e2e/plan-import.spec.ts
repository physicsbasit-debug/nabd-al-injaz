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
  await page
    .getByLabel('ملف الخطة للاستيراد')
    .setInputFiles({
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
