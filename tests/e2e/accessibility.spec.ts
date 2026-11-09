import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openTasks(page: import('@playwright/test').Page, project: string) {
  if (project === 'phone') {
    await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  }
  await page
    .getByRole('navigation', { name: project === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الخطط والمهام' })
    .click();
}

test('dashboard and task form meet core accessibility rules', async ({ page }, testInfo) => {
  await page.goto('/');
  const dashboard = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(dashboard.violations).toEqual([]);

  await openTasks(page, testInfo.project.name);
  await page.getByRole('button', { name: 'إضافة مهمة جديدة' }).click();
  const tasks = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(tasks.violations).toEqual([]);
});
