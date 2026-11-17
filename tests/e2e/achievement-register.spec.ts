import { test, expect } from '@playwright/test';

test('سجل الإنجاز يصفي السجلات ويفتح نشاط الخطة الأصلي', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('nabd-al-injaz:tasks:v1', JSON.stringify([{id:'old',title:'مهمة سابقة',dueDate:'2026-01-01',priority:'عادية',done:true,createdAt:'2026-01-01T00:00:00Z',category:'أخرى',assignedTo:'',progress:'مكتملة',notes:''}]));
    localStorage.setItem('nabd-al-injaz:plans:v1', JSON.stringify([{id:'p',title:'خطة الإنجاز',kind:'خطة أخرى',owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:'',activities:[{id:'a',title:'نشاط منجز',details:'',assignee:'أحمد',dueDate:'2026-11-01',progress:'completed',completedAt:'2026-11-05T10:00:00Z',createdAt:''}]}]));
  });
  await page.goto('/');
  if (testInfo.project.name === 'phone') await page.getByRole('button', {name:/عرض الأقسام/}).click();
  await page.getByRole('navigation', {name:testInfo.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button', {name:'الإنجازات والشواهد',exact:true}).click();
  const register=page.getByRole('region',{name:'سجل الإنجاز والشواهد'});
  await expect(register).toContainText('مهمة سابقة');
  await expect(register).toContainText('تاريخ الإنجاز: غير مسجل');
  await expect(register).toContainText('نشاط منجز');
  await register.getByLabel('المعلم أو المسؤول').fill('أحمد');
  await expect(register).not.toContainText('مهمة سابقة');
  await expect(register).toContainText('نشاط منجز');
  await register.getByRole('button',{name:'فتح السجل الأصلي'}).click();
  await expect(page.locator('.plan-activity-list')).toContainText('نشاط منجز');
});

test('شاهد النشاط المكتمل يظهر ويمكن تنزيله من سجل الإنجاز', async ({page}, testInfo) => {
  await page.goto('/');
  const go = async (name:string) => {
    if(testInfo.project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
    await page.getByRole('navigation',{name:testInfo.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name,exact:true}).click();
  };
  await go('مكتبة الخطط');
  await page.getByRole('button',{name:'إضافة خطة',exact:true}).click();
  await page.getByLabel('اسم الخطة *').fill('خطة موثقة');
  await page.getByRole('button',{name:'حفظ الخطة'}).click();
  await page.getByRole('button',{name:'إضافة نشاط يدوي'}).click();
  await page.getByLabel('اسم النشاط *').fill('نشاط موثق');
  await page.getByRole('button',{name:'حفظ النشاط'}).click();
  await page.getByRole('button',{name:'الشواهد والتوثيق'}).click();
  await page.getByLabel('ملف الشاهد (PDF، صورة، Word، Excel)').setInputFiles({name:'shahid.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button',{name:'حفظ الشاهد'}).click();
  await expect(page.getByText('1 شاهد محفوظ')).toBeVisible();
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.getByLabel('حالة النشاط: نشاط موثق').selectOption('completed');
  await go('الإنجازات والشواهد');
  const register=page.getByRole('region',{name:'سجل الإنجاز والشواهد'});
  await expect(register).toContainText('1 شاهد مرفق');
  const downloaded=page.waitForEvent('download');
  await register.getByRole('button',{name:'تنزيل الشاهد: shahid.pdf'}).click();
  expect((await downloaded).suggestedFilename()).toBe('shahid.pdf');
});
