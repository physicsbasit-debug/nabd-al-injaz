import type { PlanActivity } from './plan-model';

export type ImportCandidate = {
  key: string;
  source: string;
  title: string;
  assignee: string;
  dueDate: string;
  details: string;
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
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
    const candidates: ImportCandidate[] = [];
    for (const sheet of workbook.worksheets.slice(0, 20)) {
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
  const pages = Math.min(pdf.numPages, 40);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
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
      progress: 'not_started',
      completedAt: null,
      createdAt: new Date().toISOString(),
    }));
}
