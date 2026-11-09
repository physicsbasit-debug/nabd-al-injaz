import { test, expect } from '@playwright/test';
test('dashboard separates completion and documented activities', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const activities = [0, 1, 2, 3].map((i) => ({
      id: 'e2c2-activity-' + i,
      title: 'نشاط ' + i,
      details: '',
      assignee: '',
      dueDate: '',
      progress: i < 3 ? 'completed' : 'in_progress',
      completedAt: i < 3 ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
    }));
    localStorage.setItem(
      'nabd-al-injaz:plans:v1',
      JSON.stringify([
        {
          id: 'e2c2-plan',
          title: 'خطة التوثيق',
          kind: 'خطة المادة',
          owner: '',
          periodStart: '',
          periodEnd: '',
          archived: false,
          createdAt: new Date().toISOString(),
          activities,
        },
      ]),
    );
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('nabd-al-injaz:evidence:v1', 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('by_activity', 'activityId', { unique: false });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('files', 'readwrite');
        for (const i of [0, 1, 3])
          tx.objectStore('files').put({
            id: 'e2c2-evidence-' + i,
            planId: 'e2c2-plan',
            activityId: 'e2c2-activity-' + i,
            name: 'evidence.pdf',
            mime: 'application/pdf',
            size: 5,
            createdAt: new Date().toISOString(),
            note: '',
            blob: new Blob(['test'], { type: 'application/pdf' }),
          });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  const card = page.getByRole('button', { name: 'فتح خطة: خطة التوثيق' });
  await expect(card.getByText('75%')).toBeVisible();
  await expect(card.getByText('50%')).toBeVisible();
  await expect(card.getByText('2 من 4 أنشطة مكتملة وموثقة')).toBeVisible();
  await expect(card.getByText('1 مكتملة دون شواهد')).toBeVisible();
  await page.screenshot({ path: 'test-results/documentation-dashboard.png', fullPage: true });
});
