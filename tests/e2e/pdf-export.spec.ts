import { test, expect } from '@playwright/test';

test('يُنشئ ملف PDF للتقرير دون فتح نافذة الطباعة', async ({ page }, info) => {
  await page.goto('/');
  if (info.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'التقارير', exact: true }).click();
  await page.evaluate(() => { window.print = () => { throw new Error('Unexpected print dialog'); }; });
  test.setTimeout(120000);
  for (const reportName of ['تقرير العمل والمتابعة', 'تقرير الزيارات الإشرافية', 'تقرير الخطط والمهام', 'تقرير الإنماء المهني', 'تقرير الاختبارات والتحصيل', 'تقرير الجداول والاحتياط']) {
    await page.getByRole('button', { name: reportName, exact: true }).click();
    await page.getByRole('button', { name: 'تصدير PDF' }).click();
    await expect(page.getByRole('link', { name: 'تنزيل ملف PDF' })).toBeVisible({ timeout: 30000 });
  }
  await page.getByRole('button', { name: 'تقرير العمل والمتابعة', exact: true }).click();
  await page.getByRole('button', { name: 'تصدير PDF' }).click();
  const link = page.getByRole('link', { name: 'تنزيل ملف PDF' });
  await expect(link).toBeVisible({ timeout: 30000 });
  const result = await link.evaluate(async node => {
    const response = await fetch((node as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { type: response.headers.get('content-type'), prefix: String.fromCharCode(...bytes.slice(0, 5)), size: bytes.length };
  });
  expect(result.type).toContain('application/pdf');
  expect(result.prefix).toBe('%PDF-');
  expect(result.size).toBeGreaterThan(1000);
  await page.getByLabel('المعلم أو المسؤول').fill('اسم مختلف');
  await expect(link).toHaveCount(0);
});
