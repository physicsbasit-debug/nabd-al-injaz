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
import { SHORT_TEST_KEY, isReviewRecord } from './short-test-model';
import { ASSESSMENT_KEY, isAssessmentRecord } from './assessment-tracking';
import { createAssessmentArchive, decodeAssessmentArchive, listAssessmentFiles, replaceAssessmentFiles } from './assessment-files';

const FORMAT = 'nabd-al-injaz-full-backup';
const VERSION = 1;
const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
const MAX_PLANS_BACKUP_BYTES = 120 * 1024 * 1024;
const APP_STORAGE_KEYS = [
  STORAGE_KEY,
  SCHEDULE_STORAGE_KEY,
  COVER_DRAFT_KEY,
  TECHNICAL_FOLLOWUP_STORAGE_KEY,
  SHORT_TEST_KEY,
  ASSESSMENT_KEY,
];
type AppBackup = {
  format: string;
  version: number;
  createdAt: string;
  localData: Record<string, string>;
  plansAndEvidence: PlansBackupArchive;
  assessmentFiles: Awaited<ReturnType<typeof createAssessmentArchive>>;
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
  const data = value as Record<string, string>;
  if (data[STORAGE_KEY] !== undefined) {
    const tasks = parseJson(data[STORAGE_KEY], 'المهام');
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
  if (data[SCHEDULE_STORAGE_KEY] !== undefined) {
    const schedule = parseJson(data[SCHEDULE_STORAGE_KEY], 'الجداول');
    if (
      !isRecord(schedule) ||
      !Array.isArray(schedule.teachers) ||
      !Array.isArray(schedule.lessons)
    )
      throw new Error('بيانات جدول المعلمين في ملف النسخة غير صالحة.');
    const teachers = schedule.teachers;
    const teacherNames = new Set(
      teachers.filter((teacher): teacher is string => typeof teacher === 'string'),
    );
    const lessons = schedule.lessons;
    const verifiedDays = schedule.verifiedDays;
    if (
      teacherNames.size !== teachers.length ||
      lessons.some(
        (lesson) =>
          !isRecord(lesson) ||
          typeof lesson.id !== 'string' ||
          typeof lesson.teacher !== 'string' ||
          !teacherNames.has(lesson.teacher) ||
          typeof lesson.day !== 'string' ||
          !validDay(lesson.day) ||
          typeof lesson.period !== 'number' ||
          !validPeriod(lesson.period) ||
          typeof lesson.description !== 'string',
      ) ||
      (verifiedDays !== undefined &&
        (!Array.isArray(verifiedDays) ||
          verifiedDays.some(
            (coverage) =>
              !isRecord(coverage) ||
              typeof coverage.teacher !== 'string' ||
              !teacherNames.has(coverage.teacher) ||
              typeof coverage.day !== 'string' ||
              !validDay(coverage.day),
          )))
    )
      throw new Error('بيانات جدول المعلمين في ملف النسخة غير صالحة.');
  }
  if (data[COVER_DRAFT_KEY] !== undefined) {
    const cover = parseJson(data[COVER_DRAFT_KEY], 'الاحتياط');
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
  if (data[ASSESSMENT_KEY] !== undefined) {
    const assessments = parseJson(data[ASSESSMENT_KEY], 'متابعة الاختبارات');
    if (!Array.isArray(assessments) || !assessments.every(isAssessmentRecord) || new Set(assessments.map((item) => item.id)).size !== assessments.length) throw new Error('بيانات متابعة الاختبارات في النسخة غير صالحة.');
  }
  if (data[SHORT_TEST_KEY] !== undefined) {
    const reviews = parseJson(data[SHORT_TEST_KEY], 'مراجعة الاختبارات');
    if (!Array.isArray(reviews) || !reviews.every(isReviewRecord)) throw new Error('بيانات مراجعة الاختبارات في ملف النسخة غير صالحة.');
  }
  if (data[TECHNICAL_FOLLOWUP_STORAGE_KEY] !== undefined) {
    const topics = parseJson(data[TECHNICAL_FOLLOWUP_STORAGE_KEY], 'المتابعة الفنية');
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
  const savedFiles = await listAssessmentFiles();
  if (savedFiles.length > 1000 || savedFiles.reduce((sum, file) => sum + 4 * Math.ceil(file.size / 3), 0) > MAX_BACKUP_BYTES) throw new Error('ملفات الاختبارات تتجاوز الحد المدعوم للنسخ.');
  const assessmentRecords: unknown = JSON.parse(localData[ASSESSMENT_KEY] ?? '[]');
  if (!Array.isArray(assessmentRecords) || savedFiles.some(file => !assessmentRecords.some(record => isAssessmentRecord(record) && record.id === file.recordId))) throw new Error('يوجد ملف اختبار غير مرتبط بسجل؛ لم تُنشأ النسخة.');
  const archive: AppBackup = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    localData,
    plansAndEvidence: await createPlansBackupArchive(plans),
    assessmentFiles: await createAssessmentArchive(savedFiles),
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

  const hasAssessmentFiles = Object.hasOwn(parsed, 'assessmentFiles');
  if (!hasAssessmentFiles && Object.hasOwn(parsed.localData, ASSESSMENT_KEY)) throw new Error('نسخة متابعة الاختبارات غير مكتملة؛ لم تُستعد البيانات.');
  const nextAssessmentFiles = hasAssessmentFiles ? decodeAssessmentArchive(parsed.assessmentFiles) : null;
  if (nextAssessmentFiles) {
    const records: unknown = JSON.parse(parsed.localData[ASSESSMENT_KEY] ?? '[]');
    if (!Array.isArray(records) || nextAssessmentFiles.some(file => !records.some(record => isAssessmentRecord(record) && record.id === file.recordId))) throw new Error('تحتوي النسخة ملفات اختبار غير مرتبطة بسجلاتها.');
  }
  const previous: Record<string, string | null> = Object.fromEntries(
    [PLAN_STORAGE_KEY, ...APP_STORAGE_KEYS].map((key) => [key, localStorage.getItem(key)]),
  );
  const previousEvidence: Evidence[] = await allEvidence();
  const previousAssessmentFiles = nextAssessmentFiles ? await listAssessmentFiles() : null;
  const nextData = parsed.localData;
  try {
    for (const key of APP_STORAGE_KEYS) {
      if (key === ASSESSMENT_KEY && !hasAssessmentFiles && !Object.hasOwn(nextData, key)) continue;
      if (Object.hasOwn(nextData, key)) localStorage.setItem(key, nextData[key]);
      else localStorage.removeItem(key);
    }
    const plansFile = new File([JSON.stringify(parsed.plansAndEvidence)], 'plans-evidence.json', {
      type: 'application/json',
    });
    const plans = await restorePlansBackup(plansFile);
    if (nextAssessmentFiles) await replaceAssessmentFiles(nextAssessmentFiles);
    const tasks = readTasks();
    return { tasks, plans };
  } catch (error) {
    try {
      for (const [key, value] of Object.entries(previous)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      await replaceAllEvidence(previousEvidence);
      if (previousAssessmentFiles) await replaceAssessmentFiles(previousAssessmentFiles);
    } catch {
      throw new Error(
        'فشلت الاستعادة وتعذّر التراجع الآلي بالكامل؛ لا تغلق الصفحة، وحاول استعادة آخر نسخة سليمة.',
      );
    }
    throw error instanceof Error ? error : new Error('فشلت الاستعادة دون تغيير البيانات السابقة.');
  }
}
