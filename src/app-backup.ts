import { replaceAllEvidence, allEvidence, type Evidence } from './evidence-store';
import { COVER_DRAFT_KEY } from './cover-planning';
import {
  restorePlansBackup,
  createPlansBackupArchive,
  type PlansBackupArchive,
} from './plan-backup';
import { PLAN_STORAGE_KEY, type Plan } from './plan-model';
import { SCHEDULE_STORAGE_KEY, validDay, validPeriod } from './schedule-model';
import { readTasks, STORAGE_KEY, type Task } from './task-model';
import { validDate } from './plan-model';
import { TECHNICAL_FOLLOWUP_STORAGE_KEY } from './technical-followup-model';
import { weekdayForDate } from './cover-planning';

const FORMAT = 'nabd-al-injaz-full-backup';
const VERSION = 1;
const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
const MAX_PLANS_BACKUP_BYTES = 120 * 1024 * 1024;
const APP_STORAGE_KEYS = [
  STORAGE_KEY,
  SCHEDULE_STORAGE_KEY,
  COVER_DRAFT_KEY,
  TECHNICAL_FOLLOWUP_STORAGE_KEY,
];
type AppBackup = {
  format: string;
  version: number;
  createdAt: string;
  localData: Record<string, string>;
  plansAndEvidence: PlansBackupArchive;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function parseJson(value: string, key: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('تعذّر التحقق من بيانات القسم: ' + key);
  }
}
function validateLocalData(value: unknown): asserts value is Record<string, string> {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !APP_STORAGE_KEYS.includes(key)) ||
    Object.values(value).some((entry) => typeof entry !== 'string')
  )
    throw new Error('ملف النسخة يحتوي بيانات أقسام غير معروفة. لم تُستبدل بياناتك.');
  if (value[STORAGE_KEY] !== undefined) {
    const tasks = parseJson(value[STORAGE_KEY], 'المهام');
    if (
      !Array.isArray(tasks) ||
      tasks.some(
        (task) =>
          !isRecord(task) ||
          typeof task.id !== 'string' ||
          typeof task.title !== 'string' ||
          typeof task.dueDate !== 'string' ||
          typeof task.done !== 'boolean' ||
          typeof task.createdAt !== 'string' ||
          (task.priority !== 'عادية' && task.priority !== 'عاجلة'),
      )
    )
      throw new Error('بيانات المهام في ملف النسخة غير صالحة.');
  }
  if (value[SCHEDULE_STORAGE_KEY] !== undefined) {
    const schedule = parseJson(value[SCHEDULE_STORAGE_KEY], 'الجداول');
    if (
      !isRecord(schedule) ||
      !Array.isArray(schedule.teachers) ||
      schedule.teachers.some((teacher) => typeof teacher !== 'string') ||
      !Array.isArray(schedule.lessons) ||
      schedule.lessons.some(
        (lesson) =>
          !isRecord(lesson) ||
          typeof lesson.id !== 'string' ||
          typeof lesson.teacher !== 'string' ||
          !schedule.teachers.includes(lesson.teacher) ||
          typeof lesson.day !== 'string' ||
          !validDay(lesson.day) ||
          typeof lesson.period !== 'number' ||
          !validPeriod(lesson.period) ||
          typeof lesson.description !== 'string',
      ) ||
      (schedule.verifiedDays !== undefined &&
        (!Array.isArray(schedule.verifiedDays) ||
          schedule.verifiedDays.some(
            (coverage) =>
              !isRecord(coverage) ||
              typeof coverage.teacher !== 'string' ||
              !schedule.teachers.includes(coverage.teacher) ||
              typeof coverage.day !== 'string' ||
              !validDay(coverage.day),
          )))
    )
      throw new Error('بيانات جدول المعلمين في ملف النسخة غير صالحة.');
  }
  if (value[COVER_DRAFT_KEY] !== undefined) {
    const cover = parseJson(value[COVER_DRAFT_KEY], 'الاحتياط');
    if (
      !isRecord(cover) ||
      cover.version !== 1 ||
      !isRecord(cover.days) ||
      Object.entries(cover.days).some(
        ([date, day]) =>
          !weekdayForDate(date) ||
          !isRecord(day) ||
          !Array.isArray(day.absent) ||
          day.absent.some((name) => typeof name !== 'string') ||
          !Array.isArray(day.assignments) ||
          day.assignments.some(
            (assignment) =>
              !isRecord(assignment) ||
              typeof assignment.id !== 'string' ||
              assignment.date !== date ||
              typeof assignment.lessonId !== 'string' ||
              typeof assignment.absentTeacher !== 'string' ||
              typeof assignment.substitute !== 'string',
          ) ||
          (day.processedAt !== undefined &&
            (typeof day.processedAt !== 'string' || Number.isNaN(Date.parse(day.processedAt)))),
      ) ||
      (cover.teacherPolicies !== undefined &&
        (!isRecord(cover.teacherPolicies) ||
          Object.values(cover.teacherPolicies).some(
            (policy) =>
              !isRecord(policy) ||
              typeof policy.exempt !== 'boolean' ||
              !Number.isInteger(policy.carryInBalance) ||
              Number(policy.carryInBalance) < 0 ||
              !Number.isInteger(policy.priority) ||
              Number(policy.priority) < 0,
          )))
    )
      throw new Error('سجل الاحتياط في ملف النسخة غير صالح.');
  }
  if (value[TECHNICAL_FOLLOWUP_STORAGE_KEY] !== undefined) {
    const topics = parseJson(value[TECHNICAL_FOLLOWUP_STORAGE_KEY], 'المتابعة الفنية');
    if (
      !Array.isArray(topics) ||
      topics.some(
        (topic) =>
          !isRecord(topic) ||
          typeof topic.id !== 'string' ||
          typeof topic.teacher !== 'string' ||
          typeof topic.title !== 'string' ||
          !['8', '9', '10'].includes(String(topic.grade)) ||
          !['علوم عامة', 'فيزياء', 'كيمياء', 'أحياء'].includes(String(topic.subject)) ||
          !Number.isInteger(topic.plannedLessons) ||
          Number(topic.plannedLessons) < 1 ||
          !Number.isInteger(topic.taughtLessons) ||
          Number(topic.taughtLessons) < 0 ||
          Number(topic.taughtLessons) > Number(topic.plannedLessons) ||
          typeof topic.targetDate !== 'string' ||
          !validDate(topic.targetDate),
      )
    )
      throw new Error('بيانات المتابعة الفنية في ملف النسخة غير صالحة.');
  }
}
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

