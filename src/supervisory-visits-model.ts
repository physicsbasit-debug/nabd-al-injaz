import { validDate } from './plan-model';
import { localDateKey } from './dashboard-metrics';

export const SUPERVISORY_VISITS_KEY = 'nabd-al-injaz:supervisory-visits:v1';
export const VISIT_SUBJECTS = ['علوم عامة', 'فيزياء', 'كيمياء', 'أحياء'] as const;
/** أساليب الإشراف (الواجبان 7 و12): كل أسلوب غير الزيارة الصفية يُحتسب تنويعًا. */
export const VISIT_METHODS = ['زيارة صفية', 'درس تطبيقي', 'زيارة متبادلة موجهة', 'فحص الأعمال الكتابية والسجلات', 'لقاء فردي', 'قراءة موجهة'] as const;
export type VisitMethod = (typeof VISIT_METHODS)[number];
/** مؤشرات أداء مختصرة لتوسيم الملاحظة دون درجات (الواجب 15). */
export const PERFORMANCE_INDICATORS = [
  'التخطيط للدرس',
  'استراتيجيات التدريس',
  'إدارة البيئة التعليمية',
  'توظيف مصادر التعلم والتقنية',
  'التقويم والتغذية الراجعة',
  'مراعاة الفروق الفردية',
  'التواصل والتفاعل داخل الحصة',
] as const;
export type PerformanceIndicator = (typeof PERFORMANCE_INDICATORS)[number];
export type SupervisoryVisit = {
  id: string;
  teacher: string;
  date: string;
  status: 'planned' | 'completed';
  subject: string;
  grade: string;
  section?: string;
  period: string;
  lesson: string;
  strengths: string;
  improvements: string;
  recommendations: string;
  followUp: string;
  documentation?: string;
  method?: VisitMethod;
  strengthIndicators?: PerformanceIndicator[];
  priorityIndicators?: PerformanceIndicator[];
  planId: string;
  activityId: string;
  createdAt: string;
};
export type SupervisoryVisitForm = Omit<SupervisoryVisit, 'id' | 'createdAt'>;
export function emptySupervisoryVisitForm(): SupervisoryVisitForm {
  return { teacher: '', date: '', status: 'planned', subject: '', grade: '', section: '', period: '', lesson: '', strengths: '', improvements: '', recommendations: '', followUp: '', documentation: '', planId: '', activityId: '' };
}
export function hasUnsavedVisitChanges(form: SupervisoryVisitForm, editing: SupervisoryVisit | null): boolean {
  const original = editing ?? emptySupervisoryVisitForm();
  const norm = (value: unknown) => (Array.isArray(value) ? (value.length ? JSON.stringify(value) : '') : (value ?? ''));
  const keys = [...Object.keys(emptySupervisoryVisitForm()), 'method', 'strengthIndicators', 'priorityIndicators'] as Array<keyof SupervisoryVisitForm>;
  return keys.some(key => norm(form[key]) !== norm(original[key]));
}

export function isSupervisoryVisit(value: unknown): value is SupervisoryVisit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof item[key] === 'string' && item[key].length <= max;
  if (!['id', 'teacher', 'date', 'status', 'subject', 'grade', 'period', 'lesson', 'strengths', 'improvements', 'recommendations', 'followUp', 'planId', 'activityId', 'createdAt'].every((key) => text(key, ['strengths', 'improvements', 'recommendations', 'followUp'].includes(key) ? 4000 : 300))) return false;
  if (item.section !== undefined && !text('section', 100)) return false;
  if (item.documentation !== undefined && !text('documentation', 4000)) return false;
  if (item.method !== undefined && !VISIT_METHODS.includes(item.method as VisitMethod)) return false;
  const tags = (key: string) => item[key] === undefined || (Array.isArray(item[key]) && (item[key] as unknown[]).length <= PERFORMANCE_INDICATORS.length && new Set(item[key] as unknown[]).size === (item[key] as unknown[]).length && (item[key] as unknown[]).every(tag => PERFORMANCE_INDICATORS.includes(tag as PerformanceIndicator)));
  if (!tags('strengthIndicators') || !tags('priorityIndicators')) return false;
  return Boolean((item.id as string).trim()) && Boolean((item.teacher as string).trim()) &&
    (validDate(item.date as string) || (item.status === 'planned' && item.date === '')) && ['planned', 'completed'].includes(item.status as string) &&
    ['', ...VISIT_SUBJECTS].includes(item.subject as typeof VISIT_SUBJECTS[number] | '') &&
    ['', '8', '9', '10'].includes(item.grade as string) &&
    ['', '1', '2', '3', '4', '5', '6', '7'].includes(item.period as string) &&
    Boolean(item.planId) === Boolean(item.activityId) &&
    !Number.isNaN(Date.parse(item.createdAt as string));
}

export function isFutureCompletedVisit(visit: Pick<SupervisoryVisit, 'status' | 'date'>, today: string): boolean {
  return visit.status === 'completed' && validDate(visit.date) && visit.date > today;
}

export function summarizeTeacherVisits(teachers: string[], records: SupervisoryVisit[], today = localDateKey(new Date())) {
  const tidyName = (name: string) => name.trim().replace(/\s+/g, ' ');
  const names = Array.from(new Set([...teachers, ...records.map(record => record.teacher)].map(tidyName).filter(Boolean)));
  return names.map(teacher => {
    const related = records.filter(record => tidyName(record.teacher) === teacher);
    const completed = related.filter(record => record.status === 'completed' && !isFutureCompletedVisit(record, today));
    const lastVisit = completed.reduce<string | null>((latest, record) => !latest || record.date > latest ? record.date : latest, null);
    const futureCount = related.filter(record => isFutureCompletedVisit(record, today)).length;
    return { teacher, completedCount: completed.length, lastVisit, futureCount };
  });
}

export function readSupervisoryVisits(): SupervisoryVisit[] {
  const raw = localStorage.getItem(SUPERVISORY_VISITS_KEY);
  if (raw === null) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('تعذر قراءة سجل الزيارات؛ لم تتغير بياناتك.'); }
  if (!Array.isArray(data) || !data.every(isSupervisoryVisit) || new Set(data.map((item) => item.id)).size !== data.length)
    throw new Error('بيانات الزيارات المحفوظة غير صالحة؛ لم تتغير بياناتك.');
  return data;
}

/** يحذف الحقول الاختيارية الفارغة حتى تبقى السجلات القديمة والجديدة بالشكل نفسه. */
export function compactVisit(record: SupervisoryVisit): SupervisoryVisit {
  const out: SupervisoryVisit = { ...record };
  if (!out.method) delete out.method;
  if (!out.strengthIndicators?.length) delete out.strengthIndicators;
  if (!out.priorityIndicators?.length) delete out.priorityIndicators;
  return out;
}
