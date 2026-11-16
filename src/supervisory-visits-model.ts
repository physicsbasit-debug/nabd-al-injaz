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
  period: string;
  lesson: string;
  strengths: string;
  improvements: string;
  recommendations: string;
  followUp: string;
  planId: string;
  activityId: string;
  createdAt: string;
};

export function isSupervisoryVisit(value: unknown): value is SupervisoryVisit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof item[key] === 'string' && item[key].length <= max;
  if (!['id', 'teacher', 'date', 'status', 'subject', 'grade', 'period', 'lesson', 'strengths', 'improvements', 'recommendations', 'followUp', 'planId', 'activityId', 'createdAt'].every((key) => text(key, ['strengths', 'improvements', 'recommendations', 'followUp'].includes(key) ? 4000 : 300))) return false;
  return Boolean((item.id as string).trim()) && Boolean((item.teacher as string).trim()) &&
    validDate(item.date as string) && ['planned', 'completed'].includes(item.status as string) &&
    ['', ...VISIT_SUBJECTS].includes(item.subject as typeof VISIT_SUBJECTS[number] | '') &&
    ['', '8', '9', '10'].includes(item.grade as string) &&
    ['', '1', '2', '3', '4', '5', '6', '7'].includes(item.period as string) &&
    Boolean(item.planId) === Boolean(item.activityId) &&
    !Number.isNaN(Date.parse(item.createdAt as string));
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
