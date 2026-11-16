import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('links a visit to a plan, preserves evidence and safely handles old or damaged backups', async ({ page, browser }, info) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('visit-test-seeded')) return;
    sessionStorage.setItem('visit-test-seeded', 'yes');
    localStorage.setItem('nabd-al-injaz:plans:v1', JSON.stringify([{
      id: 'plan-1', title: 'خطة تجريبية', kind: 'خطة المادة', owner: '', periodStart: '', periodEnd: '', archived: false,
      createdAt: '2026-11-16T08:00:00.000Z', activities: [{ id: 'activity-1', title: 'زيارة صفية تجريبية', details: '', assignee: '', dueDate: '', progress: 'not_started', completedAt: null, createdAt: '2026-11-16T08:00:00.000Z', destination: 'الزيارات الإشرافية' }],
    }]));
  });
  await page.goto('/');
  const initialBackupTools = page.locator('.app-backup-tools');
  await initialBackupTools.locator('summary').click();
  const emptyDownloadPromise = page.waitForEvent('download');
  await initialBackupTools.getByRole('button', { name: 'تنزيل نسخة كاملة' }).click();
  const emptyPath = info.outputPath('empty-visits-backup.json');
  await (await emptyDownloadPromise).saveAs(emptyPath);
  expect(JSON.parse(await readFile(emptyPath, 'utf8')).localData['nabd-al-injaz:supervisory-visits:v1']).toBe('[]');
  const navigate = async (name: string) => {
    if (info.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
    await page.getByRole('navigation', { name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name, exact: true }).click();
  };
  await navigate('الزيارات الإشرافية');
  await page.getByRole('button', { name: 'ربط زيارة بهذا النشاط' }).click();
  const visits = page.getByRole('region', { name: 'سجل الزيارات الإشرافية' });
  await expect(visits.getByLabel('النشاط المرتبط من الخطة')).toHaveValue(JSON.stringify(['plan-1', 'activity-1']));
  await visits.getByLabel('المعلم').fill('معلم تجريبي');
  await visits.getByLabel('تاريخ الزيارة').fill('2026-11-16');
  if (info.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'الرئيسية', exact: true }).click();
  if (info.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'الزيارات الإشرافية', exact: true }).click();
  await expect(visits.getByLabel('المعلم')).toHaveValue('معلم تجريبي');
  await expect(visits.getByLabel('تاريخ الزيارة')).toHaveValue('2026-11-16');
  await visits.getByLabel('حالة الزيارة').selectOption('completed');
  await visits.getByLabel('المادة').selectOption('فيزياء');
  await visits.getByLabel('الصف').selectOption('10');
  await visits.getByLabel('الشعبة').fill('2');
  await visits.getByLabel('موضوع الدرس').fill('القوى');
  await visits.getByLabel('التوصيات').fill('متابعة تجريبية');
  await visits.getByRole('button', { name: 'حفظ الزيارة' }).click();
  await expect(visits.getByRole('status')).toContainText('حُفظت الزيارة');
  await visits.getByText('معلم تجريبي', { exact: false }).first().click();
  await expect(visits.locator('details').getByText('خطة تجريبية', { exact: false })).toBeVisible();
  await visits.getByLabel('إرفاق شاهد للزيارة').setInputFiles({ name: 'visit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('safe visit evidence') });
  await expect(visits.getByText('visit.pdf')).toBeVisible();
  await page.reload();
  await navigate('الزيارات الإشرافية');
  await visits.getByText('معلم تجريبي', { exact: false }).first().click();
  await expect(visits.getByText('visit.pdf')).toBeVisible();
  await navigate('الرئيسية');
  const backupTools = page.locator('.app-backup-tools');
  await backupTools.locator('summary').click();
  const downloadPromise = page.waitForEvent('download');
  await backupTools.getByRole('button', { name: 'تنزيل نسخة كاملة' }).click();
  const download = await downloadPromise;
  const path = info.outputPath('visits-backup.json');
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(backup.supervisoryVisitFiles).toHaveLength(1);
  expect(backup.localData['nabd-al-injaz:supervisory-visits:v1']).toContain('معلم تجريبي');
  const damaged = structuredClone(backup);
  damaged.supervisoryVisitFiles[0].base64 = 'AA==';
  page.once('dialog', dialog => dialog.accept());
  await backupTools.locator('input[type=file]').setInputFiles({ name: 'damaged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(damaged)) });
  await expect(backupTools.getByRole('status')).toContainText('غير صالح');
  const incomplete = structuredClone(backup);
  incomplete.supervisoryVisitFiles = [];
  delete incomplete.localData['nabd-al-injaz:supervisory-visits:v1'];
  page.once('dialog', dialog => dialog.accept());
  await backupTools.locator('input[type=file]').setInputFiles({ name: 'incomplete.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incomplete)) });
  await expect(backupTools.getByRole('status')).toContainText('غير مكتملة');
  expect(await page.evaluate(() => localStorage.getItem('nabd-al-injaz:supervisory-visits:v1'))).toContain('معلم تجريبي');
  const legacy = structuredClone(backup);
  delete legacy.supervisoryVisitFiles;
  delete legacy.localData['nabd-al-injaz:supervisory-visits:v1'];
  legacy.plansAndEvidence.plans = [];
  page.once('dialog', dialog => dialog.accept());
  await backupTools.locator('input[type=file]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect(backupTools.getByRole('status')).toContainText('استُعيدت');
  expect(await page.evaluate(() => localStorage.getItem('nabd-al-injaz:supervisory-visits:v1'))).toContain('معلم تجريبي');
  await navigate('الزيارات الإشرافية');
  await visits.getByText('معلم تجريبي', { exact: false }).first().click();
  await expect(visits.getByText('النشاط المرتبط غير متاح حاليًا؛ الزيارة محفوظة.')).toBeVisible();
  await expect(visits.getByText('visit.pdf')).toBeVisible();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto('http://127.0.0.1:4173/');
  const restoreTools = other.locator('.app-backup-tools');
  await restoreTools.locator('summary').click();
  other.once('dialog', dialog => dialog.accept());
  await restoreTools.locator('input[type=file]').setInputFiles(path);
  await expect(restoreTools.getByRole('status')).toContainText('استُعيدت');
  await other.getByRole('button', { name: 'الزيارات الإشرافية', exact: true }).click();
  const restored = other.getByRole('region', { name: 'سجل الزيارات الإشرافية' });
  await restored.getByText('معلم تجريبي', { exact: false }).first().click();
  const evidenceDownload = other.waitForEvent('download');
  await restored.getByRole('button', { name: 'تنزيل الشاهد' }).click();
  const evidence = await evidenceDownload;
  const evidencePath = info.outputPath('restored-visit.pdf');
  await evidence.saveAs(evidencePath);
  expect(await readFile(evidencePath, 'utf8')).toBe('safe visit evidence');
  await context.close();
});

test('does not create a new link to a plan activity removed in another tab', async ({ page, context }, info) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('nabd-al-injaz:plans:v1', JSON.stringify([{
    id: 'plan-live', title: 'خطة تجريبية', kind: 'خطة المادة', owner: '', periodStart: '', periodEnd: '', archived: false,
    createdAt: '2026-11-16T08:00:00.000Z', activities: [{ id: 'activity-live', title: 'زيارة صفية', details: '', assignee: '', dueDate: '', progress: 'not_started', completedAt: null, createdAt: '2026-11-16T08:00:00.000Z', destination: 'الزيارات الإشرافية' }],
  }])));
  await page.reload();
  if (info.project.name === 'phone') await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page.getByRole('navigation', { name: info.project.name === 'phone' ? 'أقسام الهاتف' : 'الأقسام الرئيسية' }).getByRole('button', { name: 'الزيارات الإشرافية', exact: true }).click();
  await page.getByRole('button', { name: 'ربط زيارة بهذا النشاط' }).click();
  const visits = page.getByRole('region', { name: 'سجل الزيارات الإشرافية' });
  await visits.getByLabel('المعلم').fill('معلم تجريبي');
  await visits.getByLabel('تاريخ الزيارة').fill('2026-11-16');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    const plans = JSON.parse(localStorage.getItem('nabd-al-injaz:plans:v1') || '[]');
    plans[0].activities = [];
    localStorage.setItem('nabd-al-injaz:plans:v1', JSON.stringify(plans));
  });
  await expect(page.getByText('لا توجد أنشطة مصنفة لهذا القسم في الخطط النشطة.')).toBeVisible();
  await visits.getByRole('button', { name: 'حفظ الزيارة' }).click();
  await expect(visits.getByRole('status')).toContainText('لم يعد متاحًا');
  await expect(visits.getByRole('heading', { name: 'الزيارات المسجلة (0)' })).toBeVisible();
  await other.close();
});
