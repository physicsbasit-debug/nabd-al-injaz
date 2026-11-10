export const SCHEDULE_STORAGE_KEY = 'nabd-al-injaz:schedules:v1';
export const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const;
export type Day = (typeof DAYS)[number];
export type Lesson = { id: string; teacher: string; day: Day; period: number; description: string };
export type LessonInput = Omit<Lesson, 'id'>;
export type DayCoverage = { teacher: string; day: Day };
export type Schedule = { teachers: string[]; lessons: Lesson[]; verifiedDays?: DayCoverage[] };
export const EMPTY_SCHEDULE: Schedule = { teachers: [], lessons: [], verifiedDays: [] };
export const normalizeTeacher = (name: string) => name.trim().replace(/\s+/g, ' ');
export const validPeriod = (period: number) => Number.isInteger(period) && period >= 1 && period <= 12;
export const validDay = (day: string): day is Day => DAYS.some((d) => d === day);
const coverageKey = (teacher: string, day: Day) => JSON.stringify([teacher, day]);
export function isDayVerified(schedule: Schedule, teacher: string, day: Day): boolean {
  return (schedule.verifiedDays ?? []).some((c) => c.teacher === teacher && c.day === day);
}
export function readSchedule(): Schedule {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_SCHEDULE;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.teachers) || !Array.isArray(record.lessons)) return EMPTY_SCHEDULE;
    const teachers = [...new Set(record.teachers.filter((t): t is string => typeof t === 'string').map(normalizeTeacher).filter(Boolean))];
    const lessons: Lesson[] = [];
    for (const raw of record.lessons) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== 'string' || !r.id || typeof r.teacher !== 'string' || typeof r.day !== 'string' || !validDay(r.day) || typeof r.period !== 'number' || !validPeriod(r.period) || typeof r.description !== 'string') continue;
      const teacher = normalizeTeacher(r.teacher);
      if (!teachers.includes(teacher) || lessons.some((l) => l.teacher === teacher && l.day === r.day && l.period === r.period)) continue;
      lessons.push({ id: r.id, teacher, day: r.day, period: r.period, description: r.description });
    }
    const verifiedDays: DayCoverage[] = [];
    const seen = new Set<string>();
    if (Array.isArray(record.verifiedDays)) for (const raw of record.verifiedDays) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c = raw as Record<string, unknown>;
      if (typeof c.teacher !== 'string' || typeof c.day !== 'string' || !validDay(c.day)) continue;
      const teacher = normalizeTeacher(c.teacher);
      const key = coverageKey(teacher, c.day);
      if (teachers.includes(teacher) && !seen.has(key)) { verifiedDays.push({ teacher, day: c.day }); seen.add(key); }
    }
    return { teachers, lessons, verifiedDays };
  } catch { return EMPTY_SCHEDULE; }
}
export function freeTeachers(schedule: Schedule, day: Day, period: number): string[] {
  if (!validPeriod(period)) return [];
  const busy = new Set(schedule.lessons.filter((l) => l.day === day && l.period === period).map((l) => l.teacher));
  return schedule.teachers.filter((t) => !busy.has(t));
}
export function verifiedFreeTeachers(schedule: Schedule, day: Day, period: number): string[] {
  return freeTeachers(schedule, day, period).filter((t) => isDayVerified(schedule, t, day));
}
export function setDayVerification(schedule: Schedule, teacher: string, day: Day, verified: boolean): Schedule {
  if (!schedule.teachers.includes(teacher) || !validDay(day)) throw new Error('المعلم أو اليوم غير صالح.');
  const verifiedDays = (schedule.verifiedDays ?? []).filter((c) => !(c.teacher === teacher && c.day === day));
  if (verified) verifiedDays.push({ teacher, day });
  return { ...schedule, verifiedDays };
}
function invalidateCoverage(schedule: Schedule, teacher: string, day: Day): DayCoverage[] {
  return (schedule.verifiedDays ?? []).filter((c) => !(c.teacher === teacher && c.day === day));
}
export function addLesson(schedule: Schedule, lesson: LessonInput): Schedule {
  const teacher = normalizeTeacher(lesson.teacher);
  if (!teacher || !schedule.teachers.includes(teacher)) throw new Error('اختر معلمًا مسجلًا.');
  if (!validDay(lesson.day) || !validPeriod(lesson.period)) throw new Error('اليوم أو رقم الحصة غير صالح.');
  if (schedule.lessons.some((l) => l.teacher === teacher && l.day === lesson.day && l.period === lesson.period)) throw new Error('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.');
  return { ...schedule, verifiedDays: invalidateCoverage(schedule, teacher, lesson.day), lessons: [...schedule.lessons, { ...lesson, teacher, description: lesson.description.trim(), id: crypto.randomUUID() }] };
}
export function removeLesson(schedule: Schedule, id: string): Schedule {
  const target = schedule.lessons.find((l) => l.id === id);
  if (!target) return schedule;
  return { ...schedule, lessons: schedule.lessons.filter((l) => l.id !== id), verifiedDays: invalidateCoverage(schedule, target.teacher, target.day) };
}
export function mergeLessons(schedule: Schedule, rows: LessonInput[]): Schedule {
  let next: Schedule = { ...schedule, teachers: [...schedule.teachers], lessons: [...schedule.lessons], verifiedDays: [...(schedule.verifiedDays ?? [])] };
  for (const row of rows) {
    const teacher = normalizeTeacher(row.teacher);
    if (!next.teachers.includes(teacher)) next.teachers.push(teacher);
    next = addLesson(next, { ...row, teacher });
  }
  return next;
}
export type ScheduleImportBatch = { rows: LessonInput[]; verifiedDays: DayCoverage[] };
export function mergeScheduleBatch(schedule: Schedule, batch: ScheduleImportBatch): Schedule {
  for (const c of batch.verifiedDays) {
    if (schedule.lessons.some((l) => l.teacher === c.teacher && l.day === c.day)) throw new Error('تعارض: يوم المعلم موجود مسبقًا؛ لا يمكن تأكيد اكتماله من استيراد إضافي.');
  }
  let next = mergeLessons(schedule, batch.rows);
  for (const c of batch.verifiedDays) {
    if (!next.teachers.includes(c.teacher)) next = { ...next, teachers: [...next.teachers, c.teacher] };
    next = setDayVerification(next, c.teacher, c.day, true);
  }
  return next;
}
export function absenceSlots(schedule: Schedule, day: Day, absent: string[]): Lesson[] {
  const names = new Set(absent);
  return schedule.lessons.filter((l) => l.day === day && names.has(l.teacher)).sort((a, b) => a.period - b.period || a.teacher.localeCompare(b.teacher));
}
export function coverCandidates(schedule: Schedule, day: Day, period: number, absent: string[]): string[] {
  const excluded = new Set(absent);
  return verifiedFreeTeachers(schedule, day, period).filter((name) => !excluded.has(name));
}
