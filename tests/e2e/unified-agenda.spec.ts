import { test, expect } from '@playwright/test';

test('لوحة المتابعة تعرض البنود المسجلة وتفتح النشاط المرتبط', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    localStorage.setItem('nabd-al-injaz:plans:v1', JSON.stringify([{ id:'p', title:'الخطة التجريبية', kind:'خطة أخرى', owner:'', periodStart:'', periodEnd:'', archived:false, createdAt:'', activities:[{id:'a', title:'نشاط للمتابعة', details:'', assignee:'معلم العلوم', dueDate:today, progress:'not_started', completedAt:null, createdAt:''}] }]));
  });
  await page.goto('/');
  const agenda = page.getByRole('region', { name: 'متابعة الأعمال الموحدة' });
  await expect(agenda).toContainText('نشاط للمتابعة');
  await expect(agenda).toContainText('معلم العلوم');
  await agenda.getByRole('button', {name: /نشاط للمتابعة/}).click();
  await expect(page.locator('.plan-activity-list')).toContainText('نشاط للمتابعة');
});

test('تظهر متابعة الاختبارات والبرامج السابقة والأعمال البعيدة في الكشاف', async ({page}) => {
 await page.addInitScript(() => {
  localStorage.setItem('nabd-al-injaz:professional-development:v1', JSON.stringify([{id:'past',title:'برنامج سابق',kind:'مشغل',date:'2000-01-01',period:'',presenter:'معلم',notes:'',attendance:{},completed:false}]));
  localStorage.setItem('nabd-al-injaz:assessment-tracking:v1', JSON.stringify([{id:'exam',title:'اختبار مفتوح',teacher:'معلم',subject:'فيزياء',grade:'10',reviewed:true,submitted:false,analyzed:false,notes:''}]));
 });
 await page.goto('/');
 const agenda=page.getByRole('region',{name:'متابعة الأعمال الموحدة'});
 await expect(agenda.getByRole('button',{name:/برنامج سابق/})).toBeVisible();
 await agenda.getByText('دون موعد',{exact:true}).click();
 await expect(agenda.getByRole('button',{name:/اختبار مفتوح/})).toBeVisible();
});