export async function exportAppBackup(plans: Plan[]): Promise<void> {
  const localData: Record<string, string> = {};
  for (const key of APP_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) localData[key] = value;
  }
  validateLocalData(localData);
  const archive: AppBackup = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    localData,
    plansAndEvidence: await createPlansBackupArchive(plans),
  };
  const backupBlob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
  if (new Blob([JSON.stringify(archive.plansAndEvidence)]).size > MAX_PLANS_BACKUP_BYTES)
    throw new Error('حجم الخطط والشواهد يتجاوز الحد المدعوم للنسخ.');
  if (backupBlob.size > MAX_BACKUP_BYTES) throw new Error('حجم النسخة الكاملة يتجاوز 128MB.');
  download(backupBlob, 'nabd-al-injaz-backup-' + new Date().toISOString().slice(0, 10) + '.json');
}

export async function restoreAppBackup(file: File): Promise<{ tasks: Task[]; plans: Plan[] }> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('حجم النسخة يتجاوز 128MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('ملف النسخة الاحتياطية ليس JSON صالحًا.');
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== FORMAT ||
    parsed.version !== VERSION ||
    !isRecord(parsed.plansAndEvidence) ||
    typeof parsed.createdAt !== 'string'
  )
    throw new Error('ملف النسخة لا يطابق نسخة المنظومة المعتمدة.');
  validateLocalData(parsed.localData);

  const previous: Record<string, string | null> = Object.fromEntries(
    [PLAN_STORAGE_KEY, ...APP_STORAGE_KEYS].map((key) => [key, localStorage.getItem(key)]),
  );
  const previousEvidence: Evidence[] = await allEvidence();
  const nextData = parsed.localData;
  try {
    for (const key of APP_STORAGE_KEYS) {
      if (Object.hasOwn(nextData, key)) localStorage.setItem(key, nextData[key]);
      else localStorage.removeItem(key);
    }
    const plansFile = new File([JSON.stringify(parsed.plansAndEvidence)], 'plans-evidence.json', {
      type: 'application/json',
    });
    const plans = await restorePlansBackup(plansFile);
    const tasks = readTasks();
    return { tasks, plans };
  } catch (error) {
    try {
      for (const [key, value] of Object.entries(previous)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      await replaceAllEvidence(previousEvidence);
    } catch {
      throw new Error(
        'فشلت الاستعادة وتعذّر التراجع الآلي بالكامل؛ لا تغلق الصفحة، وحاول استعادة آخر نسخة سليمة.',
      );
    }
    throw error instanceof Error ? error : new Error('فشلت الاستعادة دون تغيير البيانات السابقة.');
  }
}
