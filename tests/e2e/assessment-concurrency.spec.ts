import { expect, test } from '@playwright/test';

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
  await a.locator('details').filter({hasText:'سجل أول · معلم'}).getByLabel('إضافة ملف اختبار').setInputFiles({name:'test.pdf', mimeType:'application/pdf', buffer:Buffer.from('example')});
  await expect(a.getByText('test.pdf')).toBeVisible();
  other.on('dialog', dialog => dialog.accept());
  await b.getByRole('button', {name:'حذف سجل المتابعة'}).click();
  await expect(b.getByRole('status')).toContainText('احذف ملفات السجل أولًا');
  await b.getByLabel('عنوان الاختبار').fill('سجل ثان');
  await b.getByLabel('المعلم', {exact:true}).fill('معلم');
  await b.getByRole('button', {name:'حفظ سجل المتابعة'}).click();
  await page.reload();
  const again = await openTests(page);
  await expect(again.getByText('سجل أول · معلم')).toBeVisible();
  await expect(again.getByText('سجل ثان · معلم')).toBeVisible();
  await expect(again.getByText('سجل جديد · معلم')).toBeVisible();
});
