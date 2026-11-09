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
export type PlanProgress = 'not_started' | 'in_progress' | 'completed';

export interface PlanActivity {
  id: string;
  title: string;
  details: string;
  assignee: string;
  dueDate: string;
  progress: PlanProgress;
  completedAt: string | null;
  createdAt: string;
}

export interface Plan {
  id: string;
  title: string;
  kind: PlanKind;
  owner: string;
  periodStart: string;
  periodEnd: string;
  archived: boolean;
  createdAt: string;
  activities: PlanActivity[];
}

const validProgress: PlanProgress[] = ['not_started', 'in_progress', 'completed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeActivity(value: unknown): PlanActivity | null {
  if (!isRecord(value) || !asString(value.id) || !asString(value.title).trim()) return null;
  const progress: PlanProgress = validProgress.includes(value.progress as PlanProgress)
    ? (value.progress as PlanProgress)
    : 'not_started';
  return {
    id: asString(value.id),
    title: asString(value.title),
    details: asString(value.details),
    assignee: asString(value.assignee),
    dueDate: asString(value.dueDate),
    progress,
    completedAt: progress === 'completed' ? asString(value.completedAt) || null : null,
    createdAt: asString(value.createdAt),
  };
}

function normalizePlan(value: unknown): Plan | null {
  if (!isRecord(value) || !asString(value.id) || !asString(value.title).trim()) return null;
  const kind = PLAN_KINDS.includes(value.kind as PlanKind) ? (value.kind as PlanKind) : 'خطة أخرى';
  const activities = Array.isArray(value.activities)
    ? value.activities.map(normalizeActivity).filter((item): item is PlanActivity => item !== null)
    : [];
  return {
    id: asString(value.id),
    title: asString(value.title),
    kind,
    owner: asString(value.owner),
    periodStart: asString(value.periodStart),
    periodEnd: asString(value.periodEnd),
    archived: value.archived === true,
    createdAt: asString(value.createdAt),
    activities,
  };
}

export function readPlans(): Plan[] {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePlan).filter((plan): plan is Plan => plan !== null);
  } catch {
    return [];
  }
}

export function validPlanDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function planStats(plan: Plan, today: string) {
  const total = plan.activities.length;
  const completed = plan.activities.filter((activity) => activity.progress === 'completed').length;
  const inProgress = plan.activities.filter(
    (activity) => activity.progress === 'in_progress',
  ).length;
  const overdue = plan.activities.filter(
    (activity) =>
      activity.progress !== 'completed' &&
      validPlanDate(activity.dueDate) &&
      activity.dueDate < today,
  ).length;
  return {
    total,
    completed,
    inProgress,
    overdue,
    percent: total === 0 ? null : Math.round((completed / total) * 100),
  };
}

export function changeActivityProgress(
  activity: PlanActivity,
  progress: PlanProgress,
  now: string,
): PlanActivity {
  return {
    ...activity,
    progress,
    completedAt: progress === 'completed' ? activity.completedAt || now : null,
  };
}

export function newPlan(
  input: Pick<Plan, 'title' | 'kind' | 'owner' | 'periodStart' | 'periodEnd'>,
): Plan {
  return {
    ...input,
    title: input.title.trim(),
    id: crypto.randomUUID(),
    archived: false,
    createdAt: new Date().toISOString(),
    activities: [],
  };
}

export function newActivity(
  input: Pick<PlanActivity, 'title' | 'details' | 'assignee' | 'dueDate'>,
): PlanActivity {
  return {
    ...input,
    title: input.title.trim(),
    id: crypto.randomUUID(),
    progress: 'not_started',
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}
