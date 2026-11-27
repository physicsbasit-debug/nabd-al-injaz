import { expect, test } from '@playwright/test';

test('أسلوب الإشراف ومؤشرات الأداء يغذيان التحليل والواجبات 7 و12 و15', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({ teachers: ['أحمد سعيد', 'سالم الهنائي'], lessons: [], verifiedDays: [] }),
    );
  });
  const duty = (title: string) =>
    page
      .getByRole('region', { name: 'موجز اليوم' })
      .locator('.brief-item')
      .filter({
        has: page.locator('.brief-item-text strong', { hasText: new RegExp(`^${title}$`) }),
      });
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  await navigate('الزيارات الإشرافية');
  const visits = page.getByRole('region', { name: 'سجل الزيارات الإشرافية' });
  const analysis = visits.getByRole('region', { name: 'تحليل نتائج الإشراف' });
  await expect(analysis).toContainText('لا توجد زيارات منفذة في هذه الفترة.');

  const addVisit = async (
    teacher: string,
    method: string,
    strengths: string[],
    priorities: string[],
  ) => {
    await visits.getByLabel('المعلم', { exact: true }).fill(teacher);
    await visits.getByLabel('تاريخ الزيارة').fill(today);
    await visits.getByLabel('حالة الزيارة').selectOption('completed');
    await visits.getByLabel('أسلوب الإشراف').selectOption(method);
    for (const tag of strengths)
      await visits.getByRole('group', { name: 'مؤشرات ظهرت جانب قوة' }).getByLabel(tag).check();
    for (const tag of priorities)
      await visits.getByRole('group', { name: 'مؤشرات أولوية للتطوير' }).getByLabel(tag).check();
    await visits.getByRole('button', { name: 'حفظ الزيارة' }).click();
    await expect(visits.getByRole('status')).toContainText('حُفظت الزيارة');
  };
  await addVisit(
    'أحمد سعيد',
    'درس تطبيقي',
    ['إدارة البيئة التعليمية'],
    ['التقويم والتغذية الراجعة'],
  );
  await addVisit(
    'سالم الهنائي',
    'زيارة صفية',
    [],
    ['التقويم والتغذية الراجعة', 'مراعاة الفروق الفردية'],
  );

  await expect(analysis).toContainText('2 زيارات منفذة، منها 2 موسومة');
  await expect(analysis).toContainText('مرشح لبرنامج إنماء جماعي: التقويم والتغذية الراجعة');
  await analysis.getByRole('button', { name: 'اعتماد تحليل هذا الشهر (الواجب 15)' }).click();
  await expect(analysis).toContainText(
    'اعتُمد تحليل هذا الشهر · 2 زيارات · أبرز أولوية: التقويم والتغذية الراجعة',
  );
  const card = visits.locator('.short-test-item').filter({ hasText: 'أحمد سعيد' });
  await card.locator('summary').click();
  await expect(card).toContainText('أسلوب الإشراف: درس تطبيقي');
  await expect(card).toContainText('أولويات التطوير: التقويم والتغذية الراجعة');

  await navigate('الرئيسية');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await brief.getByRole('button', { name: /روتين الواجبات/ }).click();
  await brief.locator('summary').filter({ hasText: 'واجبات شهرية' }).click();
  await expect(duty('تنويع أساليب الإشراف')).toContainText(
    'أُنجز من السجلات: درس تطبيقي: أحمد سعيد',
  );
  await expect(duty('تحليل نتائج الإشراف')).toContainText('أبرز أولوية: التقويم والتغذية الراجعة');
  await brief.locator('summary').filter({ hasText: 'واجبات فصلية' }).click();
  await expect(duty('الدروس التطبيقية')).toContainText('أُنجز من السجلات');

  await navigate('ملفات المعلمين');
  await page.getByRole('button', { name: 'فتح ملف سالم الهنائي' }).click();
  await expect(page.getByRole('region', { name: 'ملف سالم الهنائي' })).toContainText(
    'أولويات التطوير: التقويم والتغذية الراجعة، مراعاة الفروق الفردية',
  );
});
