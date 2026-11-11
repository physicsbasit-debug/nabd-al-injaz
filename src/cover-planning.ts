import { DAYS, absenceSlots, isDayVerified, verifiedFreeTeachers, type Day, type Lesson, type Schedule } from './schedule-model';

export const COVER_DRAFT_KEY = 'nabd-al-injaz:cover-drafts:v1';
export type CoverAssignment = { id: string; date: string; lessonId: string; absentTeacher: string; substitute: string };
export type CoverDay = { absent: string[]; assignments: CoverAssignment[]; processedAt?: string };
export type CoverTeacherPolicy = { exempt: boolean; carryInBalance: number; priority: number };
export type CoverStore = { version: 1; days: Record<string, CoverDay>; teacherPolicies?: Record<string, CoverTeacherPolicy> };
export const EMPTY_COVER_STORE: CoverStore = { version: 1, days: {} };

function boundedInteger(value: unknown, max = 10000): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.floor(value)));
}
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
      days[date] = { absent, assignments, ...(typeof r.processedAt === 'string' && !Number.isNaN(Date.parse(r.processedAt)) ? { processedAt: r.processedAt } : {}) };
    }
    const teacherPolicies: Record<string, CoverTeacherPolicy> = {};
    if (value.teacherPolicies && typeof value.teacherPolicies === 'object' && !Array.isArray(value.teacherPolicies)) {
      for (const [teacher, rawPolicy] of Object.entries(value.teacherPolicies)) {
        if (!teacher.trim() || !rawPolicy || typeof rawPolicy !== 'object' || Array.isArray(rawPolicy)) continue;
        const policy = rawPolicy as Record<string, unknown>;
        teacherPolicies[teacher] = {
          exempt: policy.exempt === true,
          carryInBalance: boundedInteger(policy.carryInBalance),
          priority: boundedInteger(policy.priority, 99),
        };
      }
    }
    return Object.keys(teacherPolicies).length ? { version: 1, days, teacherPolicies } : { version: 1, days };
  } catch { return EMPTY_COVER_STORE; }
}
export const getCoverDay = (store: CoverStore, date: string): CoverDay => store.days[date] ?? { absent: [], assignments: [] };
export function processCoverDay(schedule: Schedule, store: CoverStore, date: string, processedAt = new Date().toISOString()): CoverStore {
  const record = getCoverDay(store, date);
  if (!weekdayForDate(date)) throw new Error('التاريخ غير صالح.');
  if (!record.absent.length) throw new Error('سجّل الغياب أولًا قبل حفظ معالجة اليوم.');
  const day = weekdayForDate(date)!;
  if (record.absent.some((teacher) => !isDayVerified(schedule, teacher, day))) throw new Error('لا يمكن حفظ المعالجة قبل تأكيد اكتمال جداول جميع المعلمين الغائبين.');
  if (record.assignments.some((assignment) => validateAssignment(schedule, store, assignment) !== null)) throw new Error('توجد تكليفات غير صالحة؛ صححها قبل حفظ معالجة اليوم.');
  if (record.processedAt) throw new Error('اليوم محفوظ كمعالَج بالفعل.');
  return { ...store, days: { ...store.days, [date]: { ...record, processedAt } } };
}
export function reopenCoverDay(store: CoverStore, date: string): CoverStore {
  const draft = { ...getCoverDay(store, date) };
  delete draft.processedAt;
  return { ...store, days: { ...store.days, [date]: draft } };
}
export function clearCoverDay(store: CoverStore, date: string): CoverStore {
  const days = { ...store.days };
  delete days[date];
  return { ...store, days };
}
export function getCoverDailySummary(schedule: Schedule, store: CoverStore, date: string) {
  const record = getCoverDay(store, date);
  const slots = draftSlots(schedule, store, date);
  const validAssignments = record.assignments.filter((assignment) => validateAssignment(schedule, store, assignment) === null);
  const assignedIds = new Set(validAssignments.map((assignment) => assignment.lessonId));
  const bySubstitute = new Map<string, number>();
  for (const assignment of validAssignments) bySubstitute.set(assignment.substitute, (bySubstitute.get(assignment.substitute) ?? 0) + 1);
  return { absentCount: record.absent.length, required: slots.length, assigned: assignedIds.size, uncovered: slots.filter((slot) => !assignedIds.has(slot.id)).length, invalid: record.assignments.length - validAssignments.length, bySubstitute: [...bySubstitute].sort((a, b) => a[0].localeCompare(b[0], 'ar')), processedAt: record.processedAt ?? null };
}
export function getCoverTeacherPolicy(store: CoverStore, teacher: string): CoverTeacherPolicy {
  const policy = store.teacherPolicies?.[teacher];
  return {
    exempt: policy?.exempt === true,
    carryInBalance: boundedInteger(policy?.carryInBalance),
    priority: boundedInteger(policy?.priority, 99),
  };
}
export function setCoverTeacherPolicy(store: CoverStore, teacher: string, patch: Partial<CoverTeacherPolicy>): CoverStore {
  if (!teacher.trim()) throw new Error('اسم المعلم غير صالح.');
  const current = getCoverTeacherPolicy(store, teacher);
  const next: CoverTeacherPolicy = {
    exempt: typeof patch.exempt === 'boolean' ? patch.exempt : current.exempt,
    carryInBalance: boundedInteger(patch.carryInBalance ?? current.carryInBalance),
    priority: boundedInteger(patch.priority ?? current.priority, 99),
  };
  return { ...store, teacherPolicies: { ...(store.teacherPolicies ?? {}), [teacher]: next } };
}
export function setCoverAbsences(store: CoverStore, date: string, absent: string[], schedule: Schedule): CoverStore {
  if (!weekdayForDate(date)) throw new Error('اختر تاريخًا دراسيًا صالحًا من الأحد إلى الخميس.');
  if (getCoverDay(store, date).processedAt) throw new Error('اليوم محفوظ كمعالَج؛ أعد فتحه قبل التعديل.');
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
  if (!schedule.teachers.includes(assignment.substitute) || record.absent.includes(assignment.substitute)) return 'البديل غير صالح أو غائب';
  if (getCoverTeacherPolicy(store, assignment.substitute).exempt) return 'المعلم مستثنى من تكليف الاحتياط';
  if (!isDayVerified(schedule, assignment.substitute, day)) return 'اكتمال جدول البديل غير مؤكد';
  if (schedule.lessons.some((l) => l.teacher === assignment.substitute && l.day === day && l.period === lesson.period)) return 'البديل مشغول بحصة أصلية';
  if (record.assignments.some((a) => a !== assignment && a.lessonId === assignment.lessonId)) return 'تغطية مكررة للحصة';
  if (record.assignments.some((a) => a !== assignment && a.substitute === assignment.substitute && getLesson(schedule, assignment.date, a.lessonId)?.period === lesson.period)) return 'البديل مكلف مرتين في الحصة نفسها';
  return null;
}
export function getCoverBalance(schedule: Schedule, store: CoverStore, teacher: string): number {
  const recorded = Object.values(store.days).flatMap((day) => day.assignments)
    .filter((assignment) => assignment.substitute === teacher && validateAssignment(schedule, store, assignment) === null).length;
  return getCoverTeacherPolicy(store, teacher).carryInBalance + recorded;
}
export function draftCandidates(schedule: Schedule, store: CoverStore, date: string, lessonId: string): string[] {
  const day = weekdayForDate(date);
  const lesson = getLesson(schedule, date, lessonId);
  if (!day || !lesson) return [];
  const record = getCoverDay(store, date);
  if (!record.absent.includes(lesson.teacher) || !isDayVerified(schedule, lesson.teacher, day)) return [];
  const occupied = new Set(record.assignments.filter((a) => a.lessonId !== lessonId && getLesson(schedule, date, a.lessonId)?.period === lesson.period).map((a) => a.substitute));
  const priority = (name: string) => {
    const rank = getCoverTeacherPolicy(store, name).priority;
    return rank > 0 ? rank : Number.MAX_SAFE_INTEGER;
  };
  return verifiedFreeTeachers(schedule, day, lesson.period)
    .filter((name) => !record.absent.includes(name) && !occupied.has(name) && !getCoverTeacherPolicy(store, name).exempt)
    .sort((a, b) => getCoverBalance(schedule, store, a) - getCoverBalance(schedule, store, b) || priority(a) - priority(b) || a.localeCompare(b, 'ar'));
}
export function addCoverAssignment(schedule: Schedule, store: CoverStore, date: string, lessonId: string, substitute: string): CoverStore {
  const day = weekdayForDate(date);
  if (!day) throw new Error('تاريخ غير صالح.');
  const lesson = getLesson(schedule, date, lessonId);
  if (!lesson) throw new Error('الحصة الأصلية غير موجودة.');
  const record = getCoverDay(store, date);
  if (record.processedAt) throw new Error('اليوم محفوظ كمعالَج؛ أعد فتحه قبل التعديل.');
  if (record.assignments.some((a) => a.lessonId === lessonId)) throw new Error('الحصة مغطاة بالفعل.');
  if (!draftCandidates(schedule, store, date, lessonId).includes(substitute)) throw new Error('البديل غير مؤهل أو مستثنى أو مشغول أو جدول أحد المعلمين غير مكتمل.');
  const assignment: CoverAssignment = { id: crypto.randomUUID(), date, lessonId, absentTeacher: lesson.teacher, substitute };
  const next: CoverStore = { ...store, days: { ...store.days, [date]: { ...record, assignments: [...record.assignments, assignment] } } };
  const error = validateAssignment(schedule, next, assignment);
  if (error) throw new Error(error);
  return next;
}
export function removeCoverAssignment(store: CoverStore, date: string, id: string): CoverStore {
  const record = getCoverDay(store, date);
  if (record.processedAt) throw new Error('اليوم محفوظ كمعالَج؛ أعد فتحه قبل التعديل.');
  return { ...store, days: { ...store.days, [date]: { ...record, assignments: record.assignments.filter((a) => a.id !== id) } } };
}
export function draftSlots(schedule: Schedule, store: CoverStore, date: string): Lesson[] {
  const day = weekdayForDate(date);
  if (!day) return [];
  return absenceSlots(schedule, day, getCoverDay(store, date).absent);
}
export type AutoCoverResult = { store: CoverStore; added: CoverAssignment[]; uncovered: Lesson[]; blockedReason?: string };
export function autoAssignCovers(schedule: Schedule, store: CoverStore, date: string): AutoCoverResult {
  const day = weekdayForDate(date);
  if (!day) return { store, added: [], uncovered: [], blockedReason: 'التاريخ غير صالح.' };
  const record = getCoverDay(store, date);
  if (record.processedAt) return { store, added: [], uncovered: [], blockedReason: 'اليوم محفوظ كمعالَج؛ أعد فتحه قبل إعادة التوزيع.' };
  const slots = draftSlots(schedule, store, date);
  if (!record.absent.length) return { store, added: [], uncovered: slots, blockedReason: 'سجّل الغائبين أولًا.' };
  if (record.absent.some((teacher) => !isDayVerified(schedule, teacher, day)))
    return { store, added: [], uncovered: slots, blockedReason: 'اكتمال جداول جميع المعلمين الغائبين غير مؤكد.' };
  if (record.assignments.some((assignment) => validateAssignment(schedule, store, assignment) !== null))
    return { store, added: [], uncovered: slots.filter((slot) => !record.assignments.some((assignment) => assignment.lessonId === slot.id)), blockedReason: 'توجد تكليفات سابقة غير صالحة؛ أزلها أو صححها قبل التوزيع.' };
  if (!slots.length) return { store, added: [], uncovered: [], blockedReason: 'لا توجد حصص مسجلة للمعلمين الغائبين.' };

  let nextStore = store;
  let pending = slots.filter((slot) => !record.assignments.some((assignment) => assignment.lessonId === slot.id));
  const added: CoverAssignment[] = [];
  const uncovered: Lesson[] = [];
  while (pending.length) {
    const ranked = pending.map((slot) => ({ slot, candidates: draftCandidates(schedule, nextStore, date, slot.id) }))
      .sort((a, b) => a.candidates.length - b.candidates.length || a.slot.period - b.slot.period || a.slot.teacher.localeCompare(b.slot.teacher, 'ar') || a.slot.id.localeCompare(b.slot.id));
    const choice = ranked[0];
    if (!choice.candidates.length) {
      uncovered.push(choice.slot);
      pending = pending.filter((slot) => slot.id !== choice.slot.id);
      continue;
    }
    nextStore = addCoverAssignment(schedule, nextStore, date, choice.slot.id, choice.candidates[0]);
    const assignments = getCoverDay(nextStore, date).assignments;
    added.push(assignments[assignments.length - 1]);
    pending = pending.filter((slot) => slot.id !== choice.slot.id);
  }
  return { store: nextStore, added, uncovered };
}
