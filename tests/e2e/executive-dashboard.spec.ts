import { test, expect } from '@playwright/test';

test('executive dashboard shows real overdue and priority indicators', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => {
    const key = 'nabd-al-injaz:tasks:v1';
    const dateKey = (offset: number) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    };
    const task = (id: string, overrides: Record<string, unknown>) => ({
      id,
      title: id,
      dueDate: '',
      priority: 'عادية',
      done: false,
      createdAt: new Date().toISOString(),
      category: 'متابعة فنية',
      assignedTo: 'فريق العلوم',
      progress: 'لم تبدأ',
      notes: '',
      ...overrides,
    });
    localStorage.setItem(
      key,
      JSON.stringify([
        task('متابعة متأخرة', { dueDate: dateKey(-1), progress: 'قيد التنفيذ' }),
        task('متابعة عاجلة', { dueDate: dateKey(4), priority: 'عاجلة' }),
        task('مهمة مكتملة', { dueDate: dateKey(-3), done: true, progress: 'مكتملة' }),
        task('مهمة لاحقة', { dueDate: dateKey(7) }),
      ]),
    );
  });
  await page.reload();

  const stats = page.getByRole('region', { name: 'مؤشرات المهام' });
  await expect(
    stats.locator('article').nth(0).locator('strong'),
  ).toHaveText('4');
  await expect(
    stats.locator('article').nth(1).locator('strong'),
  ).toHaveText('1');
  await expect(
    stats.locator('article').nth(2).locator('strong'),
  ).toHaveText('1');
  await expect(
    stats.locator('article').nth(3).locator('strong'),
  ).toHaveText('1');
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 25%' })).toBeVisible();

  const titles = await page.locator('.executive-task-content > strong').allTextContents();
  expect(titles.slice(0, 2)).toEqual(['متابعة متأخرة', 'متابعة عاجلة']);
  await page.getByRole('button', { name: 'إكمال المهمة: متابعة متأخرة' }).click();
  await expect(
    stats.locator('article').nth(3).locator('strong'),
  ).toHaveText('0');
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 50%' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 50%' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/executive-dashboard-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });

  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);

  await page.getByRole('button', { name: 'إدارة المهام' }).click();
  await expect(page.getByRole('heading', { name: 'الخطط والمهام', level: 1 })).toBeVisible();
});

test('empty dashboard links to task creation without fabricated data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('لا توجد مهام مسجلة بعد')).toBeVisible();
  await expect(page.getByRole('img', { name: 'نسبة الإنجاز 0%' })).toBeVisible();
  await page.getByRole('button', { name: 'الانتقال إلى الخطط والمهام' }).click();
  await expect(page.getByRole('button', { name: 'إضافة مهمة جديدة' })).toBeVisible();
});
