import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('full backup transfers school schedules and daily records between browser profiles', async ({
  page,
}, testInfo) => {
  const backupPath = testInfo.outputPath('nabd-backup.json');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('nabd-backup-e2e-seeded')) return;
    sessionStorage.setItem('nabd-backup-e2e-seeded', 'yes');
    localStorage.setItem(
      'nabd-al-injaz:tasks:v1',
      JSON.stringify([
        {
          id: 'task-1',
          title: 'متابعة الغياب',
          dueDate: '2026-11-11',
          priority: 'عادية',
          done: false,
          createdAt: '2026-11-11T06:00:00.000Z',
          category: 'متابعة فنية',
          assignedTo: '',
          progress: 'لم تبدأ',
          notes: '',
        },
      ]),
    );
    localStorage.setItem(
      'nabd-al-injaz:plans:v1',
      JSON.stringify([
        {
          id: 'plan-1',
          title: 'خطة متابعة',
          kind: 'خطة أخرى',
          owner: 'وليد',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          archived: false,
          createdAt: '2026-11-01T00:00:00.000Z',
          activities: [],
        },
      ]),
    );
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({
        teachers: ['أحمد', 'سالم'],
        lessons: [
          { id: 'lesson-1', teacher: 'أحمد', day: 'الأربعاء', period: 1, description: '9/1 علوم' },
        ],
        verifiedDays: [
          { teacher: 'أحمد', day: 'الأربعاء' },
          { teacher: 'سالم', day: 'الأربعاء' },
        ],
      }),
    );
    localStorage.setItem(
      'nabd-al-injaz:cover-drafts:v1',
      JSON.stringify({
        version: 1,
        days: {
          '2026-11-11': {
            absent: ['أحمد'],
            assignments: [],
            processedAt: '2026-11-11T06:30:00.000Z',
          },
        },
      }),
    );
    localStorage.setItem('nabd-al-injaz:short-tests:v1', JSON.stringify([{id:'test-1', teacher:'أحمد', subject:'فيزياء', title:'اختبار تجريبي', grade:'9', status:'بانتظار المراجعة', notes:'', lessons:2, items:9, total:15, knowledge:6, application:6, reasoning:3, multipleChoice:3, longAnswer:1}]));
    localStorage.setItem(
      'nabd-al-injaz:technical-followup:v1',
      JSON.stringify([
        {
          id: 'topic-1',
          teacher: 'وليد',
          grade: '9',
          subject: 'فيزياء',
          title: 'السرعة',
          plannedLessons: 2,
          taughtLessons: 1,
          targetDate: '2026-11-20',
        },
      ]),
    );
  });
  await page.goto('/');
  const tools = page.locator('.app-backup-tools');
  await tools.locator('summary').click();
  const downloadPromise = page.waitForEvent('download');
  await tools.getByRole('button', { name: 'تنزيل نسخة كاملة' }).click();
  const download = await downloadPromise;
  await download.saveAs(backupPath);
  const archive = JSON.parse(await readFile(backupPath, 'utf8')) as {
    format: string;
    localData: Record<string, string>;
    plansAndEvidence: { plans: Array<{ id: string }> };
  };
  expect(archive.format).toBe('nabd-al-injaz-full-backup');
  expect(archive.localData['nabd-al-injaz:schedules:v1']).toContain('أحمد');
  expect(archive.localData['nabd-al-injaz:cover-drafts:v1']).toContain('2026-11-11');
  expect(archive.localData['nabd-al-injaz:technical-followup:v1']).toContain('السرعة');
  expect(archive.localData['nabd-al-injaz:short-tests:v1']).toContain('اختبار تجريبي');
  expect(archive.plansAndEvidence.plans[0].id).toBe('plan-1');

  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('nabd-al-injaz:')) localStorage.removeItem(key);
  });
  await page.reload();
  const restoreTools = page.locator('.app-backup-tools');
  await restoreTools.locator('summary').click();
  page.once('dialog', (dialog) => dialog.accept());
  await restoreTools.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(restoreTools.getByRole('status')).toContainText(
    'استُعيدت بيانات المنظومة والشواهد بنجاح',
  );
  const restored = await page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('nabd-al-injaz:tasks:v1') || '[]'),
    plans: JSON.parse(localStorage.getItem('nabd-al-injaz:plans:v1') || '[]'),
    schedule: JSON.parse(localStorage.getItem('nabd-al-injaz:schedules:v1') || 'null'),
    cover: JSON.parse(localStorage.getItem('nabd-al-injaz:cover-drafts:v1') || 'null'),
    technical: JSON.parse(localStorage.getItem('nabd-al-injaz:technical-followup:v1') || '[]'),
    reviews: JSON.parse(localStorage.getItem('nabd-al-injaz:short-tests:v1') || '[]'),
  }));
  expect(restored.tasks[0].id).toBe('task-1');
  expect(restored.plans[0].id).toBe('plan-1');
  expect(restored.schedule.teachers).toEqual(['أحمد', 'سالم']);
  expect(restored.cover.days['2026-11-11'].absent).toEqual(['أحمد']);
  expect(restored.technical[0].id).toBe('topic-1');
  expect(restored.reviews[0].id).toBe('test-1');
});

test('invalid full backup is rejected without replacing current data', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'nabd-al-injaz:tasks:v1',
      JSON.stringify([
        {
          id: 'keep-task',
          title: 'لا تحذفني',
          dueDate: '',
          priority: 'عادية',
          done: false,
          createdAt: '2026-11-11T06:00:00.000Z',
          category: 'أخرى',
          assignedTo: '',
          progress: 'لم تبدأ',
          notes: '',
        },
      ]),
    ),
  );
  await page.reload();
  const tools = page.locator('.app-backup-tools');
  await tools.locator('summary').click();
  page.once('dialog', (dialog) => dialog.accept());
  await tools.locator('input[type="file"]').setInputFiles({
    name: 'invalid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'wrong-format', version: 1 })),
  });
  await expect(tools.getByRole('status')).toContainText('ملف النسخة لا يطابق');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('nabd-al-injaz:tasks:v1') || '[]')[0]?.id,
      ),
    )
    .toBe('keep-task');
});
