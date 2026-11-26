import { proposePlanDestination, type PlanDestination } from './plan-routing';
import type { PlanActivity } from './plan-model';
import { visitPlanRows } from './visit-plan-import';
import { excelJsCompatibleData } from './schedule-import';
import { extractPlanActivities, type PdfPlanPage } from './pdf-plan-layout';

export type ImportCandidate = {
  key: string;
  source: string;
  title: string;
  assignee: string;
  dueDate: string;
  details: string;
  destination?: PlanDestination;
};
export type ImportPreview = {
  filename: string;
  candidates: ImportCandidate[];
  warnings: string[];
};
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_CANDIDATES = 300;
const tidy = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
const validTitle = (value: string) => value.length >= 4 && value.length <= 160;
function fromLines(lines: string[], filename: string, label: string): ImportPreview {
  const candidates: ImportCandidate[] = [];
  for (let i = 0; i < lines.length && candidates.length < MAX_CANDIDATES; i++) {
    const title = tidy(lines[i]);
    if (!validTitle(title)) continue;
    candidates.push({
      key: label + '-' + i,
      source: label + ' ' + (i + 1),
      title,
      assignee: '',
      dueDate: '',
      details: '',
      destination: proposePlanDestination(title) ?? undefined,
    });
  }
  return {
    filename,
    candidates,
    warnings: [
      'النصوص المعروضة مقترحات للمراجعة وليست أنشطة معتمدة. قد تتضمن عناوين أو نصوصًا غير مرتبطة بالخطة.',
    ],
  };
}
export async function previewPlanFile(file: File): Promise<ImportPreview> {
  if (file.size > MAX_FILE_BYTES) throw new Error('الملف أكبر من الحد المسموح 8MB.');
  if (file.size === 0) throw new Error('الملف فارغ.');
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'docx', 'pdf'].includes(ext ?? ''))
    throw new Error('الصيغ المدعومة: XLSX وDOCX وPDF فقط.');
  const buffer = await file.arrayBuffer();
  if (ext === 'xlsx') {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await excelJsCompatibleData(buffer)) as Parameters<typeof workbook.xlsx.load>[0]);
    const candidates: ImportCandidate[] = [];
    let foundVisitPlan = false;
    for (const sheet of workbook.worksheets.slice(0, 20)) {
      const rows: unknown[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row) => { rows.push((row.values as unknown[]).slice(1)); });
      const visitRows = visitPlanRows(sheet.name, rows);
      if (visitRows !== null) {
        foundVisitPlan = true;
        candidates.push(...visitRows.slice(0, Math.max(0, MAX_CANDIDATES - candidates.length)));
        continue;
      }
      sheet.eachRow((row, index) => {
        if (candidates.length >= MAX_CANDIDATES) return;
        const values = row.values as unknown[];
        const cells = values
          .slice(1)
          .map((v) => {
            if (typeof v === 'object' && v !== null) {
              if ('text' in v) return tidy((v as { text: unknown }).text);
              if ('result' in v) return tidy((v as { result: unknown }).result);
              return '';
            }
            return tidy(v);
          })
          .filter(Boolean);
        if (!cells.length) return;
        if (
          index <= 4 &&
          cells.some((c) =>
            /^(النشاط|الأنشطة|الفعالية|الفعاليات|الإجراء|الإجراءات|اسم النشاط|activity|activities)$/i.test(
              c,
            ),
          )
        )
          return;
        const title = cells.find(validTitle);
        if (!title) return;
        candidates.push({
          key: sheet.name + ':' + index,
          source: sheet.name + '، صف ' + index,
          title,
          destination: proposePlanDestination(title) ?? undefined,
          assignee: '',
          dueDate: '',
          details: cells
            .filter((c) => c !== title)
            .slice(0, 4)
            .join(' | ')
            .slice(0, 500),
        });
      });
    }
    return {
      filename,
      candidates,
      warnings: [
        ...(foundVisitPlan ? ['تواريخ الزيارات مقترحة؛ راجعها ونسّقها قبل الاعتماد. تُستورد كسجلات في الخطة للمتابعة، ولا تُعد زيارات منفذة.'] : []),
        'صفوف Excel مقترحات فقط. تحقق من عنوان النشاط والحقول قبل الاستيراد. لا يتم استيراد المعادلات أو الصور أو تنسيق الخطة.',
      ],
    };
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return fromLines(result.value.split(/\r?\n/), filename, 'سطر');
  }
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
    .promise;
  const lines: string[] = [];
  const layoutPages: PdfPlanPage[] = [];
  const pages = Math.min(pdf.numPages, 40);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    layoutPages.push({page:i,items:content.items.flatMap(item=>'str' in item && 'transform' in item ? [{str:item.str,x:item.transform[4],y:item.transform[5],width:item.width}] : [])});
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str + ' ';
      if ('hasEOL' in item && item.hasEOL) {
        lines.push(line);
        line = '';
      }
    }
    if (line.trim()) lines.push(line);
  }
  const structured = extractPlanActivities(layoutPages);
  if (structured !== null) {
    const candidates = structured.slice(0, MAX_CANDIDATES).map((item, index) => {
      const full = item.text.replace(/\s+/g, ' ').trim().slice(0, 1000);
      const title = full.length > 160 ? full.slice(0, 157).trimEnd() + '…' : full;
      return {key:'pdf-activity-'+index,source:'صفحة '+item.page+'، نشاط '+(index+1),title,assignee:'',dueDate:'',details:full,destination:proposePlanDestination(full) ?? undefined};
    });
    const warnings = ['استُخرجت الأنشطة من عمود الأساليب والأنشطة. راجع النصوص والأقسام قبل الاعتماد؛ قد تؤثر خطوط PDF في دقة الحروف.'];
    if (structured.some(item => item.text.length > 1000)) warnings.push('اختُصرت تفاصيل بعض الأنشطة الطويلة إلى 1000 حرف؛ راجع الأصل.');
    if (structured.length > MAX_CANDIDATES) warnings.push('عُرض أول 300 نشاط فقط.');
    if (pdf.numPages > pages) warnings.push('تم فحص أول 40 صفحة فقط.');
    if (!candidates.length) warnings.push('لم تُكتشف أنشطة مرقمة في الجدول؛ راجع الملف أو استخدم نسخة Excel.');
    return {filename,candidates,warnings};
  }
  const preview = fromLines(lines, filename, 'مقطع');
  if (pdf.numPages > pages) preview.warnings.push('تم فحص أول 40 صفحة فقط.');
  if (preview.candidates.length === 0)
    preview.warnings.push('قد يكون PDF مصورًا؛ لا تتوفر قراءة OCR في هذه المرحلة.');
  return preview;
}
export function approvedActivities(candidates: ImportCandidate[]): PlanActivity[] {
  return candidates
    .filter((c) => validTitle(c.title))
    .map((c) => ({
      id: crypto.randomUUID(),
      title: c.title.trim(),
      assignee: c.assignee.trim().slice(0, 100),
      dueDate: c.dueDate,
      details: c.details.trim().slice(0, 1000),
      ...(c.destination ? { destination: c.destination } : {}),
      progress: 'not_started',
      completedAt: null,
      createdAt: new Date().toISOString(),
    }));
}
