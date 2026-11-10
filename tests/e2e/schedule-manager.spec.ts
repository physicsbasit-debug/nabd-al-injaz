import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

async function openSchedules(page: import('@playwright/test').Page, mobile: boolean) {
  await page.goto('/');
  if (mobile) await page.getByRole('button', { name: /عرض الأقسام/ }).click();
  await page
    .getByRole('navigation', { name: mobile ? 'أقسام الهاتف' : 'الأقسام الرئيسية' })
    .getByRole('button', { name: 'الجداول والاحتياط' })
    .click();
  await page.getByText('إعداد وتعديل الجدول', { exact: true }).click();
}

async function dateForWeekday(page: import('@playwright/test').Page, weekday: number) {
  return page.evaluate((target) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    while (date.getDay() !== target) date.setDate(date.getDate() + 1);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }, weekday);
}
test('manual schedules persist, reject conflicts and show free teachers', async ({
  page,
}, testInfo) => {
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('أحمد');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('سالم');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByLabel('معلم الحصة').selectOption('أحمد');
  await page.getByLabel('يوم الحصة').selectOption('الأحد');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await expect(page.getByText('تم تسجيل الحصة.')).toBeVisible();
  await page.getByLabel('يوم التوفر').selectOption('الأحد');
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('0 من 2');
  await page.getByLabel('معلم التحقق').selectOption('سالم');
  await page.getByLabel('يوم التحقق').selectOption('الأحد');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.getByLabel('معلم التحقق').selectOption('أحمد');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.getByLabel('تاريخ مسودة الاحتياط').fill(await dateForWeekday(page, 0));
  await page.locator('.schedule-absent').getByLabel('أحمد').check();
  await expect(
    page.getByRole('heading', { name: 'معاينة الاحتياط للغياب' }).locator('..').locator('tbody'),
  ).toContainText('سالم');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await expect(page.getByText('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.')).toBeVisible();
  await page.reload();
  await openSchedules(page, testInfo.project.name === 'phone');
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
  await page.getByLabel('يوم التوفر').selectOption('الأحد');
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.screenshot({
    path: 'test-results/schedules-' + testInfo.project.name + '.png',
    fullPage: true,
  });
});
test('Excel preview requires approval and rejects duplicate rows', async ({ page }, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('جدول');
  sheet.addRow(['المعلم', 'اليوم', 'الحصة', 'المادة']);
  sheet.addRow(['نورة', 'الإثنين', 2, 'العلوم']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'schedule.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText('وصل الملف وقُرئ بنجاح')).toBeVisible();
  await expect(page.getByText(/الملف المحدد: schedule\.xlsx/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (1)' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'اعتماد الجدول (1)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'schedule.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await page.getByRole('button', { name: 'اعتماد الجدول (1)' }).click();
  await expect(page.getByText('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
});

test('wide template imports blank free periods only after explicit completeness approval', async ({
  page,
}, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('الجدول الأفقي');
  sheet.addRow(['مقدمة']);
  sheet.addRow(['اسم المعلم', 'اليوم', 'ح1', 'ح2', 'ح3']);
  sheet.addRow(['أحمد', 'الأحد', 'تاسع 1 علوم', '', '']);
  sheet.addRow(['سالم', 'الأحد', '', 'عاشر 2 فيزياء', '']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'wide.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText(/نوع القالب: جدول حصص أفقي/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (2)' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /أؤكد أن صفوف الأيام كاملة/ }).check();
  await page.getByRole('button', { name: 'اعتماد الجدول (2)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (2)' })).toBeVisible();
  await page.getByLabel('يوم التوفر').selectOption('الأحد');
  await page.getByLabel('حصة التوفر').fill('1');
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
  await page.getByLabel('تاريخ مسودة الاحتياط').fill(await dateForWeekday(page, 0));
  await page.locator('.schedule-absent').getByLabel('أحمد').check();
  await expect(
    page.getByRole('heading', { name: 'معاينة الاحتياط للغياب' }).locator('..').locator('tbody'),
  ).toContainText('سالم');
  await page.reload();
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('يوم التوفر').selectOption('الأحد');
  await page.getByLabel('حصة التوفر').fill('1');
  await expect(page.getByText(/متفرغون مؤكّدون:/)).toContainText('1 من 2');
});
test('wide template with missing period column is rejected without partial import', async ({
  page,
}, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('الجدول');
  sheet.addRow(['المعلم', 'اليوم', 'ح1', 'ح3']);
  sheet.addRow(['أحمد', 'الأحد', 'علوم', 'فيزياء']);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'gap.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText(/أعمدة الحصص يجب أن تبدأ من ح1/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (2)' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (0)' })).toBeVisible();
});

test('teacher lookup and period availability use the same verified schedule data', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'nabd-al-injaz:schedules:v1',
      JSON.stringify({
        teachers: ['وليد', 'سالم', 'أحمد'],
        lessons: [
          { id: 'lesson-1', teacher: 'وليد', day: 'الأحد', period: 1, description: '10/1 فيزياء' },
          { id: 'lesson-2', teacher: 'أحمد', day: 'الأحد', period: 2, description: '9/2 فيزياء' },
        ],
        verifiedDays: [
          { teacher: 'وليد', day: 'الأحد' },
          { teacher: 'أحمد', day: 'الأحد' },
        ],
      }),
    );
  });
  await page.reload();
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('معلم الجدول').selectOption('وليد');
  await page.getByLabel('يوم الجدول').selectOption('الأحد');
  await expect(page.getByRole('region', { name: 'عرض جدول المعلم' })).toContainText('10/1 فيزياء');
  await page.getByLabel('يوم التوفر').selectOption('الأحد');
  await page.getByLabel('حصة التوفر').fill('1');
  const availability = page.getByRole('region', { name: 'المتفرغون حسب الحصة' });
  await expect(availability).toContainText('أحمد');
  await expect(availability).toContainText('سالم');
  await expect(availability).toContainText('لا يمكن تأكيد تفرغهم');
});

