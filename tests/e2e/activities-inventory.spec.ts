import { expect, test } from '@playwright/test';

test('سجل الأنشطة والجرد يغلق الواجبات 9 و20 و34 في موجز اليوم', async ({ page }, info) => {
  page.on('dialog', (dialog) => void dialog.accept());
  const navigate = async (name: string) => {
    if (info.project.name === 'phone')
      await page.getByRole('button', { name: /عرض الأقسام/ }).click();
    await page
      .getByRole('navigation', {
        name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
      })
      .getByRole('button', { name, exact: true })
      .click();
  };
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem(
      'nabd-al-injaz:duty-routine:v1',
      JSON.stringify({ version: 1, done: {}, frequency: { 9: 'فصلي', 34: 'فصلي' } }),
    );
  });
  await page.goto('/');
  await navigate('الأنشطة والجرد');
  const section = page.getByRole('region', { name: 'الأنشطة والجرد' });
  await expect(
    section.getByRole('heading', { name: 'الأنشطة والمسابقات والجرد', level: 2 }),
  ).toBeVisible();

  await section.getByLabel('نوع النشاط').selectOption('مسابقة أو برنامج');
  await section.getByLabel('عنوان النشاط').fill('مسابقة الفيزياء المدرسية');
  await section.getByLabel('المشاركون').fill('12 طالبًا');
  await section.getByRole('button', { name: 'حفظ النشاط' }).click();
  await section.getByLabel('نوع النشاط').selectOption('فعالية مع البيت والمجتمع');
  await section.getByLabel('عنوان النشاط').fill('لقاء أولياء أمور الصف التاسع');
  await section.getByRole('button', { name: 'حفظ النشاط' }).click();
  await expect(section.locator('.ai-list li')).toHaveCount(2);
  await section.getByLabel('تصفية حسب النوع').selectOption('مسابقة أو برنامج');
  await expect(section.locator('.ai-list li')).toHaveCount(1);
  await section.getByLabel('تصفية حسب النوع').selectOption('');

  await section.getByLabel('اسم الوسيلة أو الجهاز').fill('جهاز عرض');
  await section.getByLabel('الحالة').selectOption('يحتاج صيانة');
  await section.getByRole('button', { name: 'إضافة الصنف' }).click();
  await expect(section.locator('.ai-issues')).toContainText('جهاز عرض (يحتاج صيانة)');
  await section.getByRole('button', { name: 'اعتماد جرد اليوم (الواجب 9)' }).click();
  await expect(section.locator('.ai-history summary')).toContainText('سجل الجرد (1)');
  await section.getByRole('button', { name: 'حذف جهاز عرض' }).click();
  await expect(section.locator('.ai-issues')).toHaveCount(0);

  await page.reload();
  await navigate('الرئيسية');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await brief.getByRole('button', { name: /روتين الواجبات/ }).click();
  await brief.locator('summary').filter({ hasText: 'واجبات فصلية' }).click();
  const duty = (title: string) =>
    brief.locator('.brief-item').filter({
      has: page.locator('.brief-item-text strong', { hasText: new RegExp(`^${title}$`) }),
    });
  await expect(duty('تقنيات التعليم والوسائل وجردها')).toContainText('أُنجز من السجلات: جرد 1 صنفًا');
  await expect(duty('التعاون مع البيت والمجتمع')).toContainText(
    'فعالية مع البيت والمجتمع: لقاء أولياء أمور الصف التاسع',
  );
});
