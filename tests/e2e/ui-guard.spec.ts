import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Navigation is allowed to repeat the current page name; content headings are not.
async function assertHeadingQuality(page: Page) {
  const headings = await page
    .locator('main h1, main h2, main h3, main h4, main h5, main h6')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map((node) => ({
          level: Number(node.tagName.slice(1)),
          text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
        })),
    );
  expect(headings.length, 'A page must have a content heading').toBeGreaterThan(0);
  expect(headings[0].level, 'First content heading must be H1').toBe(1);
  expect(
    headings.filter((h) => h.level === 1),
    'Exactly one H1 per page',
  ).toHaveLength(1);
  const seen = new Set<string>();
  let previous = 1;
  for (const heading of headings) {
    const normalized = heading.text
      .normalize('NFKC')
      .replace(/[\u064B-\u065F]/g, '')
      .trim();
    expect(normalized, 'Empty heading is not allowed').not.toBe('');
    expect(seen.has(normalized), 'Duplicate visible content heading: ' + normalized).toBe(false);
    seen.add(normalized);
    expect(
      heading.level - previous,
      'Heading hierarchy skipped a level at: ' + normalized,
    ).toBeLessThanOrEqual(1);
    previous = heading.level;
  }
}
async function assertLayout(page: Page) {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(size.scroll, 'Unexpected horizontal overflow').toBeLessThanOrEqual(size.width + 1);
}
async function assertAccessibility(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}
async function openSection(page: Page, device: string, name: string) {
  if (device === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: device === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name })
    .click();
}
test('UI guard: dashboard, plan library, tasks have unique hierarchical headings, no overflow and accessible content', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  for (const section of ['الرئيسية', 'مكتبة الخطط', 'الخطط والمهام']) {
    if (section !== 'الرئيسية') await openSection(page, testInfo.project.name, section);
    await assertHeadingQuality(page);
    await assertLayout(page);
    await assertAccessibility(page);
  }
});
test('UI guard: library creation and populated detail stay consistent', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await openSection(page, testInfo.project.name, 'مكتبة الخطط');
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await assertHeadingQuality(page);
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill('خطة جودة الواجهة');
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
  await assertHeadingQuality(page);
  await assertLayout(page);
  await assertAccessibility(page);
  await page.screenshot({
    path: 'test-results/ui-guard-library-' + testInfo.project.name + '.png',
    fullPage: true,
    animations: 'disabled',
  });
});
