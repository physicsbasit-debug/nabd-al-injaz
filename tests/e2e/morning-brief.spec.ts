import { test, expect, type Page } from '@playwright/test';

async function openSection(page: Page, name: string) {
  const phone = test.info().project.name === 'phone';
  if (phone) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: phone ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name, exact: true })
    .click();
}

test('موجز اليوم يعرض المتأخر والمستحق وطريقة الإنجاز ويحفظ إنجاز الروتين', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    const today = new Date();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const past = new Date(today);
    past.setDate(past.getDate() - 3);
    localStorage.setItem(
      'nabd-al-injaz:tasks:v1',
      JSON.stringify([
        { id: 'a', title: 'رفع كشف الدرجات', dueDate: key(past), priority: 'عاجلة', done: false, createdAt: key(past), category: 'تقويم وتحصيل', assignedTo: '', progress: 'لم تبدأ', notes: '' },
        { id: 'b', title: 'اجتماع لجنة التحصيل', dueDate: key(today), priority: 'عادية', done: false, createdAt: key(past), category: 'أخرى', assignedTo: '', progress: 'لم تبدأ', notes: '' },
      ]),
    );
  });
  await page.goto('/');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await expect(brief.getByRole('heading', { name: 'موجز اليوم', level: 2 })).toBeVisible();
  await expect(brief.getByRole('heading', { name: 'ابدأ بهذه أولًا' })).toBeVisible();
  // The overdue task comes first in the priorities.
  await expect(brief.locator('.brief-priorities li').first()).toContainText('رفع كشف الدرجات');

  await expect(brief.locator('.brief-today-list')).toContainText('اجتماع لجنة التحصيل');
  await expect(brief.locator('.brief-today-list')).toContainText('توزيع الحصص والاحتياط');
  await expect(brief.locator('.brief-today-list')).not.toContainText('الزيارات الإشرافية والتغذية الراجعة');
  await expect(brief.getByText(/واجبات هذا الأسبوع/)).toBeVisible();

  await brief.getByRole('button', { name: /متأخرة/ }).click();
  await expect(brief.getByRole('button', { name: /متأخرة/ })).toHaveAttribute('aria-pressed', 'true');
  const late = brief.locator('.brief-item').filter({ hasText: 'رفع كشف الدرجات' });
  await late.getByText(/طريقة الإنجاز · الواجب 21/).click();
  await expect(late).toContainText('الشاهد المطلوب');

  await brief.getByRole('button', { name: /لازم اليوم/ }).click();
  const cover = brief.locator('.brief-item').filter({ hasText: 'توزيع الحصص والاحتياط' });
  await cover.getByText(/طريقة الإنجاز/).click();
  await cover.getByLabel('ملاحظة إنجاز اختيارية').fill('غطيت غياب معلمين');
  await cover.getByRole('button', { name: 'تم', exact: true }).click();
  await expect(brief.locator('.brief-today-list')).not.toContainText('توزيع الحصص والاحتياط');

  await brief.getByRole('button', { name: /منجزة/ }).click();
  await expect(brief.locator('.brief-list')).toContainText('غطيت غياب معلمين');
  await page.reload();
  await page.getByRole('region', { name: 'موجز اليوم' }).getByRole('button', { name: /منجزة/ }).click();
  await expect(page.locator('.brief-list')).toContainText('توزيع الحصص والاحتياط');
  await page.getByRole('button', { name: 'تراجع' }).click();
  await expect(page.getByText('لم يُسجل إنجاز اليوم بعد.')).toBeVisible();
});

test('دليل الواجبات يعرض الواجبات الأربع والأربعين ويحفظ تعديل التكرار', async ({ page }) => {
  await page.goto('/');
  await openSection(page, 'دليل الواجبات');
  const guide = page.getByRole('region', { name: 'دليل الواجبات' });
  await expect(guide.locator('.duty-card')).toHaveCount(44);
  await guide.getByRole('searchbox', { name: 'بحث في الواجبات' }).fill('درجات');
  await expect(guide.locator('.duty-card')).toHaveCount(2);
  await guide.getByRole('searchbox', { name: 'بحث في الواجبات' }).fill('');
  const ethics = guide.locator('.duty-card').filter({ hasText: 'نشر أخلاقيات المهنة واللوائح' });
  await ethics.locator('summary').click();
  await ethics.getByLabel('التكرار في روتيني').selectOption('شهري');
  await openSection(page, 'الرئيسية');
  const brief = page.getByRole('region', { name: 'موجز اليوم' });
  await brief.getByRole('button', { name: /روتين الواجبات/ }).click();
  await expect(brief.locator('.brief-routine')).toContainText('نشر أخلاقيات المهنة واللوائح');
});
