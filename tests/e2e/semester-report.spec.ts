import { test, expect } from '@playwright/test';

test('التقرير الفصلي يرتب الواجبات ويحفظ التقويم الذاتي ويصدر PDF', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem(
      'nabd-al-injaz:tasks:v1',
      JSON.stringify([
        {
          id: 't',
          title: 'فحص سجلات القسم',
          dueDate: today,
          priority: 'عادية',
          done: true,
          completedAt: new Date().toISOString(),
          createdAt: today,
          category: 'أخرى',
          assignedTo: '',
          progress: 'مكتملة',
          notes: '',
          dutyId: 30,
        },
      ]),
    );
  });
  await page.goto('/');
  if (info.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'التقارير', exact: true })
    .click();
  await page.getByRole('button', { name: 'التقرير الفصلي حسب الواجبات', exact: true }).click();
  const report = page.getByRole('region', { name: 'التقرير الفصلي حسب الواجبات' });
  await expect(
    report.getByRole('heading', { name: 'التقرير الفصلي لأعمال المعلم الأول' }),
  ).toBeVisible();
  await expect(report.locator('.semester-table tbody tr:not(.semester-group)')).toHaveCount(44);
  const row = report
    .locator('.semester-table tr')
    .filter({ hasText: 'متابعة سجلات المعلمين وملفاتهم' });
  await expect(row).toContainText('فحص سجلات القسم');
  await expect(row).toContainText(/1 من \d+ (شهر|شهرين|أشهر|شهرًا)/);
  await expect(row).not.toContainText('لم يُسجل');

  await report.getByLabel('إخفاء الواجبات دون سجلات').check();
  await expect(report.locator('.semester-table tbody tr:not(.semester-group)')).toHaveCount(1);

  await report.getByLabel('التحديات').fill('كثرة حصص الاحتياط');
  await report.getByLabel('المقترحات').click();
  await expect(report.locator('.semester-notes')).toContainText('كثرة حصص الاحتياط');
  await page.reload();
  if (info.project.name === 'phone')
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'التقارير', exact: true })
    .click();
  await page.getByRole('button', { name: 'التقرير الفصلي حسب الواجبات', exact: true }).click();
  await expect(page.locator('.semester-notes')).toContainText('كثرة حصص الاحتياط');

  await page.evaluate(() => {
    window.print = () => {
      throw new Error('Unexpected print dialog');
    };
  });
  await page.getByRole('button', { name: 'تصدير PDF' }).click();
  await expect(page.getByRole('link', { name: 'تنزيل ملف PDF' })).toBeVisible({ timeout: 30000 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.semester-editor')).toBeHidden();
  await expect(page.locator('.report-type')).toBeHidden();
});
