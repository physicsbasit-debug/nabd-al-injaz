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

describe('core routine', () => {
  it('includes only the ten core duties by default', () => {
    expect(buildRoutine('2026-11-27', emptyRoutineStore()).map((i) => i.duty.id)).toEqual([
      4, 5, 8, 11, 16, 24, 26, 27, 30, 32,
    ]);
  });
});

describe('school periods', () => {
  it('uses the Omani Sunday–Thursday school week', () => {
    expect(schoolWeekStart('2026-11-29')).toBe('2026-11-29'); // الأحد
    expect(schoolWeekStart('2026-12-03')).toBe('2026-11-29'); // الخميس
    expect(schoolWeekStart('2026-11-27')).toBe('2026-11-29'); // الجمعة تتبع الأسبوع القادم
    expect(schoolWeekStart('2026-11-28')).toBe('2026-11-29'); // السبت
    expect(periodFor('أسبوعي', '2026-12-01')).toEqual({
      key: 'W2026-11-29',
      start: '2026-11-27',
      end: '2026-12-03',
      label: 'هذا الأسبوع',
    });
  });
  it('counts weekend work toward the coming school week', () => {
    const record = {
      dutyId: 11,
      date: '2026-11-27',
      title: 'زيارة الجمعة',
      section: 'الزيارات الإشرافية',
    };
    expect(
      buildRoutine('2026-11-27', emptyRoutineStore(), [record]).find((i) => i.duty.id === 11)!
        .complete,
    ).toBe(true);
    expect(
      buildRoutine('2026-12-01', emptyRoutineStore(), [record]).find((i) => i.duty.id === 11)!
        .complete,
    ).toBe(true);
    expect(
      buildRoutine('2026-11-26', emptyRoutineStore(), [record]).find((i) => i.duty.id === 11)!
        .complete,
    ).toBe(false);
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
    const store = markRoutine(
      emptyRoutineStore(),
      visits,
      '  زيارة المعلم أحمد  ',
      '2026-12-03T05:00:00.000Z',
    );
    const after = buildRoutine(today, store).find((i) => i.duty.id === 11)!;
    expect(after.done).toEqual({ at: '2026-12-03T05:00:00.000Z', note: 'زيارة المعلم أحمد' });
    expect(after.urgent).toBe(false);
    // The next school week starts fresh.
    expect(buildRoutine('2026-12-06', store).find((i) => i.duty.id === 11)!.done).toBeNull();
    expect(
      buildRoutine(today, unmarkRoutine(store, visits)).find((i) => i.duty.id === 11)!.done,
    ).toBeNull();
    expect(semesterCompletions(store, today)[11]).toBe(1);
  });
  it('lets the user change a duty frequency and validates stored data', () => {
    const duty = dutyById(1)!; // غير أساسي: «عند الحاجة» افتراضيًا
    expect(buildRoutine('2026-11-27', emptyRoutineStore()).some((i) => i.duty.id === 1)).toBe(
      false,
    );
    const store = setDutyFrequency(emptyRoutineStore(), duty, 'شهري');
    expect(buildRoutine('2026-11-27', store).some((i) => i.duty.id === 1)).toBe(true);
    expect(setDutyFrequency(store, duty, 'عند الحاجة').frequency).toEqual({});
    expect(isRoutineStore(store)).toBe(true);
    expect(isRoutineStore({ version: 1, done: { '1|x': { at: 5 } }, frequency: {} })).toBe(false);
    expect(isRoutineStore({ version: 1, done: {}, frequency: { 1: 'أحيانًا' } })).toBe(false);
  });
});

import { dutyRecordsFrom } from '../src/duty-records';
import { readTasks, withDutyId, STORAGE_KEY, type Task } from '../src/task-model';
import type { Achievement } from '../src/achievement-register';

describe('auto-closing duties from records', () => {
  const row = (over: Partial<Achievement>): Achievement => ({
    id: 'x',
    title: 'سجل',
    section: 'الخطط والمهام',
    person: '',
    date: '2026-12-01',
    source: 'task',
    sourceId: 't',
    detail: '',
    ...over,
  });
  const task = (over: Partial<Task>): Task => ({
    id: 't',
    title: 'مهمة',
    dueDate: '',
    priority: 'عادية',
    done: true,
    createdAt: '',
    category: 'أخرى',
    assignedTo: '',
    progress: 'مكتملة',
    notes: '',
    ...over,
  });

  it('maps section records and linked tasks to duties and skips undated or unlinked rows', () => {
    const records = dutyRecordsFrom(
      [
        row({
          id: 'visit:1',
          title: 'زيارة أحمد',
          section: 'الزيارات الإشرافية',
          source: 'visit',
          sourceId: '1',
        }),
        row({ id: 'cover:d', section: 'الجداول والاحتياط', source: 'cover', sourceId: 'd' }),
        row({ id: 'topic:1', section: 'الزيارات الإشرافية', source: 'topic', date: null }),
        row({ id: 'task:t', title: 'فحص سجلات القسم', source: 'task', sourceId: 't' }),
        row({ id: 'task:u', source: 'task', sourceId: 'u' }),
      ],
      [task({ id: 't', dutyId: 30 }), task({ id: 'u' })],
    );
    expect(records.map((r) => r.dutyId)).toEqual([11, 4, 30]);
  });

  it('closes a routine duty only when a record falls inside its current period', () => {
    const records = [
      { dutyId: 11, date: '2026-12-01', title: 'زيارة أحمد', section: 'الزيارات الإشرافية' },
      { dutyId: 11, date: '2026-12-02', title: 'زيارة سالم', section: 'الزيارات الإشرافية' },
      { dutyId: 30, date: '2026-11-20', title: 'فحص السجلات', section: 'الخطط والمهام' },
    ];
    const items = buildRoutine('2026-12-03', emptyRoutineStore(), records);
    const visits = items.find((i) => i.duty.id === 11)!;
    expect(visits.complete).toBe(true);
    expect(visits.done).toBeNull();
    expect(visits.auto.map((r) => r.title)).toEqual(['زيارة سالم', 'زيارة أحمد']);
    expect(visits.urgent).toBe(false);
    // A November record does not close December's monthly duty.
    expect(items.find((i) => i.duty.id === 30)!.complete).toBe(false);
    // The following school week opens the weekly duty again.
    expect(
      buildRoutine('2026-12-06', emptyRoutineStore(), records).find((i) => i.duty.id === 11)!
        .complete,
    ).toBe(false);
    expect(semesterCompletions(emptyRoutineStore(), '2026-12-03', records)[11]).toBe(2);
  });

  it('stores only valid duty links on tasks', () => {
    expect(withDutyId(task({}), '11').dutyId).toBe(11);
    expect(withDutyId(task({ dutyId: 11 }), '')).not.toHaveProperty('dutyId');
    expect(withDutyId(task({}), '99')).not.toHaveProperty('dutyId');
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        task({ id: 'a', dutyId: 16 }),
        task({ id: 'b', dutyId: 77 }),
        task({ id: 'c', dutyId: '5' as unknown as number }),
      ]),
    );
    expect(readTasks().map((t) => t.dutyId)).toEqual([16, undefined, undefined]);
  });
});
