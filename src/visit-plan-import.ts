import type { ImportCandidate } from './plan-import';

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const normalize = (v: unknown) => clean(v).normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
function dateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const match = clean(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return '';
  const result = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const date = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === result ? result : '';
}

/** Returns null for an unrelated worksheet so the ordinary importer can handle it. */
export function visitPlanRows(sheet: string, rows: unknown[][]): ImportCandidate[] | null {
  const headerIndex = rows.findIndex((row) => row.some((v) => normalize(v) === 'التاريخ المقترح') &&
    (row.some((v) => normalize(v) === 'اسم المعلم') ||
      (row.some((v) => normalize(v) === 'المعلم الزائر') && row.some((v) => normalize(v) === 'المعلم المستضيف'))));
  if (headerIndex < 0) return null;
  const headers = rows[headerIndex].map(normalize);
  const col = (name: string) => headers.indexOf(normalize(name));
  const peer = col('المعلم الزائر') >= 0;
  const nameIndex = col(peer ? 'المعلم الزائر' : 'اسم المعلم');
  const targetIndex = col('المعلم المستضيف');
  const dateIndex = col('التاريخ المقترح');
  const fields = ['التخصص', 'اليوم', 'حالة المتابعة', 'تاريخ التنفيذ الفعلي', 'التاريخ الفعلي', 'شاهد التوثيق', 'الملاحظات / الشاهد', 'ملاحظات وإجراءات المتابعة'];
  return rows.slice(headerIndex + 1).flatMap((row, offset) => {
    const serialIndex = col('م');
    if (serialIndex >= 0 && !/^[0-9٠-٩]+$/.test(clean(row[serialIndex]))) return [];
    const name = clean(row[nameIndex]);
    const target = peer ? clean(row[targetIndex]) : '';
    if (!name || (peer && !target)) return [];
    const dueDate = dateValue(row[dateIndex]);
    const title = peer ? `زيارة متبادلة: ${name} إلى ${target} – ${sheet}` : `زيارة إشرافية إلى ${name} – ${sheet}`;
    const details = [peer ? `المعلم المستضيف: ${target}` : `المعلم المزور: ${name}`,
      dueDate ? `التاريخ المقترح: ${dueDate}` : '',
      ...fields.map((field) => { const index = col(field); const value = index < 0 ? '' : row[index]; return value ? `${field}: ${value instanceof Date ? dateValue(value) : clean(value)}` : ''; }),
    ].filter(Boolean).join(' | ');
    return [{ key: `${sheet}:${headerIndex + offset + 2}`, source: `${sheet}، صف ${headerIndex + offset + 2}`, title, assignee: name, dueDate, details, destination: peer ? 'الزيارات المتبادلة' as const : 'الزيارات الإشرافية' as const }];
  });
}
