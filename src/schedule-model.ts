export const SCHEDULE_STORAGE_KEY = 'nabd-al-injaz:schedules:v1';
export const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const;
export type Day = (typeof DAYS)[number];
export type Lesson = { id: string; teacher: string; day: Day; period: number; description: string };
export type Schedule = { teachers: string[]; lessons: Lesson[] };
export type LessonInput = Omit<Lesson, 'id'>;
export const EMPTY_SCHEDULE: Schedule = { teachers: [], lessons: [] };
export const normalizeTeacher = (name: string) => name.trim().replace(/\s+/g, ' ');
export const validPeriod = (period: number) => Number.isInteger(period) && period >= 1 && period <= 12;
export const validDay = (day: string): day is Day => DAYS.some((d) => d === day);
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
    return { teachers, lessons };
  } catch { return EMPTY_SCHEDULE; }
}
export function freeTeachers(schedule: Schedule, day: Day, period: number): string[] {
  if (!validPeriod(period)) return [];
  const busy = new Set(schedule.lessons.filter((l) => l.day === day && l.period === period).map((l) => l.teacher));
  return schedule.teachers.filter((t) => !busy.has(t));
}
export function addLesson(schedule: Schedule, lesson: LessonInput): Schedule {
  const teacher = normalizeTeacher(lesson.teacher);
  if (!teacher || !schedule.teachers.includes(teacher)) throw new Error('اختر معلمًا مسجلًا.');
  if (!validDay(lesson.day) || !validPeriod(lesson.period)) throw new Error('اليوم أو رقم الحصة غير صالح.');
  if (schedule.lessons.some((l) => l.teacher === teacher && l.day === lesson.day && l.period === lesson.period)) throw new Error('تعارض: لدى المعلم حصة مسجلة في هذا الموعد.');
  return { ...schedule, lessons: [...schedule.lessons, { ...lesson, teacher, description: lesson.description.trim(), id: crypto.randomUUID() }] };
}
export function mergeLessons(schedule: Schedule, rows: LessonInput[]): Schedule {
  let next = { ...schedule, teachers: [...schedule.teachers], lessons: [...schedule.lessons] };
  for (const row of rows) {
    const teacher = normalizeTeacher(row.teacher);
    if (!next.teachers.includes(teacher)) next.teachers.push(teacher);
    next = addLesson(next, { ...row, teacher });
  }
  return next;
}
