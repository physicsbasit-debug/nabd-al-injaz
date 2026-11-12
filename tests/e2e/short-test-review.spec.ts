import { expect, test } from '@playwright/test';

test('short test records show numeric issues, persist, and allow manual revision', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('button', { name: 'الاختبارات والتحصيل', exact: true }).click();
  const section = page.getByRole('region', { name: 'مراجعة الاختبارات القصيرة' });
  await section.getByLabel('عنوان الاختبار').fill('اختبار تجريبي');
  await section.getByLabel('المعلم', { exact: true }).fill('معلم تجريبي');
  await section.getByLabel('المادة', { exact: true }).fill('فيزياء');
  await section.getByLabel('الصف', { exact: true }).selectOption('10');
  for (const [name, value] of [['عدد الدروس','2'],['عدد المفردات','5'],['الدرجة الكلية','10'],['درجات المعرفة','4'],['درجات التطبيق','4'],['درجات الاستدلال','2'],['مفردات الاختيار من متعدد','2'],['مفردات الإجابة الطويلة','1']]) await section.getByLabel(name).fill(value);
  await section.getByRole('button', { name: 'حفظ سجل الاختبار' }).click();
  await expect(section.getByRole('status')).toContainText('حُفظ');
  await section.getByText('اختبار تجريبي', { exact: true }).click();
  await expect(section.getByText('الأعداد المدخلة توافق البنود العددية المفحوصة؛ بقية البنود تحتاج مراجعة يدوية.')).toBeVisible();
  await section.getByRole('button', { name: 'تعديل سجل الاختبار' }).click();
  await section.getByLabel('عدد المفردات').fill('4');
  await section.getByRole('button', { name: 'حفظ التعديل' }).click();
  await expect(section.getByText('عدد المفردات يجب أن يكون من 5 إلى 7.')).toBeVisible();
  await page.reload();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('button', { name: 'الاختبارات والتحصيل', exact: true }).click();
  await expect(page.getByText('اختبار تجريبي', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('short-test-review.png'), fullPage: true });
  await page.getByText('اختبار تجريبي', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'حذف سجل الاختبار' }).click();
  await expect(page.getByText('اختبار تجريبي', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'حذف سجل الاختبار' }).click();
  await expect(page.getByText('اختبار تجريبي', { exact: true })).toHaveCount(0);

});
