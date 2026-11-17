import { test, expect } from '@playwright/test';
test('يعرض تقرير الزيارات ومرشحاته وتفاصيل الشاهد للطباعة', async ({page},info)=>{
 await page.addInitScript(()=>{
  const base={id:'v1',teacher:'أحمد',date:'2026-11-16',status:'completed',subject:'فيزياء',grade:'10',section:'2',period:'2',lesson:'القوى',strengths:'',improvements:'',recommendations:'',followUp:'متابعة الدرس',documentation:'توثيق الزيارة',planId:'',activityId:'',createdAt:'2026-11-01T00:00:00Z'};
  localStorage.setItem('nabd-al-injaz:supervisory-visits:v1',JSON.stringify([base,{...base,id:'v2',teacher:'سالم',date:'',status:'planned'}]));
 });
 await page.goto('/');
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('nabd-al-injaz:supervisory-visit-files:v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:'f1',recordId:'v1',kind:'شاهد',name:'visit.pdf',mime:'application/pdf',size:5,createdAt:'2026-11-16T00:00:00Z',blob:new Blob(['proof'],{type:'application/pdf'})});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}));
 if(info.project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
 await page.getByRole('navigation',{name:info.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'التقارير',exact:true}).click();
 await page.getByRole('button',{name:'تقرير الزيارات الإشرافية',exact:true}).click();
 const report=page.getByRole('region',{name:'تقرير الزيارات الإشرافية'});
 await expect(report).toContainText('متابعة الدرس');await expect(report).toContainText('visit.pdf');await expect(report).toContainText('مرفق (1)');
 await report.getByLabel('المعلم',{exact:true}).selectOption({label:'سالم'});await expect(report).toContainText('غير محدد');await expect(report).not.toContainText('visit.pdf');
 await report.getByLabel('من تاريخ').fill('2026-11-01');await expect(report).toContainText('لا توجد زيارات مطابقة');
 await report.getByLabel('من تاريخ').fill('2026-12-01');await report.getByLabel('إلى تاريخ').fill('2026-11-01');await expect(report.getByRole('button',{name:'طباعة أو حفظ PDF'})).toBeDisabled();
 await report.getByLabel('من تاريخ').fill('');await report.getByLabel('إلى تاريخ').fill('');await report.getByLabel('المعلم',{exact:true}).selectOption({label:'أحمد'});await expect(report.getByRole('button',{name:'طباعة أو حفظ PDF'})).toBeEnabled();
 await page.emulateMedia({media:'print'});await expect(page.locator('.report-type')).toBeHidden();await expect(page.locator('.visit-report-card')).toBeVisible();expect((await page.pdf({format:'A4',printBackground:true})).length).toBeGreaterThan(1000);
});
test('يمنع إعداد تقرير الزيارات عند تلف سجلها',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('nabd-al-injaz:supervisory-visits:v1','{bad'));await page.goto('/');if(info.project.name==='phone')await page.getByRole('button',{name:/عرض الأقسام/}).click();await page.getByRole('navigation',{name:info.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'التقارير',exact:true}).click();await page.getByRole('button',{name:'تقرير الزيارات الإشرافية',exact:true}).click();const report=page.getByRole('region',{name:'تقرير الزيارات الإشرافية'});await expect(report.getByRole('alert')).toContainText('تعذرت قراءة سجل الزيارات');await expect(report.getByRole('button',{name:'طباعة أو حفظ PDF'})).toBeDisabled();
});
