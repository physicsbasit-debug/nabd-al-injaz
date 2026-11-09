import { test, expect } from '@playwright/test';

test('backup includes evidence and restores plans without losing file bytes', async ({
  page,
}, testInfo) => {
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
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة النسخ الآمن');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByRole('button', { name: 'إضافة نشاط يدوي' }).click();
  await page.getByRole('textbox', { name: 'اسم النشاط *' }).fill('نشاط شاهد');
  await page.getByRole('button', { name: 'حفظ النشاط' }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await page.getByLabel('ملف الشاهد (PDF، صورة، Word، Excel)').setInputFiles({
    name: 'original.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 safe evidence'),
  });
  await page.getByRole('button', { name: 'حفظ الشاهد' }).click();
  await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تنزيل نسخة احتياطية' }).click(),
  ]);
  const archive = JSON.parse(
    (await (await import('node:fs/promises')).readFile(await download.path())).toString(),
  );
  expect(archive.version).toBe(1);
  expect(archive.plans).toHaveLength(1);
  expect(archive.evidence).toHaveLength(1);
  expect(Buffer.from(archive.evidence[0].base64, 'base64').toString()).toBe(
    '%PDF-1.4 safe evidence',
  );

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('استعادة نسخة').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await expect(page.getByText('استُعيدت الخطط والشواهد بنجاح.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /خطة النسخ الآمن/ }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await expect(page.getByText('original.pdf')).toBeVisible();

  const malformed = { ...archive, plans: [{ ...archive.plans[0], archived: 'false' }] };
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('استعادة نسخة').setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(malformed)),
  });
  await expect(
    page.getByText('ملف النسخة غير مطابق لإصدار النسخ الاحتياطي المعتمد.'),
  ).toBeVisible();
  const [report] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تقرير الشواهد CSV' }).click(),
  ]);
  const reportText = (
    await (await import('node:fs/promises')).readFile(await report.path())
  ).toString();
  expect(reportText).toContain('نشاط شاهد');
  expect(reportText).toContain('1');
  const invalid = { ...archive, evidence: [{ ...archive.evidence[0], activityId: 'missing' }] };
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('استعادة نسخة').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.getByText('النسخة تحتوي شاهدًا غير صالح أو غير مرتبط بنشاط.')).toBeVisible();
  await page.getByRole('button', { name: /خطة النسخ الآمن/ }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await expect(page.getByText('original.pdf')).toBeVisible();
});
