import {
  allEvidence,
  replaceAllEvidence,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPES,
  type Evidence,
} from './evidence-store';
import { PLAN_STORAGE_KEY, type Plan } from './plan-model';

const FORMAT = 'nabd-al-injaz-plans-evidence';
const VERSION = 1;
const MAX_IMPORT_BYTES = 120 * 1024 * 1024;
type FileEntry = Omit<Evidence, 'blob'> & { base64: string };
type Archive = {
  format: string;
  version: number;
  createdAt: string;
  plans: Plan[];
  evidence: FileEntry[];
};
export type PlansBackupArchive = Archive;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function encode(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validPlan(value: unknown): value is Plan {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    !!value.id &&
    typeof value.title === 'string' &&
    !!value.title.trim() &&
    typeof value.kind === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.periodStart === 'string' &&
    typeof value.periodEnd === 'string' &&
    typeof value.archived === 'boolean' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.activities) &&
    value.activities.every(
      (activity: unknown) =>
        isObject(activity) &&
        typeof activity.id === 'string' &&
        !!activity.id &&
        typeof activity.title === 'string' &&
        !!activity.title.trim() &&
        typeof activity.details === 'string' &&
        typeof activity.assignee === 'string' &&
        typeof activity.dueDate === 'string' &&
        typeof activity.createdAt === 'string' &&
        (activity.completedAt === null || typeof activity.completedAt === 'string') &&
        ['not_started', 'in_progress', 'completed'].includes(String(activity.progress)),
    )
  );
}
export async function createPlansBackupArchive(plans: Plan[]): Promise<PlansBackupArchive> {
  const records = await allEvidence();
  const linked = new Set(plans.flatMap((p) => p.activities.map((a) => p.id + ':' + a.id)));
  const evidence: FileEntry[] = [];
  for (const record of records) {
    if (!linked.has(record.planId + ':' + record.activityId)) continue;
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    if (bytes.length !== record.size)
      throw new Error('حجم أحد الشواهد المحفوظة لا يطابق بياناته؛ لم تُنشأ النسخة.');
    evidence.push({
      id: record.id,
      planId: record.planId,
      activityId: record.activityId,
      name: record.name,
      mime: record.mime,
      size: record.size,
      createdAt: record.createdAt,
      note: record.note,
      base64: encode(bytes),
    });
  }
  const archive: Archive = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    plans,
    evidence,
  };
  return archive;
}
export async function exportPlansBackup(plans: Plan[]): Promise<void> {
  const archive = await createPlansBackupArchive(plans);
  download(
    new Blob([JSON.stringify(archive)], { type: 'application/json' }),
    'nabd-plans-evidence-' + new Date().toISOString().slice(0, 10) + '.json',
  );
}
export async function restorePlansBackup(file: File): Promise<Plan[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('حجم النسخة يتجاوز 120MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('ملف النسخة الاحتياطية ليس JSON صالحًا.');
  }
  if (
    !isObject(parsed) ||
    parsed.format !== FORMAT ||
    parsed.version !== VERSION ||
    !Array.isArray(parsed.plans) ||
    !parsed.plans.every(validPlan) ||
    !Array.isArray(parsed.evidence)
  )
    throw new Error('ملف النسخة غير مطابق لإصدار النسخ الاحتياطي المعتمد.');
  const plans: Plan[] = parsed.plans;
  const ids = new Set<string>();
  const linked = new Set<string>();
  for (const plan of plans) {
    if (ids.has('p:' + plan.id)) throw new Error('النسخة تحتوي معرّفات خطط مكررة.');
    ids.add('p:' + plan.id);
    for (const activity of plan.activities) {
      if (ids.has('a:' + activity.id)) throw new Error('النسخة تحتوي معرّفات أنشطة مكررة.');
      ids.add('a:' + activity.id);
      linked.add(plan.id + ':' + activity.id);
    }
  }
  const evidence: Evidence[] = [];
  for (const entry of parsed.evidence as unknown[]) {
    if (
      !isObject(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      ids.has('e:' + entry.id) ||
      typeof entry.planId !== 'string' ||
      typeof entry.activityId !== 'string' ||
      !linked.has(entry.planId + ':' + entry.activityId) ||
      typeof entry.name !== 'string' ||
      !entry.name ||
      typeof entry.mime !== 'string' ||
      !EVIDENCE_TYPES.includes(entry.mime) ||
      typeof entry.base64 !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64) ||
      typeof entry.size !== 'number' ||
      !Number.isInteger(entry.size) ||
      entry.size < 1 ||
      entry.size > EVIDENCE_MAX_BYTES ||
      typeof entry.createdAt !== 'string' ||
      typeof entry.note !== 'string'
    )
      throw new Error('النسخة تحتوي شاهدًا غير صالح أو غير مرتبط بنشاط.');
    ids.add('e:' + entry.id);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error('تعذّر فك محتوى أحد ملفات الشواهد.');
    }
    if (bytes.length !== entry.size)
      throw new Error('حجم أحد ملفات الشواهد لا يطابق بيانات النسخة.');
    evidence.push({
      id: entry.id,
      planId: entry.planId,
      activityId: entry.activityId,
      name: entry.name,
      mime: entry.mime,
      size: entry.size,
      createdAt: entry.createdAt,
      note: entry.note,
      blob: new Blob([bytes], { type: entry.mime }),
    });
  }
  const previous = localStorage.getItem(PLAN_STORAGE_KEY);
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
    await replaceAllEvidence(evidence);
  } catch (error) {
    if (previous === null) localStorage.removeItem(PLAN_STORAGE_KEY);
    else localStorage.setItem(PLAN_STORAGE_KEY, previous);
    throw error;
  }
  return plans;
}
export async function exportEvidenceReport(plans: Plan[]): Promise<void> {
  const records = await allEvidence();
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = record.planId + ':' + record.activityId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const escape = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+@-]/.test(text.trimStart()) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows: (string | number)[][] = [
    ['الخطة', 'النشاط', 'حالة التنفيذ', 'عدد الشواهد', 'حالة التوثيق'],
  ];
  for (const plan of plans)
    for (const activity of plan.activities) {
      const count = counts.get(plan.id + ':' + activity.id) ?? 0;
      rows.push([
        plan.title,
        activity.title,
        activity.progress === 'completed'
          ? 'مكتمل'
          : activity.progress === 'in_progress'
            ? 'قيد التنفيذ'
            : 'لم يبدأ',
        count,
        activity.progress === 'completed'
          ? count
            ? 'مكتمل وموثق'
            : 'مكتمل دون شواهد'
          : count
            ? 'شواهد دون اكتمال'
            : 'غير موثق',
      ]);
    }
  download(
    new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    'nabd-evidence-report.csv',
  );
}
