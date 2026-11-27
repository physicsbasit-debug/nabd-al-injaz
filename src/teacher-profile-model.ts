import { normalizeTeacher } from './schedule-model';
import { daysBetween, semesterOf } from './duty-routine';
import type { SupervisoryVisit } from './supervisory-visits-model';
import type { ProfessionalProgram } from './professional-development-model';
import type { TechnicalTopic } from './technical-followup-model';
import type { AssessmentRecord } from './assessment-tracking';
import type { ReviewRecord } from './short-test-model';
import type { CoverStore } from './cover-planning';
import type { Plan } from './plan-model';

export const TEACHER_PROFILES_KEY = 'nabd-al-injaz:teacher-profiles:v1';

/** متابعات شهرية لكل معلم؛ كل فحص يُحتسب إنجازًا لواجبه في الروتين. */
export const CHECK_KINDS = [
  { kind: 'سجلات', short: 'السجلات', label: 'فحص السجلات والملفات', duty: 30 },
  { kind: 'درجات', short: 'الدرجات', label: 'إدخال الدرجات في البوابة', duty: 24 },
  { kind: 'تحضير', short: 'التحضير', label: 'متابعة التحضير والخطط الفصلية', duty: 5 },
] as const;
export type CheckKind = (typeof CHECK_KINDS)[number]['kind'];
export type TeacherCheck = { id: string; teacher: string; kind: CheckKind; date: string; ok: boolean; note: string };
export type TeacherProfileStore = { version: 1; notes: Record<string, string>; checks: TeacherCheck[] };

