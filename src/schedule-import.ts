import { DAYS, validPeriod, type LessonInput } from './schedule-model';
export type SchedulePreview = { rows: LessonInput[]; errors: string[]; sheet: string };
const aliases = {
  teacher: ['المعلم', 'اسم المعلم', 'teacher'],
  day: ['اليوم', 'day'],
  period: ['الحصة', 'رقم الحصة', 'period'],
  description: ['المادة', 'الصف', 'الدرس', 'الوصف', 'description', 'subject'],
};
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return '';
}
export async function previewScheduleExcel(file: File): Promise<SchedulePreview> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error('ارفع ملف XLSX بحجم لا يتجاوز 5MB.');
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
  let chosen: { sheet: import('exceljs').Worksheet; columns: Record<string, number>; header: number } | null = null;
  for (const sheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= Math.min(12, sheet.rowCount); rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const columns: Record<string, number> = {};
      row.eachCell((cell, col) => {
        const text = cellText(cell.value).toLowerCase();
        for (const [key, labels] of Object.entries(aliases)) if (labels.includes(text)) columns[key] = col;
      });
      if (columns.teacher && columns.day && columns.period) { chosen = { sheet, columns, header: rowNumber }; break; }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error('لم أجد أعمدة المعلم واليوم والحصة. استخدم قالبًا جدوليًا بعناوين واضحة.');
  const { sheet, columns, header } = chosen;
  const rows: LessonInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (let i = header + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const teacher = cellText(row.getCell(columns.teacher).value).replace(/\s+/g, ' ');
    const dayText = cellText(row.getCell(columns.day).value);
    const periodText = cellText(row.getCell(columns.period).value);
    if (!teacher && !dayText && !periodText) continue;
    const day = DAYS.find((d) => d === dayText);
    const period = Number(periodText.replace(/[^0-9]/g, ''));
    if (!teacher || !day || !validPeriod(period)) { errors.push('صف ' + i + ': بيانات المعلم أو اليوم أو الحصة غير صالحة.'); continue; }
    const key = teacher + ':' + day + ':' + period;
    if (seen.has(key)) { errors.push('صف ' + i + ': حصة مكررة للمعلم نفسه.'); continue; }
    seen.add(key);
    rows.push({ teacher, day, period, description: columns.description ? cellText(row.getCell(columns.description).value) : '' });
  }
  if (!rows.length) errors.push('لم يُعثر على حصص صالحة للاستيراد.');
  return { rows, errors, sheet: sheet.name };
}
