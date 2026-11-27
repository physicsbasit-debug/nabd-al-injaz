import { expect, test } from '@playwright/test';

test('قرارات الاجتماع تُتابع حتى التنفيذ وتظهر في موجز اليوم', async ({ page }, info) => {
  const d = new Date();
  const key = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = key(d);
  const past = new Date(d);
  past.setDate(past.getDate() - 2);
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
  await navigate('الاجتماعات الدورية');
  const register = page.getByRole('region', { name: 'سجل الاجتماعات الدورية' });
  await register.locator('summary').filter({ hasText: 'إضافة' }).click();
  await register.getByLabel('العنوان').fill('اجتماع القسم – نوفمبر');
  await register.getByLabel('التاريخ').fill(today);
  await register.getByRole('button', { name: 'حفظ السجل' }).click();
  const meeting = register.locator('article').filter({ hasText: 'اجتماع القسم – نوفمبر' });
  await meeting.locator('summary').filter({ hasText: 'القرارات والتوصيات' }).click();
  const addDecision = async (text: string, owner: string, due: string) => {
    await meeting.getByLabel('نص القرار').fill(text);
    await meeting.getByLabel('مسؤول التنفيذ').fill(owner);
    await meeting.getByLabel('موعد التنفيذ').fill(due);
    await meeting.getByRole('button', { name: 'إضافة القرار' }).click();
    await expect(meeting).toContainText(text);
  };
  await addDecision('تبادل زيارتين بين معلمي التاسع', 'سالم', key(past));
  await addDecision('تسليم تحليل الاختبار القصير', 'أحمد', today);
  await expect(meeting.locator('.meeting-decisions summary')).toContainText('0/2 منفذ');
  await expect(meeting).toContainText('متأخر ·');

  await navigate('الرئيسية');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await expect(brief.locator('.brief-today-list')).toContainText(
    'قرار اجتماع: تسليم تحليل الاختبار القصير',
  );
  await brief.getByRole('button', { name: /متأخرة/ }).click();
  const late = brief.locator('.brief-item').filter({ hasText: 'تبادل زيارتين بين معلمي التاسع' });
  await late.getByRole('button', { name: 'نُفّذ' }).click();
  await expect(brief.locator('.brief-item').filter({ hasText: 'تبادل زيارتين' })).toHaveCount(0);
  await brief.getByRole('button', { name: /منجزة/ }).click();
  await expect(brief.locator('.brief-list')).toContainText(
    'قرار اجتماع: تبادل زيارتين بين معلمي التاسع',
  );

  await navigate('الاجتماعات الدورية');
  const open = page.getByRole('region', { name: 'قرارات لم تُنفّذ بعد' });
  await expect(open.getByRole('heading', { name: 'قرارات لم تُنفّذ بعد (1)' })).toBeVisible();
  await open.getByLabel('تم تنفيذ: تسليم تحليل الاختبار القصير').click();
  await expect(open).toHaveCount(0);
  // The meeting's own list updates without a reload.
  await expect(
    page
      .getByRole('region', { name: 'سجل الاجتماعات الدورية' })
      .locator('article')
      .filter({ hasText: 'اجتماع القسم – نوفمبر' })
      .locator('.meeting-decisions summary'),
  ).toContainText('2/2 منفذ');
  await page.reload();
  await navigate('الاجتماعات الدورية');
  const reloaded = page
    .getByRole('region', { name: 'سجل الاجتماعات الدورية' })
    .locator('article')
    .filter({ hasText: 'اجتماع القسم – نوفمبر' });
  await expect(reloaded.locator('.meeting-decisions summary')).toContainText('2/2 منفذ');
});
