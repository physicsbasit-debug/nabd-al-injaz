import { test, expect } from '@playwright/test';

// اللوحة التفصيلية في الرئيسية مطوية افتراضيًا؛ هذه الاختبارات تتحقق من محتواها فتفتحها كما يفعل المستخدم مرة واحدة.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('nabd-al-injaz:ui:home-details-open', '1'));
});


test('السجلات الثلاثة تظهر في المتابعة ويمكن توثيق الاجتماع', async ({page}, info) => {
 const navigate = async (name:string) => {
  if(info.project.name==='phone') await page.getByRole('button',{name:/عرض الأقسام/}).click();
  await page.getByRole('navigation',{name:info.project.name==='phone'?'أقسام الهاتف':'الأقسام الرئيسية'}).getByRole('button',{name,exact:true}).click();
 };
 await page.goto('/');
 for(const [section,title] of [['الاجتماعات الدورية','اجتماع تخطيط'],['الزيارات المتبادلة','تبادل الخبرات'],['رفع المستوى التحصيلي','برنامج دعم التحصيل']]) {
  await navigate(section);
  const box=page.getByRole('region',{name:'سجل '+section});
  await box.locator('summary').first().click();
  await box.getByLabel('العنوان',{exact:true}).fill(title);
  await box.getByLabel('المعلم أو المسؤول').fill('معلم العلوم');
  await box.getByLabel('التاريخ',{exact:true}).fill('2099-01-01');
  await box.getByRole('button',{name:'حفظ السجل'}).click();
  await expect(box).toContainText(title);
 }
 await navigate('الاجتماعات الدورية');
 const meeting=page.getByRole('region',{name:'سجل الاجتماعات الدورية'});
 await meeting.getByLabel('حالة اجتماع تخطيط').selectOption('completed');
 await meeting.getByRole('button',{name:'الشواهد والتوثيق'}).click();
 const evidence=meeting.getByRole('region',{name:'شواهد النشاط: اجتماع تخطيط'});
 await evidence.getByLabel(/ملف الشاهد/).setInputFiles({name:'minutes.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});
 await evidence.getByRole('button',{name:'حفظ الشاهد'}).click();
 await expect(evidence).toContainText('minutes.pdf');
 await navigate('الرئيسية');
 const agenda=page.getByRole('region',{name:'متابعة الأعمال الموحدة'});
 await agenda.getByText('لاحقًا',{exact:true}).click();
 await expect(agenda).toContainText('تبادل الخبرات');
 await expect(agenda).toContainText('برنامج دعم التحصيل');
 await agenda.getByText('المنجز',{exact:true}).click();
 await expect(agenda).toContainText('اجتماع تخطيط');
});
