import { test, expect, type Page } from '@playwright/test';
import { SCHEDULE_STORAGE_KEY } from '../../src/schedule-model';

async function dateOffset(page: Page, days: number) {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, days);
}

async function openTechnicalFollowup(page: Page, phone: boolean) {
  await page.addInitScript(
    ({ key, storageKey }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ teachers: ['وليد الهنائي'], lessons: [], verifiedDays: [] }),
      );
      localStorage.removeItem(key);
    },
    { key: 'nabd-al-injaz:technical-followup:v1', storageKey: SCHEDULE_STORAGE_KEY },
  );
  await page.goto('/');
  if (phone) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: phone ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'المتابعة الفنية' })
    .click();
}

test('technical follow-up records bulletin entries and syncs the daily dashboard', async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await openTechnicalFollowup(page, phone);
  await expect(
    page.getByLabel('المعلم').locator('option', { hasText: 'وليد الهنائي' }),
  ).toHaveCount(1);
  await page.getByLabel('المعلم').selectOption('وليد الهنائي');
  await page.getByLabel('الصف').selectOption('9');
  await page.getByLabel('المادة').selectOption('فيزياء');
  await page.getByLabel('الموضوع / الوحدة').fill('الحركة والسرعة');
  await page.getByLabel('الحصص المخططة').fill('2');
  await page.getByLabel('موعد الإنجاز المستهدف').fill(await dateOffset(page, 2));
  await page.getByRole('button', { name: 'إضافة للمتابعة' }).click();
  await expect(page.getByRole('heading', { name: 'الحركة والسرعة' })).toBeVisible();
  await page.getByRole('button', { name: 'تسجيل حصة منفذة' }).click();
  await expect(page.getByText('1 من 2 حصص')).toBeVisible();
  const dimensions = await page
    .locator('html')
    .evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'الحركة والسرعة' })).toBeVisible();
  if (phone) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: phone ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الرئيسية' })
    .click();
  await expect(page.getByRole('button', { name: /المتابعة الفنية/ })).toContainText(
    '0 موعده اليوم · 1 قادم',
  );
});
