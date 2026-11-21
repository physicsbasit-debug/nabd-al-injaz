import { test, expect } from '@playwright/test';

test('النسخ السحابي يتطلب اتصالًا وينشئ نسخة جديدة دون استعادة تلقائية', async ({page}) => {
 await page.addInitScript(() => {
  Object.defineProperty(window,'google',{value:{accounts:{oauth2:{initTokenClient:({callback}:{callback:(value:{access_token:string})=>void})=>({requestAccessToken:()=>callback({access_token:'test-token'})})}}},configurable:true});
 });
 let uploads=0;
 await page.route('https://www.googleapis.com/**',async route=>{
  const request=route.request();
  if(request.method()==='POST') { uploads++; await route.fulfill({status:200,json:{id:'snapshot'}}); }
  else await route.fulfill({status:200,json:{files:uploads?[{id:'snapshot',name:'nabd-backup-test.json',modifiedTime:'2026-11-21T12:00:00Z'}]:[]}});
 });
 await page.goto('/');
 const backup=page.locator('.app-backup-tools');await backup.locator('summary').first().click();
 const drive=page.locator('.drive-backup');await drive.locator('summary').click();
 await drive.getByLabel('معرّف عميل Google للتطبيق').fill('example.apps.googleusercontent.com');
 await drive.getByRole('button',{name:'الاتصال بـ Google',exact:true}).click();
 await expect(drive.getByRole('status')).toContainText('تم الاتصال');
 await drive.getByRole('button',{name:'حفظ نسخة جديدة على Google Drive'}).click();
 await expect(drive.getByRole('status')).toContainText('حُفظت نسخة جديدة');
 await expect(drive.getByRole('button',{name:'استعادة هذه النسخة'})).toBeVisible();
 expect(uploads).toBe(1);
});
