import { test, expect, type Page } from '@playwright/test';

async function openSection(page: Page, name: string) {
  const phone = test.info().project.name === 'phone';
  if (phone) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: phone ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name, exact: true })
    .click();
}

test('ملف المعلم يجمع بياناته وفحص الشهر يغلق الواجب في موجز اليوم', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({ teachers: ['أحمد سعيد', 'سالم الهنائي'], lessons: [] }),
    );
  });
  await page.goto('/');
  await openSection(page, 'ملفات المعلمين');
  const list = page.getByRole('region', { name: 'ملفات المعلمين' });
  await expect(list.getByRole('heading', { name: 'معلمو القسم', level: 2 })).toBeVisible();
  await expect(list.locator('.teacher-card')).toHaveCount(2);
  await expect(list.getByRole('button', { name: 'فتح ملف أحمد سعيد' })).toContainText('لم يُزر في');

  await list.getByRole('button', { name: 'فتح ملف أحمد سعيد' }).click();
  const profile = page.getByRole('region', { name: 'ملف أحمد سعيد' });
  await expect(profile.getByRole('heading', { name: 'أحمد سعيد', level: 2 })).toBeVisible();
  await expect(profile.getByRole('heading', { name: 'ما يحتاج متابعة' })).toBeVisible();
  const records = profile
    .locator('.teacher-checks > li')
    .filter({ hasText: 'فحص السجلات والملفات' });
  await records.getByLabel('ملاحظة فحص السجلات والملفات').fill('سجل المتابعة مكتمل');
  await records.getByRole('button', { name: 'مكتمل', exact: true }).click();
  await expect(records).toContainText('مكتمل ·');
  await expect(records).toContainText('سجل المتابعة مكتمل');

  await profile.getByLabel('ملاحظات عن أحمد سعيد').fill('مبادرة نادي العلوم');
  await profile.getByRole('heading', { name: 'أحمد سعيد', level: 2 }).click();
  await page.reload();
  await openSection(page, 'ملفات المعلمين');
  await page.getByRole('button', { name: 'فتح ملف أحمد سعيد' }).click();
  await expect(page.getByLabel('ملاحظات عن أحمد سعيد')).toHaveValue('مبادرة نادي العلوم');
  await page.getByRole('button', { name: 'كل المعلمين' }).click();
  await expect(page.getByRole('button', { name: 'فتح ملف أحمد سعيد' })).toContainText('السجلات ✓');

  await openSection(page, 'الرئيسية');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await brief.getByRole('button', { name: /روتين الواجبات/ }).click();
  await brief.locator('summary').filter({ hasText: 'واجبات شهرية' }).click();
  await expect(
    brief.locator('.brief-item').filter({ hasText: 'متابعة سجلات المعلمين وملفاتهم' }),
  ).toContainText('أُنجز من السجلات: فحص السجلات والملفات: أحمد سعيد');
});
