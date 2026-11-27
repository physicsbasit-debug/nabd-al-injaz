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
export function semesterOf(today: string): { key: string; label: string; end: string } {
  const [y, m] = today.split('-').map(Number);
  if (m >= 8) return { key: `${y}-S1`, label: 'الفصل الدراسي الأول', end: `${y + 1}-01-31` };
  if (m === 1) return { key: `${y - 1}-S1`, label: 'الفصل الدراسي الأول', end: `${y}-01-31` };
  return { key: `${y - 1}-S2`, label: 'الفصل الدراسي الثاني', end: `${y}-07-31` };
}

export function periodFor(frequency: DutyFrequency, today: string): { key: string; end: string; label: string } | null {
  if (frequency === 'يومي') return { key: today, end: today, label: 'اليوم' };
  if (frequency === 'أسبوعي') {
    const start = schoolWeekStart(today);
    return { key: 'W' + start, end: addDays(start, 4), label: 'هذا الأسبوع' };
  }
  if (frequency === 'شهري') {
    const [y, m] = today.split('-').map(Number);
    const end = key(new Date(Date.UTC(y, m, 0)));
    return { key: today.slice(0, 7), end, label: 'هذا الشهر' };
  }
  if (frequency === 'فصلي') {
    const s = semesterOf(today);
    return { key: s.key, end: s.end, label: s.label };
  }
  return null;
}

const URGENT_DAYS: Partial<Record<DutyFrequency, number>> = { أسبوعي: 1, شهري: 5, فصلي: 21 };

export type RoutineItem = {
  duty: Duty;
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

export function buildRoutine(today: string, store: RoutineStore): RoutineItem[] {
  const items: RoutineItem[] = [];
  for (const duty of DUTIES) {
    const frequency = effectiveFrequency(duty, store);
    if (!ROUTINE_FREQUENCIES.includes(frequency)) continue;
    const period = periodFor(frequency, today);
    if (!period) continue;
    const daysLeft = daysBetween(today, period.end);
    const done = store.done[duty.id + '|' + period.key] ?? null;
    const threshold = URGENT_DAYS[frequency];
    items.push({
      duty,
      frequency,
      periodKey: period.key,
      periodLabel: period.label,
      end: period.end,
      daysLeft,
      done,
      urgent: !done && threshold !== undefined && daysLeft <= threshold,
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

/** عدد الفترات المنجزة لكل واجب منذ بداية الفصل الحالي (لدليل الواجبات والتقويم الذاتي). */
export function semesterCompletions(store: RoutineStore, today: string): Record<number, number> {
  const semester = semesterOf(today);
  const [startYear, part] = semester.key.split('-S');
  const start = part === '1' ? `${startYear}-08-01` : `${Number(startYear) + 1}-02-01`;
  const counts: Record<number, number> = {};
  for (const [k, c] of Object.entries(store.done)) {
    const day = c.at.slice(0, 10);
    if (day < start || day > semester.end) continue;
    const id = Number(k.split('|')[0]);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