test('date-scoped cover draft persists and invalidates stale assignments', async ({
  page,
}, testInfo) => {
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('أحمد');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByRole('textbox', { name: 'اسم المعلم' }).fill('سالم');
  await page.getByRole('button', { name: 'إضافة معلم' }).click();
  await page.getByLabel('معلم الحصة').selectOption('أحمد');
  await page.getByLabel('يوم الحصة').selectOption('الثلاثاء');
  await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  await page.getByLabel('يوم التحقق').selectOption('الثلاثاء');
  await page.getByLabel('معلم التحقق').selectOption('أحمد');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  await page.getByLabel('معلم التحقق').selectOption('سالم');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  const panel = page.getByRole('region', { name: 'مسودة توزيع الاحتياط' });
  await panel.getByLabel('تاريخ مسودة الاحتياط').fill('2026-11-10');
  await panel.getByRole('checkbox', { name: 'أحمد' }).check();
  await panel.getByLabel('بديل أحمد الحصة 1').selectOption('سالم');
  await panel.getByRole('button', { name: 'إضافة للمسودة' }).click();
  await expect(panel.getByText('تكليفات المسودة (1)')).toBeVisible();
  await expect(panel.getByText('صالح للمراجعة اليدوية')).toBeVisible();
  await page.reload();
  await openSchedules(page, testInfo.project.name === 'phone');
  const restored = page.getByRole('region', { name: 'مسودة توزيع الاحتياط' });
  await restored.getByLabel('تاريخ مسودة الاحتياط').fill('2026-11-10');
  await expect(restored.getByText('تكليفات المسودة (1)')).toBeVisible();
  await restored.getByRole('checkbox', { name: 'أحمد' }).uncheck();
  await expect(restored.getByRole('alert')).toContainText('تكليف غير صالح');
  await restored.getByRole('button', { name: 'إلغاء تكليف سالم عن أحمد' }).click();
  await expect(restored.getByText('تكليفات المسودة (0)')).toBeVisible();
});

