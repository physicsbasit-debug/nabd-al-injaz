import { DAYS, normalizeTeacher, validPeriod, type Day, type DayCoverage, type LessonInput, type ScheduleImportBatch } from './schedule-model';
import JSZip from 'jszip';

const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

async function excelJsCompatibleData(data: ArrayBuffer): Promise<Uint8Array> {
  const archive = await JSZip.loadAsync(data);
  for (const entry of Object.values(archive.files)) {
    if (entry.dir || !entry.name.startsWith('xl/') || !entry.name.endsWith('.xml')) continue;
    const xml = await entry.async('string');
    const namespace = xml.match(/xmlns:x=(["'])([^"']+)\1/);
    if (namespace?.[2] !== SPREADSHEET_NS || !/<\/?x:[\w.-]+\b/.test(xml)) continue;
    const defaultNamespace = xml.match(/xmlns=(["'])([^"']+)\1/);
    if (defaultNamespace && defaultNamespace[2] !== SPREADSHEET_NS) {
      throw new Error('صيغة XML داخل ملف Excel غير مدعومة. أعد حفظ الملف بصيغة XLSX من Excel.');
    }
    const compatibleXml = (defaultNamespace
      ? xml
      : xml.replace(namespace[0], namespace[0] + ' xmlns="' + SPREADSHEET_NS + '"')
    ).replace(/(<\/?)(x:)/g, '$1');
    archive.file(entry.name, compatibleXml);
  }
  return archive.generateAsync({ type: 'uint8array' });
}
export type SchedulePreview = ScheduleImportBatch & { errors: string[]; sheet: string; format: 'long' | 'wide'; totalRows: number };
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
const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
const normalizeHeader = (s: string) => latinDigits(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا');
const normalizedAliases = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, names.map(normalizeHeader)]));
function dayFromText(s: string): Day | undefined {
  return DAYS.find((day) => normalizeHeader(day) === normalizeHeader(s));
}
function periodHeader(s: string): number | null {
  const m = normalizeHeader(s).match(/^(?:ح|حصة|الحصة|p|period)\s*([0-9]{1,2})$/);
  if (!m) return null;
  const number = Number(m[1]);
  return validPeriod(number) ? number : null;
}
type ExcelWorksheet = import('exceljs').Worksheet;
type Header = { sheet: ExcelWorksheet; rowNumber: number; columns: Record<string, number>; periodColumns: Map<number, number>; format: 'long' | 'wide' };
function findHeaders(sheet: ExcelWorksheet): Header[] {
  const found: Header[] = [];
  for (let rowNumber = 1; rowNumber <= Math.min(30, sheet.rowCount); rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const columns: Record<string, number> = {};
    const periodColumns = new Map<number, number>();
    row.eachCell((cell, col) => {
      const text = normalizeHeader(cellText(cell.value));
      for (const [key, names] of Object.entries(normalizedAliases)) if (names.includes(text)) columns[key] = col;
      const period = periodHeader(text);
      if (period !== null) periodColumns.set(period, col);
    });
    if (!columns.teacher || !columns.day) continue;
    if (columns.period && periodColumns.size === 0) found.push({ sheet, rowNumber, columns, periodColumns, format: 'long' });
    else if (periodColumns.size >= 2) found.push({ sheet, rowNumber, columns, periodColumns, format: 'wide' });
  }
  return found;
}
function parseLong(header: Header): SchedulePreview {
  const { sheet, columns, rowNumber } = header;
  const rows: LessonInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let totalRows = 0;
  for (let i = rowNumber + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const teacherCell = row.getCell(columns.teacher);
    const dayCell = row.getCell(columns.day);
    const periodCell = row.getCell(columns.period);
    const ambiguous = [teacherCell, dayCell, periodCell].some((cell) => cell.isMerged || (cell.value && typeof cell.value === 'object' && ('formula' in cell.value || 'sharedFormula' in cell.value || 'error' in cell.value)));
    const teacher = normalizeTeacher(cellText(teacherCell.value));
    const dayText = cellText(dayCell.value);
    const periodText = latinDigits(cellText(row.getCell(columns.period).value));
    if (!teacher && !dayText && !periodText) continue;
    totalRows++;
    if (ambiguous) { errors.push('صف ' + i + ': خلية مدمجة أو صيغة حسابية غير مدعومة.'); continue; }
    const day = dayFromText(dayText);
    const periodMatch = periodText.trim().match(/^(?:ح|حصة|الحصة)?\s*([0-9]{1,2})$/);
    const period = periodMatch ? Number(periodMatch[1]) : NaN;
    if (!teacher || !day || !validPeriod(period)) { errors.push('صف ' + i + ': بيانات المعلم أو اليوم أو الحصة غير صالحة.'); continue; }
    const key = JSON.stringify([teacher, day, period]);
    if (seen.has(key)) { errors.push('صف ' + i + ': حصة مكررة للمعلم نفسه.'); continue; }
    seen.add(key);
    rows.push({ teacher, day, period, description: columns.description ? cellText(row.getCell(columns.description).value) : '' });
  }
  if (!rows.length) errors.push('لم يُعثر على حصص صالحة للاستيراد.');
  return { rows, errors, sheet: sheet.name, format: 'long', totalRows, verifiedDays: [] };
}
function parseWide(header: Header): SchedulePreview {
  const { sheet, columns, rowNumber, periodColumns } = header;
  const rows: LessonInput[] = [];
  const errors: string[] = [];
  const verifiedDays: DayCoverage[] = [];
  let totalRows = 0;
  const numbers = [...periodColumns.keys()].sort((a, b) => a - b);
  if (numbers[0] !== 1 || numbers.some((n, i) => n !== i + 1))
    errors.push('أعمدة الحصص يجب أن تبدأ من ح1 وتكون متتابعة دون فجوات.');
  const seen = new Set<string>();
  for (let i = rowNumber + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const teacher = normalizeTeacher(cellText(row.getCell(columns.teacher).value));
    const dayText = cellText(row.getCell(columns.day).value);
    const hasPeriods = [...periodColumns.values()].some((col) => cellText(row.getCell(col).value));
    if (!teacher && !dayText && !hasPeriods) continue;
    totalRows++;
    const day = dayFromText(dayText);
    if (!teacher || !day) { errors.push('صف ' + i + ': اسم المعلم أو اليوم مفقود أو غير معروف.'); continue; }
    const key = JSON.stringify([teacher, day]);
    if (seen.has(key)) { errors.push('صف ' + i + ': جدول مكرر للمعلم في اليوم نفسه.'); continue; }
    seen.add(key);
    let ambiguous = false;
    for (const [period, col] of periodColumns) {
      const cell = row.getCell(col);
      const value = cell.value;
      if (cell.isMerged || (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value || 'error' in value))) {
        errors.push('صف ' + i + '، ح' + period + ': خلية مدمجة أو صيغة حسابية غير مدعومة؛ راجع الملف.');
        ambiguous = true;
        continue;
      }
      const description = cellText(value);
      if (description) rows.push({ teacher, day, period, description });
    }
    if (!ambiguous) verifiedDays.push({ teacher, day });
  }
  if (!totalRows) errors.push('لم يُعثر على صفوف معلمين صالحة.');
  return { rows, errors, sheet: sheet.name, format: 'wide', totalRows, verifiedDays };
}
export async function previewScheduleExcel(file: File): Promise<SchedulePreview> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error('ارفع ملف XLSX بحجم لا يتجاوز 5MB.');
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await excelJsCompatibleData(await file.arrayBuffer())) as never);
  const headers = workbook.worksheets.flatMap(findHeaders);
  if (!headers.length) throw new Error('قالب غير مدعوم: لم أجد أعمدة المعلم واليوم والحصة أو ح1، ح2... لا يُسمح بالتخمين.');
  if (headers.length > 1) throw new Error('وجدت أكثر من جدول محتمل في الملف. افصل الجدول المطلوب في ملف مستقل لتجنب استيراد ناقص.');
  const header = headers[0];
  return header.format === 'wide' ? parseWide(header) : parseLong(header);
}
