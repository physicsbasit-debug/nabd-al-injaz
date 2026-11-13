import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('two tabs cannot erase newer records or delete a record with an attached file', async ({ page, context }, info) => {
  async function openTests(p: typeof page) {
    await p.goto('/');
    if (info.project.name === 'phone') await p.getByRole('button', {name:/عرض الأقسام/}).click();
    await p.getByRole('button', {name:'الاختبارات والتحصيل', exact:true}).click();
    return p.getByRole('region', {name:'متابعة الاختبارات والتحليل'});
  }
  const a = await openTests(page);
  await a.getByLabel('عنوان الاختبار').fill('سجل أول');
  await a.getByLabel('المعلم', {exact:true}).fill('معلم');
  await a.getByRole('button', {name:'حفظ سجل المتابعة'}).click();
  await expect(a.getByRole('status')).toContainText('حُفظ');
  const other = await context.newPage();
  const b = await openTests(other);
  await b.getByText('سجل أول · معلم').click();
  await page.evaluate(() => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    (window as unknown as { releaseAssessmentTest: () => void }).releaseAssessmentTest = release;
    void navigator.locks.request('nabd-al-injaz:assessment-data:v1', async () => { document.body.dataset.assessmentLockHeld = 'yes'; await gate; });
  });
  await expect.poll(() => page.evaluate(() => document.body.dataset.assessmentLockHeld)).toBe('yes');
  await a.getByLabel('عنوان الاختبار').fill('سجل جديد');
  await a.getByLabel('المعلم', {exact:true}).fill('معلم');
  await a.getByRole('button', {name:'حفظ سجل المتابعة'}).click();
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.some(lock => lock.name === 'nabd-al-injaz:assessment-data:v1'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('nabd-al-injaz:assessment-tracking:v1'))).not.toContain('سجل جديد');
  await page.evaluate(() => (window as unknown as {releaseAssessmentTest: () => void}).releaseAssessmentTest());
  await expect(a.getByText('سجل جديد · معلم')).toBeVisible();
  await a.getByText('سجل أول · معلم').click();
  await a.locator('details').filter({hasText:'سجل أول · معلم'}).getByLabel('إرفاق نسخة الاختبار').setInputFiles({name:'test.pdf', mimeType:'application/pdf', buffer:Buffer.from('example')});
  await expect(a.getByText('test.pdf')).toBeVisible();
  other.on('dialog', dialog => dialog.accept());
  await b.locator('details').filter({hasText:'سجل أول · معلم'}).getByRole('button', {name:'حذف سجل المتابعة'}).click();
  await expect(b.getByRole('status')).toContainText('احذف ملفات السجل أولًا');
  await b.getByLabel('عنوان الاختبار').fill('سجل ثان');
  await b.getByLabel('المعلم', {exact:true}).fill('معلم');
  await b.getByRole('button', {name:'حفظ سجل المتابعة'}).click();
  await expect(b.getByRole('status')).toContainText('حُفظ سجل');
  await page.reload();
  const again = await openTests(page);
  await expect(again.getByText('سجل أول · معلم')).toBeVisible();
  await expect(again.getByText('سجل ثان · معلم')).toBeVisible();
  await expect(again.getByText('سجل جديد · معلم')).toBeVisible();
});

test('restoration waits for the assessment lock', async ({ page, context }, info) => {
  await page.goto('/');
  const tools = page.locator('.app-backup-tools');
  await tools.locator('summary').click();
  const downloadEvent = page.waitForEvent('download');
  await tools.getByRole('button', {name:'تنزيل نسخة كاملة'}).click();
  const download = await downloadEvent;
  const path = info.outputPath('concurrent-backup.json');
  await download.saveAs(path);
  const second = await context.newPage();
  await second.goto('/');
  const secondTools = second.locator('.app-backup-tools');
  await secondTools.locator('summary').click();
  await page.evaluate(() => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    (window as unknown as {releaseAssessmentTest: () => void}).releaseAssessmentTest = release;
    void navigator.locks.request('nabd-al-injaz:assessment-data:v1', async () => {document.body.dataset.assessmentLockHeld = 'yes'; await gate;});
  });
  await expect.poll(() => page.evaluate(() => document.body.dataset.assessmentLockHeld)).toBe('yes');
  second.once('dialog', dialog => dialog.accept());
  await secondTools.locator('input[type=file]').setInputFiles({name:'backup.json', mimeType:'application/json', buffer:await readFile(path)});
  await expect.poll(() => second.evaluate(async () => (await navigator.locks.query()).pending?.some(lock => lock.name === 'nabd-al-injaz:assessment-data:v1'))).toBe(true);
  await page.evaluate(() => (window as unknown as {releaseAssessmentTest: () => void}).releaseAssessmentTest());
  await expect(secondTools.getByRole('status')).toContainText('استُعيدت بيانات المنظومة');
});

test('a stale edit cannot overwrite a newer edit in another tab', async ({ page, context }, info) => {
  async function openTests(p: typeof page) {
    await p.goto('/');
    if (info.project.name === 'phone') await p.getByRole('button', {name:/عرض الأقسام/}).click();
    await p.getByRole('button', {name:'الاختبارات والتحصيل', exact:true}).click();
    return p.getByRole('region', {name:'متابعة الاختبارات والتحليل'});
  }
  const a = await openTests(page);
  await a.getByLabel('عنوان الاختبار').fill('سجل مشترك');
  await a.getByLabel('المعلم', {exact:true}).fill('معلم');
  await a.getByRole('button', {name:'حفظ سجل المتابعة'}).click();
  await expect(a.getByRole('status')).toContainText('حُفظ سجل');
  const second = await context.newPage();
  const b = await openTests(second);
  await a.getByText('سجل مشترك · معلم').click();
  await b.getByText('سجل مشترك · معلم').click();
  await a.getByRole('button', {name:'تعديل المتابعة'}).click();
  await b.getByRole('button', {name:'تعديل المتابعة'}).click();
  await a.getByLabel('ملاحظات').fill('تعديل أحدث');
  await a.getByRole('button', {name:'حفظ تعديل المتابعة'}).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nabd-al-injaz:assessment-tracking:v1'))).toContain('تعديل أحدث');
  await b.getByLabel('ملاحظات').fill('تعديل قديم');
  await b.getByRole('button', {name:'حفظ تعديل المتابعة'}).click();
  await expect(b.getByRole('status')).toContainText('تغيّر السجل في نافذة أخرى');
  expect(await page.evaluate(() => localStorage.getItem('nabd-al-injaz:assessment-tracking:v1'))).toContain('تعديل أحدث');
});
