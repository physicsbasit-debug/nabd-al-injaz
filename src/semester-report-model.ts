import { DUTIES, ROUTINE_FREQUENCIES, type Duty, type DutyFrequency } from './duties';
import { effectiveFrequency, periodFor, semesterOf, type DutyRecord, type RoutineStore } from './duty-routine';

export const SEMESTER_REPORT_KEY = 'nabd-al-injaz:semester-report:v1';
export const REPORT_FIELDS = [
  ['strengths', 'جوانب القوة في أدائي'],
  ['priorities', 'أولويات التطوير'],
  ['challenges', 'التحديات'],
  ['proposals', 'المقترحات'],
] as const;
export type ReportField = (typeof REPORT_FIELDS)[number][0];
export type SemesterNotes = Partial<Record<ReportField, string>>;
export type SemesterReportStore = { version: 1; semesters: Record<string, SemesterNotes> };

export const emptySemesterReportStore = (): SemesterReportStore => ({ version: 1, semesters: {} });
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function isSemesterReportStore(v: unknown): v is SemesterReportStore {
  return (
    isRecord(v) &&
    v.version === 1 &&
    isRecord(v.semesters) &&
    Object.values(v.semesters).every(
      (s) => isRecord(s) && Object.entries(s).every(([k, val]) => REPORT_FIELDS.some(([f]) => f === k) && typeof val === 'string'),
    )
  );
}
export function readSemesterReportStore(): SemesterReportStore {
  const raw = localStorage.getItem(SEMESTER_REPORT_KEY);
  if (!raw) return emptySemesterReportStore();
  const data: unknown = JSON.parse(raw);
  if (!isSemesterReportStore(data)) throw new Error('تعذر قراءة ملاحظات التقرير الفصلي.');
  return data;
}
export function writeSemesterReportStore(store: SemesterReportStore) {
  localStorage.setItem(SEMESTER_REPORT_KEY, JSON.stringify(store));
}
export function setSemesterNote(store: SemesterReportStore, semesterKey: string, field: ReportField, value: string): SemesterReportStore {
  const current = { ...(store.semesters[semesterKey] ?? {}) };
  const clean = value.slice(0, 3000);
  if (clean.trim()) current[field] = clean;
  else delete current[field];
  return { ...store, semesters: { ...store.semesters, [semesterKey]: current } };
}

export type Semester = ReturnType<typeof semesterOf>;
const shift = (day: string, n: number) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const previousSemester = (today: string): Semester => semesterOf(shift(semesterOf(today).start, -1));

/** مفاتيح الفترات المنقضية من الفصل حتى اليوم (الأيام الدراسية من الأحد إلى الخميس فقط). */
export function elapsedPeriods(frequency: DutyFrequency, semester: Semester, today: string): string[] {
  const last = today < semester.end ? today : semester.end;
  if (last < semester.start) return [];
  const keys: string[] = [];
  for (let day = semester.start; day <= last; day = shift(day, 1)) {
    if (frequency === 'يومي' && new Date(day + 'T00:00:00Z').getUTCDay() >= 5) continue;
    const period = periodFor(frequency, day);
    // الأسبوع الذي لم يبدأ بعد (جمعة وسبت في آخر الفترة) لا يُحسب.
    if (period && period.start <= last && keys[keys.length - 1] !== period.key && !keys.includes(period.key)) keys.push(period.key);
  }
  return keys;
}

export type DutyRow = {
  duty: Duty;
  frequency: DutyFrequency;
  routine: boolean;
  /** للواجبات الدورية: الفترات المنجزة من الفترات المنقضية */
  periodsDone: number;
  periodsElapsed: number;
  /** مجموع الإنجازات المسجلة يدويًا ومن السجلات */
  count: number;
  rate: number | null;
  status: 'منجز' | 'جزئي' | 'لم يُسجل';
  examples: string[];
};

export function buildSemesterReport(input: { today: string; semester: Semester; store: RoutineStore; records: DutyRecord[] }) {
  const { today, semester, store, records } = input;
  const inSemester = (day: string) => day >= semester.start && day <= semester.end && day <= today;
  const rows: DutyRow[] = DUTIES.map((duty) => {
    const frequency = effectiveFrequency(duty, store);
    const routine = ROUTINE_FREQUENCIES.includes(frequency);
    const manual = Object.entries(store.done)
      .filter(([k, c]) => k.startsWith(duty.id + '|') && inSemester(c.at.slice(0, 10)))
      .map(([k, c]) => ({ period: k.slice(k.indexOf('|') + 1), at: c.at.slice(0, 10), note: c.note }));
    const auto = records.filter((r) => r.dutyId === duty.id && inSemester(r.date)).sort((a, b) => b.date.localeCompare(a.date));
    const count = manual.length + auto.length;
    let periodsDone = 0;
    let periodsElapsed = 0;
    if (routine) {
      const elapsed = elapsedPeriods(frequency, semester, today);
      const done = new Set<string>(manual.map((m) => m.period));
      for (const r of auto) {
        const p = periodFor(frequency, r.date);
        if (p) done.add(p.key);
      }
      periodsElapsed = elapsed.length;
      periodsDone = elapsed.filter((k) => done.has(k)).length;
    }
    const rate = routine && periodsElapsed ? periodsDone / periodsElapsed : null;
    const status: DutyRow['status'] = !count ? 'لم يُسجل' : rate === null || rate >= 0.8 ? 'منجز' : 'جزئي';
    const examples = [...auto.map((r) => r.title), ...manual.filter((m) => m.note).map((m) => m.note as string)];
    return { duty, frequency, routine, periodsDone, periodsElapsed, count, rate, status, examples: [...new Set(examples)].slice(0, 3) };
  });
  const recorded = rows.filter((r) => r.count > 0).length;
  const routineRows = rows.filter((r) => r.routine && r.periodsElapsed > 0);
  const compliance = routineRows.length
    ? routineRows.reduce((s, r) => s + r.periodsDone, 0) / routineRows.reduce((s, r) => s + r.periodsElapsed, 0)
    : null;
  const ranked = routineRows.filter((r) => r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  return {
    rows,
    recorded,
    compliance,
    suggestedStrengths: ranked.filter((r) => (r.rate ?? 0) >= 0.8).slice(0, 3).map((r) => r.duty.short),
    suggestedPriorities: ranked.filter((r) => (r.rate ?? 0) < 0.5).reverse().slice(0, 3).map((r) => r.duty.short),
  };
}

const UNITS: Record<string, [string, string, string, string]> = {
  يومي: ['يوم دراسي', 'يومين دراسيين', 'أيام دراسية', 'يومًا دراسيًا'],
  أسبوعي: ['أسبوع', 'أسبوعين', 'أسابيع', 'أسبوعًا'],
  شهري: ['شهر', 'شهرين', 'أشهر', 'شهرًا'],
  فصلي: ['فصل', 'فصلين', 'فصول', 'فصلًا'],
};
/** وحدة الفترة متوافقة مع العدد العربي: 1، 2، 3–10، 11 فأكثر. */
export function periodUnit(frequency: string, count: number): string {
  const forms = UNITS[frequency];
  if (!forms) return '';
  return count === 1 ? forms[0] : count === 2 ? forms[1] : count >= 3 && count <= 10 ? forms[2] : forms[3];
}
