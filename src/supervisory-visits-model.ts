import { validDate } from './plan-model';

export const SUPERVISORY_VISITS_KEY = 'nabd-al-injaz:supervisory-visits:v1';
export const VISIT_SUBJECTS = ['علوم عامة', 'فيزياء', 'كيمياء', 'أحياء'] as const;
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
  return (Object.keys(emptySupervisoryVisitForm()) as Array<keyof SupervisoryVisitForm>)
    .some(key => (form[key] ?? '') !== (original[key] ?? ''));
}

export function isSupervisoryVisit(value: unknown): value is SupervisoryVisit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof item[key] === 'string' && item[key].length <= max;
  if (!['id', 'teacher', 'date', 'status', 'subject', 'grade', 'period', 'lesson', 'strengths', 'improvements', 'recommendations', 'followUp', 'planId', 'activityId', 'createdAt'].every((key) => text(key, ['strengths', 'improvements', 'recommendations', 'followUp'].includes(key) ? 4000 : 300))) return false;
  if (item.section !== undefined && !text('section', 100)) return false;
  if (item.documentation !== undefined && !text('documentation', 4000)) return false;
  return Boolean((item.id as string).trim()) && Boolean((item.teacher as string).trim()) &&
    (validDate(item.date as string) || (item.status === 'planned' && item.date === '')) && ['planned', 'completed'].includes(item.status as string) &&
    ['', ...VISIT_SUBJECTS].includes(item.subject as typeof VISIT_SUBJECTS[number] | '') &&
    ['', '8', '9', '10'].includes(item.grade as string) &&
    ['', '1', '2', '3', '4', '5', '6', '7'].includes(item.period as string) &&
    Boolean(item.planId) === Boolean(item.activityId) &&
    !Number.isNaN(Date.parse(item.createdAt as string));
}

export function summarizeTeacherVisits(teachers: string[], records: SupervisoryVisit[]) {
  const names = Array.from(new Set([...teachers, ...records.map(record => record.teacher)].map(name => name.trim()).filter(Boolean)));
  return names.map(teacher => {
    const completed = records.filter(record => record.teacher.trim() === teacher && record.status === 'completed');
    const lastVisit = completed.reduce<string | null>((latest, record) => !latest || record.date > latest ? record.date : latest, null);
    return { teacher, completedCount: completed.length, lastVisit };
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
