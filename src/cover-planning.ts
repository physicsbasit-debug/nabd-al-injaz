import { DAYS, absenceSlots, isDayVerified, verifiedFreeTeachers, type Day, type Lesson, type Schedule } from './schedule-model';

export const COVER_DRAFT_KEY = 'nabd-al-injaz:cover-drafts:v1';
export type CoverAssignment = { id: string; date: string; lessonId: string; absentTeacher: string; substitute: string };
export type CoverDay = { absent: string[]; assignments: CoverAssignment[] };
export type CoverStore = { version: 1; days: Record<string, CoverDay> };
export const EMPTY_COVER_STORE: CoverStore = { version: 1, days: {} };
export function weekdayForDate(date: string): Day | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const weekday = d.getUTCDay();
  return weekday >= 0 && weekday <= 4 ? DAYS[weekday] : null;
}
export function readCoverStore(): CoverStore {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(COVER_DRAFT_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_COVER_STORE;
    const value = raw as Record<string, unknown>;
    if (value.version !== 1 || !value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return EMPTY_COVER_STORE;
    const days: Record<string, CoverDay> = {};
    for (const [date, record] of Object.entries(value.days)) {
      if (!weekdayForDate(date) || !record || typeof record !== 'object' || Array.isArray(record)) continue;
      const r = record as Record<string, unknown>;
      if (!Array.isArray(r.absent) || !Array.isArray(r.assignments)) continue;
      const absent = [...new Set(r.absent.filter((n): n is string => typeof n === 'string' && !!n.trim()))];
      const assignments: CoverAssignment[] = [];
      for (const a of r.assignments) {
        if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
        const c = a as Record<string, unknown>;
        if (typeof c.id === 'string' && typeof c.lessonId === 'string' && typeof c.absentTeacher === 'string' && typeof c.substitute === 'string' && c.date === date)
          assignments.push({ id: c.id, date, lessonId: c.lessonId, absentTeacher: c.absentTeacher, substitute: c.substitute });
      }
      days[date] = { absent, assignments };
    }
    return { version: 1, days };
  } catch { return EMPTY_COVER_STORE; }
}
export const getCoverDay = (store: CoverStore, date: string): CoverDay => store.days[date] ?? { absent: [], assignments: [] };
export function setCoverAbsences(store: CoverStore, date: string, absent: string[], schedule: Schedule): CoverStore {
  if (!weekdayForDate(date)) throw new Error('اختر تاريخًا دراسيًا صالحًا من الأحد إلى الخميس.');
  if (absent.some((name) => !schedule.teachers.includes(name))) throw new Error('أحد أسماء الغياب غير مسجل.');
  return { ...store, days: { ...store.days, [date]: { ...getCoverDay(store, date), absent: [...new Set(absent)] } } };
}
function getLesson(schedule: Schedule, date: string, lessonId: string): Lesson | null {
  const day = weekdayForDate(date);
  return schedule.lessons.find((l) => l.id === lessonId && l.day === day) ?? null;
}
export function validateAssignment(schedule: Schedule, store: CoverStore, assignment: CoverAssignment): string | null {
  const day = weekdayForDate(assignment.date);
  if (!day) return 'التاريخ غير صالح';
  const record = getCoverDay(store, assignment.date);
  const lesson = getLesson(schedule, assignment.date, assignment.lessonId);
  if (!lesson || lesson.teacher !== assignment.absentTeacher) return 'الحصة الأصلية تغيرت أو حُذفت';
  if (!record.absent.includes(lesson.teacher)) return 'المعلم الأصلي لم يعد مسجلًا غائبًا';
  if (!isDayVerified(schedule, lesson.teacher, day)) return 'اكتمال جدول المعلم الغائب غير مؤكد';
  if (!isDayVerified(schedule, assignment.substitute, day)) return 'اكتمال جدول البديل غير مؤكد';
  if (!schedule.teachers.includes(assignment.substitute) || record.absent.includes(assignment.substitute)) return 'البديل غير صالح أو غائب';
  if (schedule.lessons.some((l) => l.teacher === assignment.substitute && l.day === day && l.period === lesson.period)) return 'البديل مشغول بحصة أصلية';
  if (record.assignments.some((a) => a !== assignment && a.lessonId === assignment.lessonId)) return 'تغطية مكررة للحصة';
  if (record.assignments.some((a) => a !== assignment && a.substitute === assignment.substitute && getLesson(schedule, assignment.date, a.lessonId)?.period === lesson.period)) return 'البديل مكلف مرتين في الحصة نفسها';
  return null;
}
export function draftCandidates(schedule: Schedule, store: CoverStore, date: string, lessonId: string): string[] {
  const day = weekdayForDate(date);
  const lesson = getLesson(schedule, date, lessonId);
  if (!day || !lesson) return [];
  const record = getCoverDay(store, date);
  if (!record.absent.includes(lesson.teacher) || !isDayVerified(schedule, lesson.teacher, day)) return [];
  const occupied = new Set(record.assignments.filter((a) => a.lessonId !== lessonId && getLesson(schedule, date, a.lessonId)?.period === lesson.period).map((a) => a.substitute));
  const scores = (name: string) => Object.values(store.days).flatMap((d) => d.assignments).filter((a) => a.substitute === name && validateAssignment(schedule, store, a) === null).length;
  return verifiedFreeTeachers(schedule, day, lesson.period)
    .filter((name) => !record.absent.includes(name) && !occupied.has(name))
    .sort((a, b) => scores(a) - scores(b) || a.localeCompare(b, 'ar'));
}
export function addCoverAssignment(schedule: Schedule, store: CoverStore, date: string, lessonId: string, substitute: string): CoverStore {
  const day = weekdayForDate(date);
  if (!day) throw new Error('تاريخ غير صالح.');
  const lesson = getLesson(schedule, date, lessonId);
  if (!lesson) throw new Error('الحصة الأصلية غير موجودة.');
  const record = getCoverDay(store, date);
  if (record.assignments.some((a) => a.lessonId === lessonId)) throw new Error('الحصة مغطاة بالفعل.');
  if (!draftCandidates(schedule, store, date, lessonId).includes(substitute)) throw new Error('البديل غير مؤهل أو مشغول أو جدول أحد المعلمين غير مكتمل.');
  const assignment: CoverAssignment = { id: crypto.randomUUID(), date, lessonId, absentTeacher: lesson.teacher, substitute };
  const next: CoverStore = { ...store, days: { ...store.days, [date]: { ...record, assignments: [...record.assignments, assignment] } } };
  const error = validateAssignment(schedule, next, assignment);
  if (error) throw new Error(error);
  return next;
}
export function removeCoverAssignment(store: CoverStore, date: string, id: string): CoverStore {
  const record = getCoverDay(store, date);
  return { ...store, days: { ...store.days, [date]: { ...record, assignments: record.assignments.filter((a) => a.id !== id) } } };
}
export function draftSlots(schedule: Schedule, store: CoverStore, date: string): Lesson[] {
  const day = weekdayForDate(date);
  if (!day) return [];
  return absenceSlots(schedule, day, getCoverDay(store, date).absent);
}
