import { expect, test } from '@playwright/test';

test('سجّل إنجازًا من الموجز: زيارة وفحص ونشاط وإنجاز لواجب في ثوانٍ', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({ teachers: ['أحمد سعيد', 'سالم الهنائي'], lessons: [], verifiedDays: [] }),
    );
    localStorage.setItem(
      'nabd-al-injaz:duty-routine:v1',
      JSON.stringify({ version: 1, done: {}, frequency: { 20: 'فصلي', 9: 'فصلي' } }),
    );
  });
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
  await page.goto('/');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  const capture = brief.getByRole('dialog', { name: 'سجّل إنجازًا' });
  const duty = (title: string) =>
    brief
      .locator('.brief-item')
      .filter({
        has: page.locator('.brief-item-text strong', { hasText: new RegExp(`^${title}$`) }),
      });

  // زيارة: الاسم الجزئي يُقترح كاملًا
  await brief.getByRole('button', { name: '+ سجّل إنجازًا' }).click();
  await capture.getByLabel('المعلم').fill('سالم');
  await capture.getByRole('button', { name: 'سالم الهنائي' }).click();
  await expect(capture.getByLabel('المعلم')).toHaveValue('سالم الهنائي');
  await capture.getByLabel('ملاحظة مختصرة').fill('حصة الكثافة');
  await capture.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(brief.getByRole('status')).toContainText('سُجلت زيارة سالم الهنائي');

  // فحص
  await brief.getByRole('button', { name: '+ سجّل إنجازًا' }).click();
  await capture.getByRole('button', { name: 'فحص لمعلم' }).click();
  await capture.getByLabel('المعلم').fill('أحمد سعيد');
  await capture.getByLabel('الفحص').selectOption('درجات');
  await capture.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(brief.getByRole('status')).toContainText(
    'إدخال الدرجات في البوابة للمعلم أحمد سعيد',
  );

  // نشاط
  await brief.getByRole('button', { name: '+ سجّل إنجازًا' }).click();
  await capture.getByRole('button', { name: 'نشاط أو مسابقة' }).click();
  await capture.getByLabel('نوع النشاط').selectOption('مسابقة أو برنامج');
  await capture.getByLabel('عنوان النشاط').fill('مسابقة الفيزياء');
  await capture.getByRole('button', { name: 'حفظ', exact: true }).click();

  // إنجاز لواجب آخر بلا قسم: يُنشئ مهمة مكتملة مرتبطة
  await brief.getByRole('button', { name: '+ سجّل إنجازًا' }).click();
  await capture.getByRole('button', { name: 'إنجاز لواجب آخر' }).click();
  await capture.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(capture.getByRole('alert')).toContainText('اكتب وصفًا قصيرًا');
  await capture.getByLabel('ماذا أنجزت؟').fill('جرد مختبر الفيزياء');
  await capture.getByLabel('الواجب').selectOption('9');
  await capture.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(capture).toHaveCount(0);

  await brief.getByRole('button', { name: /روتين الواجبات/ }).click();
  await expect(duty('الزيارات الإشرافية والتغذية الراجعة')).toContainText('أُنجز من السجلات');
  await brief.locator('summary').filter({ hasText: 'واجبات شهرية' }).click();
  await expect(duty('متابعة إدخال المعلمين للدرجات')).toContainText(
    'إدخال الدرجات في البوابة: أحمد سعيد',
  );
  await brief.locator('summary').filter({ hasText: 'واجبات فصلية' }).click();
  await expect(duty('المسابقات والبرامج')).toContainText('مسابقة أو برنامج: مسابقة الفيزياء');
  await expect(duty('تقنيات التعليم والوسائل وجردها')).toContainText('جرد مختبر الفيزياء');

  await navigate('الزيارات الإشرافية');
  const visit = page.locator('.short-test-item').filter({ hasText: 'سالم الهنائي' });
  await visit.locator('summary').click();
  await expect(visit).toContainText('حصة الكثافة');
  await navigate('الخطط والمهام');
  await expect(page.getByText('الواجب 9: تقنيات التعليم والوسائل وجردها')).toBeVisible();
});
