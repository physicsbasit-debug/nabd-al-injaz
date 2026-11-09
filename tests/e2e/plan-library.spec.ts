import { test, expect } from '@playwright/test';

async function openLibrary(page: import('@playwright/test').Page, device: string) {
  if (device === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: device === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
}

async function openHome(page: import('@playwright/test').Page, device: string) {
  if (device === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: device === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الرئيسية' })
    .click();
}

test('manual plan creation, activity completion and independent dashboard indicators', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('لا توجد خطط مضافة بعد')).toBeVisible();
  await page.getByRole('button', { name: 'إضافة خطة' }).click();
  const form = page.getByRole('region', { name: 'إنشاء خطة جديدة' });
  await form.getByLabel('اسم الخطة').fill('خطة العلوم الفصل الأول');
  await form.getByLabel('المسؤول').fill('معلم أول العلوم');
  await form.getByRole('button', { name: 'حفظ الخطة' }).click();
  await expect(
    page.getByRole('heading', { name: 'خطة العلوم الفصل الأول', level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('لا توجد أنشطة معتمدة بعد')).toBeVisible();
  await page.getByRole('button', { name: 'إضافة نشاط' }).click();
  const activity = page.getByRole('form', { name: 'إضافة نشاط' });
  await activity.getByLabel('عنوان النشاط').fill('تحليل نتائج الاختبار');
  await activity.getByLabel('المكلف بالتنفيذ').fill('معلم العلوم');
  await activity.getByRole('button', { name: 'حفظ النشاط' }).click();
  await expect(page.getByText('تحليل نتائج الاختبار')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'مؤشرات الخطة المحددة' }).getByText('0%'),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'حالة النشاط: تحليل نتائج الاختبار' })
    .selectOption('completed');
  await expect(
    page.getByRole('region', { name: 'مؤشرات الخطة المحددة' }).getByText('100%'),
  ).toBeVisible();
  await expect(page.getByText('مكتمل، ينتظر التوثيق')).toBeVisible();

  await openHome(page, testInfo.project.name);
  await expect(page.getByRole('img', { name: 'إنجاز خطة العلوم الفصل الأول: 100%' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 0%' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'إنجاز خطة العلوم الفصل الأول: 100%' })).toBeVisible();

  await page.screenshot({
    path: 'test-results/plan-overview-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });

  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
});

test('plan archive removes only its indicator and can be restored', async ({ page }, testInfo) => {
  await page.goto('/');
  await openLibrary(page, testInfo.project.name);
  await page.getByRole('button', { name: 'إنشاء خطة' }).click();
  const form = page.getByRole('region', { name: 'إنشاء خطة جديدة' });
  await form.getByLabel('نوع الخطة').selectOption('خطة أخرى');
  await form.getByLabel('اسم الخطة').fill('خطة خاصة بالمختبر');
  await form.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByRole('button', { name: 'أرشفة الخطة' }).click();
  await expect(
    page.getByText('هذه الخطة مؤرشفة ولا تظهر في مؤشرات الصفحة الرئيسية.'),
  ).toBeVisible();
  await openHome(page, testInfo.project.name);
  await expect(page.getByRole('button', { name: 'فتح خطة: خطة خاصة بالمختبر' })).toHaveCount(0);
  await openLibrary(page, testInfo.project.name);
  await page.getByRole('button', { name: 'استعادة الخطة' }).click();
  await openHome(page, testInfo.project.name);
  await expect(page.getByRole('button', { name: 'فتح خطة: خطة خاصة بالمختبر' })).toBeVisible();
  await expect(page.getByText('لا توجد أنشطة معتمدة').first()).toBeVisible();
});

test('editing and deleting plan activities updates the saved plan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'إضافة خطة' }).click();
  await page
    .getByRole('region', { name: 'إنشاء خطة جديدة' })
    .getByLabel('اسم الخطة')
    .fill('خطة الزيارات');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await page.getByRole('button', { name: 'إضافة نشاط' }).click();
  await page
    .getByRole('form', { name: 'إضافة نشاط' })
    .getByLabel('عنوان النشاط')
    .fill('زيارة أولى');
  await page.getByRole('button', { name: 'حفظ النشاط' }).click();
  await page.getByRole('button', { name: 'تعديل النشاط: زيارة أولى' }).click();
  await page
    .getByRole('form', { name: 'تعديل نشاط' })
    .getByLabel('عنوان النشاط')
    .fill('زيارة صفية أولى');
  await page.getByRole('button', { name: 'حفظ تعديل النشاط' }).click();
  await expect(page.getByText('زيارة صفية أولى')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'حذف النشاط: زيارة صفية أولى' }).click();
  await expect(page.getByText('لا توجد أنشطة معتمدة بعد')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'فتح خطة: خطة الزيارات' }).click();
  await expect(page.getByText('لا توجد أنشطة معتمدة بعد')).toBeVisible();
});
