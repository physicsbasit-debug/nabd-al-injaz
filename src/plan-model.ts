export const PLAN_STORAGE_KEY = 'nabd-al-injaz:plans:v1';
export const PLAN_KINDS = [
  'خطة المادة',
  'خطة الزيارات الإشرافية',
  'خطة الزيارات المتبادلة',
  'خطة الإنماء المهني',
  'خطة الاجتماعات الدورية',
  'خطة رفع المستوى التحصيلي',
  'خطة أخرى',
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export type Progress = 'not_started' | 'in_progress' | 'completed';
export type PlanActivity = {
  id: string;
  title: string;
  details: string;
  assignee: string;
  dueDate: string;
  progress: Progress;
  completedAt: string | null;
  createdAt: string;
};
export type Plan = {
  id: string;
  title: string;
  kind: PlanKind;
  owner: string;
  periodStart: string;
  periodEnd: string;
  archived: boolean;
  createdAt: string;
  activities: PlanActivity[];
};
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
function normalizeActivity(v: unknown): PlanActivity | null {
  if (!isRecord(v) || !str(v.id) || !str(v.title).trim()) return null;
  const progress: Progress =
    v.progress === 'completed' || v.progress === 'in_progress' ? v.progress : 'not_started';
  return {
    id: str(v.id),
    title: str(v.title),
    details: str(v.details),
    assignee: str(v.assignee),
    dueDate: str(v.dueDate),
    progress,
    completedAt: progress === 'completed' ? str(v.completedAt) || null : null,
    createdAt: str(v.createdAt),
  };
}
function normalizePlan(v: unknown): Plan | null {
  if (!isRecord(v) || !str(v.id) || !str(v.title).trim()) return null;
  return {
    id: str(v.id),
    title: str(v.title),
    kind: PLAN_KINDS.includes(v.kind as PlanKind) ? (v.kind as PlanKind) : 'خطة أخرى',
    owner: str(v.owner),
    periodStart: str(v.periodStart),
    periodEnd: str(v.periodEnd),
    archived: v.archived === true,
    createdAt: str(v.createdAt),
    activities: Array.isArray(v.activities)
      ? v.activities.map(normalizeActivity).filter((a): a is PlanActivity => a !== null)
      : [],
  };
}
export function readPlans(): Plan[] {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.map(normalizePlan).filter((p): p is Plan => p !== null) : [];
  } catch {
    return [];
  }
}
export function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function planStats(plan: Plan, today: string) {
  const total = plan.activities.length;
  const completed = plan.activities.filter((a) => a.progress === 'completed').length;
  const inProgress = plan.activities.filter((a) => a.progress === 'in_progress').length;
  const overdue = plan.activities.filter(
    (a) => a.progress !== 'completed' && validDate(a.dueDate) && a.dueDate < today,
  ).length;
  return {
    total,
    completed,
    inProgress,
    overdue,
    percent: total === 0 ? null : Math.round((100 * completed) / total),
  };
}
export function changeProgress(a: PlanActivity, progress: Progress, now: string): PlanActivity {
  return { ...a, progress, completedAt: progress === 'completed' ? a.completedAt || now : null };
}
export function createPlan(
  data: Pick<Plan, 'title' | 'kind' | 'owner' | 'periodStart' | 'periodEnd'>,
): Plan {
  return {
    ...data,
    title: data.title.trim(),
    id: crypto.randomUUID(),
    archived: false,
    createdAt: new Date().toISOString(),
    activities: [],
  };
}
export function createActivity(
  data: Pick<PlanActivity, 'title' | 'details' | 'assignee' | 'dueDate'>,
): PlanActivity {
  return {
    ...data,
    title: data.title.trim(),
    id: crypto.randomUUID(),
    progress: 'not_started',
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}
