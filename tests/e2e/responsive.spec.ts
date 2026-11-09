import { test, expect } from '@playwright/test';

const widths = [320, 375, 390, 768, 1024, 1366];

test('navigation and task forms fit narrow and wide screens', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/');

    if (width <= 800) {
      const menu = page.locator('.mobile-menu-trigger');
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      const list = page.getByRole('navigation', { name: 'أقسام الهاتف' });
      await expect(list.getByRole('button')).toHaveCount(9);
      if (width <= 420) {
        const columns = await list.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
        );
        expect(columns).toBe(2);
      }
      await list.getByRole('button', { name: 'الخطط والمهام' }).click();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    } else {
      await page
        .getByRole('navigation', { name: 'الأقسام الرئيسية' })
        .getByRole('button', { name: 'الخطط والمهام' })
        .click();
    }

    await page.getByRole('button', { name: 'إضافة مهمة جديدة' }).click();
    await expect(page.getByRole('button', { name: 'إضافة المهمة' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.document, `overflow at ${width}px`).toBeLessThanOrEqual(
      dimensions.viewport + 1,
    );
  }
});