export const emptyTeacherStore = (): TeacherProfileStore => ({ version: 1, notes: {}, checks: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

export function isTeacherCheck(v: unknown): v is TeacherCheck {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    !!v.id &&
    typeof v.teacher === 'string' &&
    !!v.teacher.trim() &&
    CHECK_KINDS.some((k) => k.kind === v.kind) &&
    validDay(v.date) &&
    typeof v.ok === 'boolean' &&
    typeof v.note === 'string'
  );
}

export function isTeacherStore(v: unknown): v is TeacherProfileStore {
  return (
    isRecord(v) &&
    v.version === 1 &&
    isRecord(v.notes) &&
    Object.values(v.notes).every((n) => typeof n === 'string') &&
    Array.isArray(v.checks) &&
    v.checks.every(isTeacherCheck)
  );
}

export function readTeacherStore(): TeacherProfileStore {
  const raw = localStorage.getItem(TEACHER_PROFILES_KEY);
  if (!raw) return emptyTeacherStore();
  const data: unknown = JSON.parse(raw);
  if (!isTeacherStore(data)) throw new Error('تعذر قراءة ملفات المعلمين؛ لم تُغيّر البيانات.');
  return data;
}

export function writeTeacherStore(store: TeacherProfileStore) {
  localStorage.setItem(TEACHER_PROFILES_KEY, JSON.stringify(store));
}

/** يسجل فحص هذا الشهر للمعلم أو يحدّثه إن وُجد، فيبقى فحص واحد لكل نوع في الشهر. */
export function recordCheck(
  store: TeacherProfileStore,
  teacher: string,
  kind: CheckKind,
  ok: boolean,
  note: string,
  today: string,
  id: string = crypto.randomUUID(),
): TeacherProfileStore {
  const name = normalizeTeacher(teacher);
  const month = today.slice(0, 7);
  const existing = store.checks.find((c) => c.teacher === name && c.kind === kind && c.date.slice(0, 7) === month);
  const check: TeacherCheck = { id: existing?.id ?? id, teacher: name, kind, date: today, ok, note: note.trim().slice(0, 300) };
  return { ...store, checks: [...store.checks.filter((c) => c !== existing), check] };
}

export function removeCheck(store: TeacherProfileStore, id: string): TeacherProfileStore {
  return { ...store, checks: store.checks.filter((c) => c.id !== id) };
}

export function setTeacherNote(store: TeacherProfileStore, teacher: string, note: string): TeacherProfileStore {
  const notes = { ...store.notes };
  const clean = note.slice(0, 2000);
  if (clean.trim()) notes[normalizeTeacher(teacher)] = clean;
  else delete notes[normalizeTeacher(teacher)];
  return { ...store, notes };
}

export type ProfileInput = {
  today: string;
  scheduleTeachers: string[];
  visits: SupervisoryVisit[];
  programs: ProfessionalProgram[];
  topics: TechnicalTopic[];
  assessments: AssessmentRecord[];
  reviews: ReviewRecord[];
  cover?: CoverStore;
  plans: Plan[];
  store: TeacherProfileStore;
};

export type TeacherProfile = {
  name: string;
  inSchedule: boolean;
  visits: { done: SupervisoryVisit[]; planned: SupervisoryVisit[]; overduePlanned: number; semesterCount: number; last: string | null; daysSince: number | null };
  development: { attended: string[]; absent: string[] };
  curriculum: { planned: number; taught: number; behind: TechnicalTopic[] };
  reviews: { total: number; done: number; needsEdit: number; pending: number };
  assessments: { total: number; pendingSubmission: number; pendingAnalysis: number };
  cover: { given: number; absences: number };
  mutualVisits: number;
  checks: Record<CheckKind, TeacherCheck | null>;
  history: TeacherCheck[];
  note: string;
  alerts: string[];
};

const n = normalizeTeacher;

export function teacherNames(input: Omit<ProfileInput, 'today' | 'store'> & { store?: TeacherProfileStore }): string[] {
  const names = new Set<string>();
  const add = (v: string | undefined) => {
    const name = v ? n(v) : '';
    if (name) names.add(name);
  };
  input.scheduleTeachers.forEach(add);
  input.visits.forEach((v) => add(v.teacher));
  input.programs.forEach((p) => Object.keys(p.attendance).forEach(add));
  input.topics.forEach((t) => add(t.teacher));
  input.assessments.forEach((a) => add(a.teacher));
  input.reviews.forEach((r) => add(r.teacher));
  input.store?.checks.forEach((c) => add(c.teacher));
  return [...names].sort((a, b) => a.localeCompare(b, 'ar'));
}

export function buildTeacherProfile(name: string, input: ProfileInput): TeacherProfile {
  const { today } = input;
  const semester = semesterOf(today);
  const inSemester = (day: string) => day >= semester.start && day <= semester.end;
  const mine = <T extends { teacher: string }>(rows: T[]) => rows.filter((r) => n(r.teacher) === name);

  const visits = mine(input.visits);
  const done = visits.filter((v) => v.status === 'completed' && v.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const planned = visits.filter((v) => v.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const overduePlanned = planned.filter((v) => v.date && v.date < today).length;
  const last = done[0]?.date ?? null;

  const attended: string[] = [];
  const absent: string[] = [];
  for (const p of input.programs) {
    if (p.completed !== true || p.date > today) continue;
    const status = Object.entries(p.attendance).find(([who]) => n(who) === name)?.[1];
    if (status === 'حاضر') attended.push(p.title);
    if (status === 'غائب') absent.push(p.title);
  }

  const topics = mine(input.topics);
  const behind = topics.filter((t) => t.taughtLessons < t.plannedLessons && t.targetDate && t.targetDate < today);
  const reviews = mine(input.reviews);
  const assessments = mine(input.assessments);

  let given = 0;
  let absences = 0;
  for (const [day, record] of Object.entries(input.cover?.days ?? {})) {
    if (!inSemester(day) || day > today) continue;
    if (record.absent.some((a) => n(a) === name)) absences += 1;
    given += record.assignments.filter((a) => n(a.substitute) === name).length;
  }

  const mutualVisits = input.plans
    .flatMap((p) => p.activities)
    .filter((a) => a.destination === 'الزيارات المتبادلة' && a.progress === 'completed' && n(a.assignee) === name).length;

  const history = input.store.checks.filter((c) => c.teacher === name).sort((a, b) => b.date.localeCompare(a.date));
  const month = today.slice(0, 7);
  const checks = Object.fromEntries(
    CHECK_KINDS.map(({ kind }) => [kind, history.find((c) => c.kind === kind && c.date.slice(0, 7) === month) ?? null]),
  ) as Record<CheckKind, TeacherCheck | null>;

  const semesterCount = done.filter((v) => inSemester(v.date)).length;
  const daysSince = last ? daysBetween(last, today) : null;
  const alerts: string[] = [];
  if (!semesterCount) alerts.push(`لم يُزر في ${semester.label}`);
  else if (daysSince !== null && daysSince > 45) alerts.push(`آخر زيارة قبل ${daysSince} يومًا`);
  if (overduePlanned) alerts.push(overduePlanned === 1 ? 'زيارة مخططة فات موعدها' : `${overduePlanned} زيارات مخططة فات موعدها`);
  if (absent.length >= 2) alerts.push(`غاب عن ${absent.length} برامج إنماء`);
  if (behind.length) alerts.push(`متأخر في ${behind.length} ${behind.length === 1 ? 'موضوع' : 'موضوعات'} من المنهج`);
  const needsEdit = reviews.filter((r) => r.status === 'يحتاج تعديلًا').length;
  if (needsEdit) alerts.push(needsEdit === 1 ? 'اختبار يحتاج تعديلًا' : `${needsEdit} اختبارات تحتاج تعديلًا`);
  for (const { kind, label } of CHECK_KINDS) if (checks[kind] && !checks[kind]!.ok) alerts.push(`${label}: يحتاج استكمالًا`);

  return {
    name,
    inSchedule: input.scheduleTeachers.some((t) => n(t) === name),
    visits: { done, planned, overduePlanned, semesterCount, last, daysSince },
    development: { attended, absent },
    curriculum: {
      planned: topics.reduce((s, t) => s + t.plannedLessons, 0),
      taught: topics.reduce((s, t) => s + Math.min(t.taughtLessons, t.plannedLessons), 0),
      behind,
    },
    reviews: {
      total: reviews.length,
      done: reviews.filter((r) => r.status === 'تمت المراجعة').length,
      needsEdit,
      pending: reviews.filter((r) => r.status === 'بانتظار المراجعة').length,
    },
    assessments: {
      total: assessments.length,
      pendingSubmission: assessments.filter((a) => !a.submitted).length,
      pendingAnalysis: assessments.filter((a) => !a.analyzed).length,
    },
    cover: { given, absences },
    mutualVisits,
    checks,
    history,
    note: input.store.notes[name] ?? '',
    alerts,
  };
}

export function buildTeacherProfiles(input: ProfileInput): TeacherProfile[] {
  return teacherNames(input)
    .map((name) => buildTeacherProfile(name, input))
    .sort((a, b) => b.alerts.length - a.alerts.length || a.name.localeCompare(b.name, 'ar'));
}
