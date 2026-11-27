import { DUTIES, DUTY_FREQUENCIES, ROUTINE_FREQUENCIES, type Duty, type DutyFrequency } from './duties';

export const DUTY_ROUTINE_KEY = 'nabd-al-injaz:duty-routine:v1';

export type RoutineCompletion = { at: string; note?: string };
export type RoutineStore = {
  version: 1;
  /** المفتاح: رقم الواجب|مفتاح الفترة */
  done: Record<string, RoutineCompletion>;
  /** تكرار مخصص يختاره المستخدم بدل الافتراضي */
  frequency: Record<string, DutyFrequency>;
};

export const emptyRoutineStore = (): RoutineStore => ({ version: 1, done: {}, frequency: {} });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isFrequency = (v: unknown): v is DutyFrequency => DUTY_FREQUENCIES.includes(v as DutyFrequency);

export function isRoutineStore(value: unknown): value is RoutineStore {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.done) || !isRecord(value.frequency)) return false;
  const doneOk = Object.values(value.done).every(
    (c) => isRecord(c) && typeof c.at === 'string' && (c.note === undefined || typeof c.note === 'string'),
  );
  return doneOk && Object.values(value.frequency).every(isFrequency);
}

export function readRoutineStore(): RoutineStore {
  try {
    const raw = localStorage.getItem(DUTY_ROUTINE_KEY);
    if (!raw) return emptyRoutineStore();
    const data: unknown = JSON.parse(raw);
    return isRoutineStore(data) ? data : emptyRoutineStore();
  } catch {
    return emptyRoutineStore();
  }
}

export function writeRoutineStore(store: RoutineStore) {
  localStorage.setItem(DUTY_ROUTINE_KEY, JSON.stringify(store));
}

const parse = (day: string) => new Date(day + 'T00:00:00Z');
const key = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const date = parse(day);
  date.setUTCDate(date.getUTCDate() + n);
  return key(date);
};
export const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);

/** الأسبوع الدراسي في عُمان من الأحد إلى الخميس؛ الجمعة والسبت يتبعان الأسبوع القادم. */
export function schoolWeekStart(today: string): string {
  const weekday = parse(today).getUTCDay(); // 0 = الأحد
  if (weekday === 5) return addDays(today, 2);
  if (weekday === 6) return addDays(today, 1);
  return addDays(today, -weekday);
}

/** الفصل الأول: أغسطس–يناير، الفصل الثاني: فبراير–يوليو (تقريب قابل للمراجعة). */
export function semesterOf(today: string): { key: string; label: string; start: string; end: string } {
  const [y, m] = today.split('-').map(Number);
  if (m >= 8) return { key: `${y}-S1`, label: 'الفصل الدراسي الأول', start: `${y}-08-01`, end: `${y + 1}-01-31` };
  if (m === 1) return { key: `${y - 1}-S1`, label: 'الفصل الدراسي الأول', start: `${y - 1}-08-01`, end: `${y}-01-31` };
  return { key: `${y - 1}-S2`, label: 'الفصل الدراسي الثاني', start: `${y}-02-01`, end: `${y}-07-31` };
}

export function periodFor(frequency: DutyFrequency, today: string): { key: string; start: string; end: string; label: string } | null {
  if (frequency === 'يومي') return { key: today, start: today, end: today, label: 'اليوم' };
  if (frequency === 'أسبوعي') {
    const start = schoolWeekStart(today);
    return { key: 'W' + start, start, end: addDays(start, 4), label: 'هذا الأسبوع' };
  }
  if (frequency === 'شهري') {
    const [y, m] = today.split('-').map(Number);
    const end = key(new Date(Date.UTC(y, m, 0)));
    return { key: today.slice(0, 7), start: today.slice(0, 7) + '-01', end, label: 'هذا الشهر' };
  }
  if (frequency === 'فصلي') {
    const s = semesterOf(today);
    return { key: s.key, start: s.start, end: s.end, label: s.label };
  }
  return null;
}

const URGENT_DAYS: Partial<Record<DutyFrequency, number>> = { أسبوعي: 1, شهري: 5, فصلي: 21 };

/** سجل من أقسام التطبيق يُثبت إنجاز واجب في تاريخ محدد. */
export type DutyRecord = { dutyId: number; date: string; title: string; section: string };

export type RoutineItem = {
  duty: Duty;
  /** سجلات الأقسام داخل الفترة؛ وجود أي منها يجعل الواجب منجزًا تلقائيًا */
  auto: DutyRecord[];
  /** منجز يدويًا أو تلقائيًا */
  complete: boolean;
  frequency: DutyFrequency;
  periodKey: string;
  periodLabel: string;
  end: string;
  daysLeft: number;
  done: RoutineCompletion | null;
  urgent: boolean;
};

export const effectiveFrequency = (duty: Duty, store: RoutineStore): DutyFrequency =>
  store.frequency[String(duty.id)] ?? duty.frequency;

export function buildRoutine(today: string, store: RoutineStore, records: DutyRecord[] = []): RoutineItem[] {
  const items: RoutineItem[] = [];
  for (const duty of DUTIES) {
    const frequency = effectiveFrequency(duty, store);
    if (!ROUTINE_FREQUENCIES.includes(frequency)) continue;
    const period = periodFor(frequency, today);
    if (!period) continue;
    const daysLeft = daysBetween(today, period.end);
    const done = store.done[duty.id + '|' + period.key] ?? null;
    const auto = records
      .filter((r) => r.dutyId === duty.id && r.date >= period.start && r.date <= period.end && r.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));
    const complete = !!done || auto.length > 0;
    const threshold = URGENT_DAYS[frequency];
    items.push({
      duty,
      auto,
      complete,
      frequency,
      periodKey: period.key,
      periodLabel: period.label,
      end: period.end,
      daysLeft,
      done,
      urgent: !complete && threshold !== undefined && daysLeft <= threshold,
    });
  }
  return items;
}

export function markRoutine(store: RoutineStore, item: Pick<RoutineItem, 'duty' | 'periodKey'>, note = '', at = new Date().toISOString()): RoutineStore {
  const trimmed = note.trim().slice(0, 300);
  return { ...store, done: { ...store.done, [item.duty.id + '|' + item.periodKey]: { at, ...(trimmed ? { note: trimmed } : {}) } } };
}

export function unmarkRoutine(store: RoutineStore, item: Pick<RoutineItem, 'duty' | 'periodKey'>): RoutineStore {
  const done = { ...store.done };
  delete done[item.duty.id + '|' + item.periodKey];
  return { ...store, done };
}

export function setDutyFrequency(store: RoutineStore, duty: Duty, frequency: DutyFrequency): RoutineStore {
  const map = { ...store.frequency };
  if (frequency === duty.frequency) delete map[String(duty.id)];
  else map[String(duty.id)] = frequency;
  return { ...store, frequency: map };
}

/** عدد مرات إنجاز كل واجب منذ بداية الفصل الحالي: يدويًا أو من سجلات الأقسام. */
export function semesterCompletions(store: RoutineStore, today: string, records: DutyRecord[] = []): Record<number, number> {
  const semester = semesterOf(today);
  const counts: Record<number, number> = {};
  const inSemester = (day: string) => day >= semester.start && day <= semester.end;
  for (const [k, c] of Object.entries(store.done)) {
    if (!inSemester(c.at.slice(0, 10))) continue;
    const id = Number(k.split('|')[0]);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  for (const r of records) if (inSemester(r.date)) counts[r.dutyId] = (counts[r.dutyId] ?? 0) + 1;
  return counts;
}
