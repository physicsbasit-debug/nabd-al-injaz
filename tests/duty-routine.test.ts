import { describe, expect, it } from 'vitest';
import { DUTIES, dutyById } from '../src/duties';
import {
  buildRoutine,
  emptyRoutineStore,
  isRoutineStore,
  markRoutine,
  periodFor,
  schoolWeekStart,
  semesterCompletions,
  semesterOf,
  setDutyFrequency,
  unmarkRoutine,
} from '../src/duty-routine';

describe('duties catalog', () => {
  it('holds the 44 official duties with unique ids, steps and evidence', () => {
    expect(DUTIES).toHaveLength(44);
    expect(new Set(DUTIES.map((d) => d.id)).size).toBe(44);
    expect(DUTIES.map((d) => d.id)).toEqual(Array.from({ length: 44 }, (_, i) => i + 1));
    for (const duty of DUTIES) {
      expect(duty.text.length).toBeGreaterThan(10);
      expect(duty.steps.length).toBeGreaterThan(0);
      expect(duty.evidence).not.toBe('');
    }
  });
});

describe('school periods', () => {
  it('uses the Omani Sunday–Thursday school week', () => {
    expect(schoolWeekStart('2026-11-29')).toBe('2026-11-29'); // الأحد
    expect(schoolWeekStart('2026-12-03')).toBe('2026-11-29'); // الخميس
    expect(schoolWeekStart('2026-11-27')).toBe('2026-11-29'); // الجمعة تتبع الأسبوع القادم
    expect(schoolWeekStart('2026-11-28')).toBe('2026-11-29'); // السبت
    expect(periodFor('أسبوعي', '2026-12-01')).toEqual({ key: 'W2026-11-29', end: '2026-12-03', label: 'هذا الأسبوع' });
  });
  it('computes month and semester ends', () => {
    expect(periodFor('شهري', '2026-02-10')?.end).toBe('2026-02-28');
    expect(semesterOf('2026-11-27')).toMatchObject({ key: '2026-S1', end: '2027-01-31' });
    expect(semesterOf('2027-01-15')).toMatchObject({ key: '2026-S1' });
    expect(semesterOf('2027-03-01')).toMatchObject({ key: '2026-S2', end: '2027-07-31' });
    expect(periodFor('مستمر', '2026-11-27')).toBeNull();
  });
});

describe('routine', () => {
  it('lists only periodic duties, flags urgency and tracks completion per period', () => {
    const today = '2026-12-03'; // الخميس
    const items = buildRoutine(today, emptyRoutineStore());
    expect(items.every((i) => ['يومي', 'أسبوعي', 'شهري', 'فصلي'].includes(i.frequency))).toBe(true);
    const visits = items.find((i) => i.duty.id === 11)!;
    expect(visits.urgent).toBe(true);
    const store = markRoutine(emptyRoutineStore(), visits, '  زيارة المعلم أحمد  ', '2026-12-03T05:00:00.000Z');
    const after = buildRoutine(today, store).find((i) => i.duty.id === 11)!;
    expect(after.done).toEqual({ at: '2026-12-03T05:00:00.000Z', note: 'زيارة المعلم أحمد' });
    expect(after.urgent).toBe(false);
    // The next school week starts fresh.
    expect(buildRoutine('2026-12-06', store).find((i) => i.duty.id === 11)!.done).toBeNull();
    expect(buildRoutine(today, unmarkRoutine(store, visits)).find((i) => i.duty.id === 11)!.done).toBeNull();
    expect(semesterCompletions(store, today)[11]).toBe(1);
  });
  it('lets the user change a duty frequency and validates stored data', () => {
    const duty = dutyById(1)!; // مستمر by default
    const store = setDutyFrequency(emptyRoutineStore(), duty, 'شهري');
    expect(buildRoutine('2026-11-27', store).some((i) => i.duty.id === 1)).toBe(true);
    expect(setDutyFrequency(store, duty, 'مستمر').frequency).toEqual({});
    expect(isRoutineStore(store)).toBe(true);
    expect(isRoutineStore({ version: 1, done: { '1|x': { at: 5 } }, frequency: {} })).toBe(false);
    expect(isRoutineStore({ version: 1, done: {}, frequency: { 1: 'أحيانًا' } })).toBe(false);
  });
});
