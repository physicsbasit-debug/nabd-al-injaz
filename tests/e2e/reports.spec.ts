import {test,expect} from '@playwright/test';
test('تقرير العمل يصفي السجلات ويجهز تخطيط الطباعة',async({page},info)=>{
 await page.addInitScript(()=>{localStorage.setItem('nabd-al-injaz:tasks:v1',JSON.stringify([{id:'t',title:'عمل للاختبار',dueDate:'2026-11-18',priority:'عادية',done:false,createdAt:'2026-11-01T00:00:00Z',category:'أخرى',assignedTo:'أحمد',progress:'لم تبدأ',notes:''}]));});
 await page.goto('/');if(info.project.name==='phone')await page.getByRole('button',{name:/عرض الأقسام/}).click();await page.getByRole('navigation',{name:info.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'التقارير',exact:true}).click();
 const report=page.getByRole('region',{name:'التقارير'});await expect(report).toContainText('عمل للاختبار');await report.getByLabel('المعلم أو المسؤول').fill('غير مطابق');await expect(report).toContainText('لا توجد سجلات مطابقة');await report.getByLabel('المعلم أو المسؤول').fill('أحمد');await expect(report).toContainText('عمل للاختبار');
 await expect(report.getByRole('button',{name:'طباعة أو حفظ PDF'})).toBeEnabled();await page.emulateMedia({media:'print'});await expect(page.locator('.report-preview')).toBeVisible();await expect(page.locator('.reports-controls')).toBeHidden();const pdf=await page.pdf({format:'A4',printBackground:true});expect(pdf.length).toBeGreaterThan(1000);
});

test('يمنع تقريرًا مضللًا عند تعذر قراءة المتابعة الفنية',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('nabd-al-injaz:technical-followup:v1','{invalid'));await page.goto('/');if(info.project.name==='phone')await page.getByRole('button',{name:/عرض الأقسام/}).click();await page.getByRole('navigation',{name:info.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'التقارير',exact:true}).click();await expect(page.getByRole('alert')).toContainText('تعذرت قراءة بعض السجلات');await expect(page.getByRole('button',{name:'طباعة أو حفظ PDF'})).toBeDisabled();
});
