import { test, expect } from '@playwright/test';
test('evidence stays attached after reload and never auto-completes activity', async ({
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
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة الشواهد التجريبية');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByRole('button', { name: 'إضافة نشاط يدوي' }).click();
  await page.getByRole('textbox', { name: 'اسم النشاط *' }).fill('زيارة صفية موثقة');
  await page.getByRole('button', { name: 'حفظ النشاط' }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await page.getByLabel('ملف الشاهد (PDF، صورة، Word، Excel)').setInputFiles({
    name: 'evidence.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test evidence'),
  });
  await page.getByRole('button', { name: 'حفظ الشاهد' }).click();
  await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
  await expect(page.getByText('evidence.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await expect(page.getByText(/شواهد مرفقة • غير مكتمل/)).toBeVisible();
  await expect(page.getByText('0% إنجاز').first()).toBeVisible();
  await page.screenshot({
    path: 'test-results/evidence-' + testInfo.project.name + '.png',
    fullPage: true,
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
  await page.getByRole('button', { name: /خطة الشواهد التجريبية/ }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await expect(page.getByText('evidence.pdf')).toBeVisible();
  await page.getByLabel('ملف الشاهد (PDF، صورة، Word، Excel)').setInputFiles({
    name: 'evil.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<script>bad</script>'),
  });
  await page.getByRole('button', { name: 'حفظ الشاهد' }).click();
  await expect(page.getByRole('alert')).toContainText('نوع الملف غير مدعوم');
  await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
});

test('plan deletion removes only its own evidence and preserves other plans', async ({
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
  for (const name of ['خطة أولى', 'خطة ثانية']) {
    await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
    await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill(name);
    await page.getByRole('button', { name: 'حفظ الخطة' }).click();
    await page.getByRole('button', { name: 'إضافة نشاط يدوي' }).click();
    await page.getByRole('textbox', { name: 'اسم النشاط *' }).fill('نشاط ' + name);
    await page.getByRole('button', { name: 'حفظ النشاط' }).click();
    await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
    await page
      .getByLabel('ملف الشاهد (PDF، صورة، Word، Excel)')
      .setInputFiles({
        name: name + '.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 ' + name),
      });
    await page.getByRole('button', { name: 'حفظ الشاهد' }).click();
    await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  }
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /خطة أولى/ }).click();
  await page.getByRole('button', { name: 'حذف الخطة وشواهدها' }).click();
  await expect(page.getByRole('button', { name: /خطة أولى/ })).toHaveCount(0);
  await page.getByRole('button', { name: /خطة ثانية/ }).click();
  await page.getByRole('button', { name: 'الشواهد والتوثيق' }).click();
  await expect(page.getByText('خطة ثانية.pdf')).toBeVisible();
  await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
});