test('imports the approved 9-teacher, 45-day, 162-lesson workbook shape atomically', async ({
  page,
}, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('بيانات الاستيراد');
  sheet.addRow(['المعلم', 'اليوم', 'ح1', 'ح2', 'ح3', 'ح4', 'ح5', 'ح6', 'ح7', 'التخصص']);
  let placed = 0;
  for (const teacher of Array.from({ length: 9 }, (_, index) => 'معلم ' + (index + 1))) {
    for (const day of ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']) {
      const row: (string | number)[] = [teacher, day];
      for (let period = 1; period <= 7; period += 1) {
        row.push(placed < 162 ? '10/' + ((placed % 7) + 1) + ' فيزياء' : '');
        if (placed < 162) placed += 1;
      }
      row.push('فيزياء');
      sheet.addRow(row);
    }
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'approved-shape.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(
    page.getByText(
      /نوع القالب: جدول حصص أفقي، صفوف المعلمين: 45، حصص صالحة: 162، أيام قابلة للتوثيق: 45، أخطاء: 0/,
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (162)' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /أؤكد أن صفوف الأيام كاملة/ }).check();
  await page.getByRole('button', { name: 'اعتماد الجدول (162)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (162)' })).toBeVisible();
  await expect(
    page.getByText('تم اعتماد 162 حصة و45 يومًا موثق الاكتمال، دون استبدال البيانات السابقة.'),
  ).toBeVisible();
});

test('imports Excel files with prefixed SpreadsheetML namespaces', async ({ page }, testInfo) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('جدول');
  sheet.addRow(['المعلم', 'اليوم', 'الحصة', 'المادة']);
  sheet.addRow(['أحمد', 'الأحد', 1, '10/1 فيزياء']);
  const archive = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  for (const name of Object.keys(archive.files)) {
    if (!name.startsWith('xl/') || !name.endsWith('.xml')) continue;
    const entry = archive.file(name);
    if (!entry) continue;
    const xml = await entry.async('string');
    if (!xml.includes('xmlns="' + namespace + '"')) continue;
    const prefixedXml = xml
      .replace('xmlns="' + namespace + '"', 'xmlns:x="' + namespace + '"')
      .replace(/(<\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, '$1x:$2');
    archive.file(name, prefixedXml);
  }
  const buffer = await archive.generateAsync({ type: 'nodebuffer' });
  await openSchedules(page, testInfo.project.name === 'phone');
  await page.getByLabel('ملف جدول المعلمين').setInputFiles({
    name: 'prefixed-schedule.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText('وصل الملف وقُرئ بنجاح')).toBeVisible();
  await expect(page.getByText(/نوع القالب: قائمة حصص/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'اعتماد الجدول (1)' })).toBeEnabled();
  await page.getByRole('button', { name: 'اعتماد الجدول (1)' }).click();
  await expect(page.getByRole('heading', { name: 'الحصص المسجلة (1)' })).toBeVisible();
});

test('automatic cover respects exemptions and leaves same-period overflow visible', async ({
  page,
}, testInfo) => {
  await openSchedules(page, testInfo.project.name === 'phone');
  for (const name of ['أحمد', 'سالم', 'علي', 'ناصر', 'يوسف']) {
    await page.getByRole('textbox', { name: 'اسم المعلم' }).fill(name);
    await page.getByRole('button', { name: 'إضافة معلم' }).click();
  }
  await page.getByLabel('يوم الحصة').selectOption('الثلاثاء');
  for (const name of ['أحمد', 'سالم', 'علي']) {
    await page.getByLabel('معلم الحصة').selectOption(name);
    await page.getByRole('button', { name: 'حفظ الحصة' }).click();
  }
  await page.getByLabel('يوم التحقق').selectOption('الثلاثاء');
  for (const name of ['أحمد', 'سالم', 'علي', 'ناصر', 'يوسف']) {
    await page.getByLabel('معلم التحقق').selectOption(name);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'تأكيد اكتمال اليوم' }).click();
  }
  const panel = page.getByRole('region', { name: 'مسودة توزيع الاحتياط' });
  await panel.getByLabel('تاريخ مسودة الاحتياط').fill('2026-11-10');
  await panel.getByRole('checkbox', { name: 'أحمد' }).check();
  await panel.getByRole('checkbox', { name: 'سالم' }).check();
  const exemptPolicy = panel.locator('[data-teacher="ناصر"]');
  await exemptPolicy.locator('summary').click();
  await panel.getByLabel('استثناء ناصر').check();
  await panel.getByRole('button', { name: 'توزيع تلقائي للمسودة' }).click();
  await expect(panel.getByRole('status')).toContainText('أُضيف 1 تكليفًا');
  await expect(panel.getByText('تكليفات المسودة (1)')).toBeVisible();
  await expect(panel.locator('table').first()).toContainText('لا يوجد بديل مؤكد');
  await expect(panel.locator('table').last()).toContainText('يوسف');
  await expect(panel.locator('table').last()).not.toContainText('ناصر');
});
