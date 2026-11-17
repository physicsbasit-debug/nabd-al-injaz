import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('توثيق المهمة يرتبط بسجلها ويُحفظ في النسخة الكاملة',async({page},testInfo)=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('seed-work'))return;sessionStorage.setItem('seed-work','1');localStorage.setItem('nabd-al-injaz:tasks:v1',JSON.stringify([{id:'t',title:'توثيق المهمة',dueDate:'',priority:'عادية',done:false,createdAt:'2026-01-01T00:00:00Z',category:'أخرى',assignedTo:'',progress:'لم تبدأ',notes:''}]))});
 await page.goto('/');
 const go=async(name:string)=>{if(testInfo.project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();await page.getByRole('navigation',{name:testInfo.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name,exact:true}).click()};
 await go('الخطط والمهام');
 const panel=page.locator('.work-evidence[aria-label="شواهد: توثيق المهمة"]');await panel.locator('summary').click();
 await panel.getByLabel('إرفاق شاهد').setInputFiles({name:'task.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 task')});
 await expect(panel.getByRole('status')).toContainText('حُفظ الشاهد');
 await page.getByRole('checkbox').check();
 await go('الإنجازات والشواهد');
 const register=page.getByRole('region',{name:'سجل الإنجاز والشواهد'});
 await expect(register).toContainText('1 شاهد مرفق');
 await expect(register.getByRole('button',{name:'تنزيل الشاهد: task.pdf'})).toBeVisible();
 await go('الرئيسية');
 const backup=page.locator('.app-backup-tools');await backup.locator('summary').click();
 const downloading=page.waitForEvent('download');await backup.getByRole('button',{name:'تنزيل نسخة كاملة'}).click();
 const file=await downloading;const path=testInfo.outputPath('work-backup.json');await file.saveAs(path);
 const archive=JSON.parse(await readFile(path,'utf8'));expect(archive.workEvidence).toHaveLength(1);expect(archive.workEvidence[0].ownerId).toBe('t');
 page.once('dialog',d=>d.accept());await backup.locator('input[type=file]').setInputFiles(path);await expect(backup.getByRole('status')).toContainText('استُعيدت بيانات المنظومة');
 const legacy={...archive};delete legacy.workEvidence;
 page.once('dialog',d=>d.accept());await backup.locator('input[type=file]').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await expect(backup.getByRole('status')).toContainText('استُعيدت بيانات المنظومة');
 const incompatible={...legacy,localData:{...legacy.localData,'nabd-al-injaz:tasks:v1':'[]'}};
 page.once('dialog',d=>d.accept());await backup.locator('input[type=file]').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incompatible))});await expect(backup.getByRole('status')).toContainText('لا تتضمن بعض الأعمال');
 await go('الإنجازات والشواهد');await expect(register.getByRole('button',{name:'تنزيل الشاهد: task.pdf'})).toBeVisible();
});

test('شاهد المتابعة الفنية يظهر في سجل الإنجاز',async({page},testInfo)=>{
 await page.addInitScript(()=>localStorage.setItem('nabd-al-injaz:technical-followup:v1',JSON.stringify([{id:'z',teacher:'معلم العلوم',grade:'9',subject:'فيزياء',title:'متابعة الدروس',plannedLessons:1,taughtLessons:1,targetDate:'2026-11-15'}])));
 await page.goto('/');
 const go=async(name:string)=>{if(testInfo.project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();await page.getByRole('navigation',{name:testInfo.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name,exact:true}).click()};
 await go('المتابعة الفنية');
 const panel=page.locator('.work-evidence[aria-label="شواهد: متابعة الدروس"]');await panel.locator('summary').click();
 await panel.getByLabel('إرفاق شاهد').setInputFiles({name:'topic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 topic')});await expect(panel.getByRole('status')).toContainText('حُفظ الشاهد');
 await go('الإنجازات والشواهد');const register=page.getByRole('region',{name:'سجل الإنجاز والشواهد'});await expect(register.getByRole('button',{name:'تنزيل الشاهد: topic.pdf'})).toBeVisible();
});
