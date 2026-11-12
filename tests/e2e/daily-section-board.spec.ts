import { test, expect } from '@playwright/test';

test('home shows a truthful daily summary for every section', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const current = new Date();
    current.setHours(12, 0, 0, 0);
    const dateKey = (date: Date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
    const today = dateKey(current);
    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'][current.getDay()];

    localStorage.setItem(
      'nabd-al-injaz:tasks:v1',
      JSON.stringify([
        {
          id: 'today-task',
          title: 'مراجعة نتائج الطلبة',
          dueDate: today,
          priority: 'عاجلة',
          done: false,
          createdAt: new Date().toISOString(),
          category: 'تقويم وتحصيل',
          assignedTo: '',
          progress: 'لم تبدأ',
          notes: '',
        },
        {
          id: 'late-task',
          title: 'متابعة متأخرة',
          dueDate: dateKey(yesterday),
          priority: 'عادية',
          done: false,
          createdAt: new Date().toISOString(),
          category: 'متابعة فنية',
          assignedTo: '',
          progress: 'قيد التنفيذ',
          notes: '',
        },
      ]),
    );
    localStorage.setItem(
      'nabd-al-injaz:plans:v1',
      JSON.stringify([
        {
          id: 'plan',
          title: 'خطة المادة',
          kind: 'خطة المادة',
          owner: '',
          periodStart: '',
          periodEnd: '',
          archived: false,
          createdAt: '',
          activities: [
            {
              id: 'due-activity',
              title: 'زيارة صفية',
              details: '',
              assignee: '',
              dueDate: today,
              progress: 'not_started',
              completedAt: null,
              createdAt: '',
            },
            {
              id: 'done-activity',
              title: 'نشاط منجز',
              details: '',
              assignee: '',
              dueDate: today,
              progress: 'completed',
              completedAt: new Date().toISOString(),
              createdAt: '',
            },
          ],
        },
      ]),
    );
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({
        teachers: ['أحمد', 'سالم'],
        lessons: [{ id: 'lesson', teacher: 'أحمد', day, period: 1, description: '10/1 فيزياء' }],
        verifiedDays: [
          { teacher: 'أحمد', day },
          { teacher: 'سالم', day },
        ],
      }),
    );
    localStorage.setItem(
      'nabd-al-injaz:cover-drafts:v1',
      JSON.stringify({
        version: 1,
        days: { [today]: { absent: ['أحمد'], assignments: [] } },
      }),
    );
  });
  await page.reload();

  const board = page.getByRole('region', { name: 'ملخص الأقسام اليوم' });
  await expect(board.getByRole('heading', { name: 'لوحة اليوم' })).toBeVisible();
  await expect(board).toContainText('الخطط والمهام');
  await expect(board.getByRole('button', { name: /الخطط والمهام.*متابعة مطلوبة/ })).toContainText(
    '1 مستحق اليوم · 1 متأخر',
  );
  await expect(board.getByRole('button', { name: /مكتبة الخطط.*1 خطة نشطة/ })).toContainText(
    '1 نشاط مستحق اليوم',
  );
  if (new Date().getDay() <= 4) {
    await expect(
      board.getByRole('button', { name: /الجداول والاحتياط.*1 حصة مسجلة اليوم/ }),
    ).toContainText('1 غياب مسجل');
  } else {
    await expect(
      board.getByRole('button', { name: /الجداول والاحتياط.*اليوم خارج أيام الدوام المسجلة/ }),
    ).toContainText('لم يُسجل غياب لهذا اليوم');
  }
  await expect(
    board.getByRole('button', { name: /الإنجازات والشواهد.*1 نشاط مكتمل اليوم/ }),
  ).toBeVisible();
  await expect(
    board.getByRole('button', { name: /المتابعة الفنية.*لا توجد موضوعات مسجلة/ }),
  ).toContainText('أدخل موضوعات النشرة لمتابعتها');
  await expect(board.getByRole('button', { name: /الاختبارات والتحصيل.*لا توجد اختبارات مسجلة/ })).toBeVisible();
  for (const name of ['الإنماء المهني', 'التقارير']) {
    await expect(
      board.getByRole('button', { name: new RegExp(name + '.*القسم لم يُفعّل بعد') }),
    ).toBeVisible();
  }

  await board.getByRole('button', { name: /الجداول والاحتياط/ }).click();
  await expect(page.getByRole('heading', { name: 'الجداول والاحتياط', level: 1 })).toBeVisible();
});
