import { test, expect, type Page } from '@playwright/test';

async function openLibrary(page: Page, project: string) {
  await page.goto('/');
  if (project === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', {
      name: project === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية',
    })
    .getByRole('button', { name: 'مكتبة الخطط' })
    .click();
}

async function addPlan(page: Page, name: string) {
  await page.getByRole('button', { name: 'إضافة خطة', exact: true }).click();
  await page.getByRole('textbox', { name: 'اسم الخطة *' }).fill(name);
  await page.getByRole('button', { name: 'حفظ الخطة' }).click();
}

async function downloadBackup(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تنزيل نسخة احتياطية' }).click(),
  ]);
  const content = await (await import('node:fs/promises')).readFile(await download.path());
  return JSON.parse(content.toString());
}

async function restore(page: Page, archive: unknown, accept = true) {
  page.once('dialog', (dialog) => (accept ? dialog.accept() : dialog.dismiss()));
  await page.getByLabel('استعادة نسخة').setInputFiles({
    name: 'acceptance.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
}

test('2-C4: cancelling restoration keeps every plan and leaves task storage unchanged', async ({
  page,
}, testInfo) => {
  await openLibrary(page, testInfo.project.name);
  await addPlan(page, 'الخطة الأصلية');
  const archive = await downloadBackup(page);
  await addPlan(page, 'الخطة الجديدة');
  const before = await page.evaluate(() => ({
    plans: localStorage.getItem('nabd-al-injaz:plans:v1'),
    tasks: Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.includes('task'))
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  }));
  await restore(page, archive, false);
  await page.reload();
  const after = await page.evaluate(() => ({
    plans: localStorage.getItem('nabd-al-injaz:plans:v1'),
    tasks: Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.includes('task'))
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  }));
  expect(JSON.parse(after.plans ?? '[]')).toEqual(JSON.parse(before.plans ?? '[]'));
  expect(after.tasks).toEqual(before.tasks);
  expect(JSON.parse(after.plans ?? '[]')).toHaveLength(2);
});

test('2-C4: duplicate identifiers and unknown plan types are rejected without data loss', async ({
  page,
}, testInfo) => {
  await openLibrary(page, testInfo.project.name);
  await addPlan(page, 'خطة محمية');
  const archive = await downloadBackup(page);
  const before = await page.evaluate(() => localStorage.getItem('nabd-al-injaz:plans:v1'));
  await restore(page, { ...archive, plans: [archive.plans[0], archive.plans[0]] });
  await expect(page.getByRole('status')).toContainText('النسخة تحتوي معرّفات خطط مكررة.');
  await restore(page, { ...archive, plans: [{ ...archive.plans[0], kind: 'نوع غير معتمد' }] });
  await expect(page.getByRole('status')).toContainText(
    'ملف النسخة غير مطابق لإصدار النسخ الاحتياطي المعتمد.',
  );
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('nabd-al-injaz:plans:v1'))).toBe(before);
});

test('2-C4: backup controls stay accessible and inside the viewport', async ({
  page,
}, testInfo) => {
  await openLibrary(page, testInfo.project.name);
  const controls = page.locator('.plan-backup-tools');
  await expect(controls).toBeVisible();
  await expect(page.getByRole('button', { name: 'تنزيل نسخة احتياطية' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'تقرير الشواهد CSV' })).toBeEnabled();
  await page.getByLabel('استعادة نسخة').focus();
  await expect(page.locator('.plan-backup-upload')).toHaveCSS('outline-style', 'solid');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: 'test-results/phase2c4-backup-' + testInfo.project.name + '.png',
    fullPage: true,
  });
});
