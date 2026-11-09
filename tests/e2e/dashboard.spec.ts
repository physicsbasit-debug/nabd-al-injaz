import { test, expect } from '@playwright/test';
test('dashboard and task manager share the same data and progress',async({page})=>{
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('lang','ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.getByRole('heading',{name:'الرئيسية',level:1})).toBeVisible();
 await expect(page.getByRole('img',{name:'نسبة الإنجاز 0%'})).toBeVisible();
 if(test.info().project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
 await page.getByRole('navigation',{name:test.info().project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'الخطط والمهام'}).click();
 await page.getByRole('button',{name:'إضافة مهمة جديدة'}).click();
 await page.getByPlaceholder('مثال: متابعة تنفيذ الخطة الأسبوعية').fill('مراجعة الاختبارات القصيرة');
 await page.getByRole('button',{name:'إضافة المهمة'}).click();
 if(test.info().project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
 await page.getByRole('navigation',{name:test.info().project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'الرئيسية'}).click();
 await expect(page.getByRole('img',{name:'نسبة الإنجاز 0%'})).toBeVisible();
 await page.getByRole('button',{name:/مراجعة الاختبارات القصيرة/}).click();
 await expect(page.getByRole('img',{name:'نسبة الإنجاز 100%'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('img',{name:'نسبة الإنجاز 100%'})).toBeVisible();
 await page.screenshot({path:`test-results/dashboard-${test.info().project.name}.png`,fullPage:true});
});
test('navigation and document width',async({page})=>{
 await page.goto('/');
 if(test.info().project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
 await page.getByRole('navigation',{name:test.info().project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name:'الخطط والمهام'}).click();
 await expect(page.getByRole('heading',{name:'الخطط والمهام',level:1})).toBeVisible();
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 expect(size.scroll).toBeLessThanOrEqual(size.viewport+1);
});