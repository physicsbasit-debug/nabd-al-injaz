import { describe, expect, it } from 'vitest';
import { emptyRoutineStore, markRoutine, semesterOf } from '../src/duty-routine';
import { dutyById } from '../src/duties';
import {
  buildSemesterReport,
  elapsedPeriods,
  emptySemesterReportStore,
  isSemesterReportStore,
  periodUnit,
  previousSemester,
  setSemesterNote,
} from '../src/semester-report-model';

describe('semester report', () => {
  const semester = semesterOf('2026-08-20'); // 2026-08-01 .. 2027-01-31

  it('counts elapsed periods: school days, weeks, months', () => {
    // 2026-08-01 is a Saturday; 2026-08-02 Sunday .. 2026-08-06 Thursday.
    expect(elapsedPeriods('يومي', semester, '2026-08-07')).toEqual([
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);
    expect(elapsedPeriods('أسبوعي', semester, '2026-08-13')).toEqual([
      'W2026-08-02',
      'W2026-08-09',
    ]);
    expect(elapsedPeriods('شهري', semester, '2026-10-02')).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(elapsedPeriods('فصلي', semester, '2026-10-02')).toEqual(['2026-S1']);
    expect(elapsedPeriods('شهري', semester, '2026-07-01')).toEqual([]);
  });

  it('measures compliance from manual completions and section records', () => {
    const today = '2026-08-20'; // weeks of Aug 2, 9, 16 elapsed
    let store = emptyRoutineStore();
    store = markRoutine(
      store,
      { duty: dutyById(11)!, periodKey: 'W2026-08-02' },
      'زيارة أولى',
      '2026-08-04T06:00:00.000Z',
    );
    const records = [
      { dutyId: 11, date: '2026-08-11', title: 'زيارة أحمد', section: 'الزيارات الإشرافية' },
      { dutyId: 11, date: '2026-08-12', title: 'زيارة سالم', section: 'الزيارات الإشرافية' },
      { dutyId: 27, date: '2026-08-15', title: 'مشغل التعلم النشط', section: 'الإنماء المهني' },
      { dutyId: 11, date: '2026-05-01', title: 'زيارة قديمة', section: 'الزيارات الإشرافية' },
    ];
    const report = buildSemesterReport({ today, semester, store, records });
    const visits = report.rows.find((r) => r.duty.id === 11)!;
    expect(visits).toMatchObject({ periodsDone: 2, periodsElapsed: 3, count: 3, status: 'جزئي' });
    expect(visits.examples).toEqual(['زيارة سالم', 'زيارة أحمد', 'زيارة أولى']);
    const pd = report.rows.find((r) => r.duty.id === 27)!;
    expect(pd).toMatchObject({ periodsDone: 1, periodsElapsed: 1, status: 'منجز' });
    const ethics = report.rows.find((r) => r.duty.id === 1)!;
    expect(ethics).toMatchObject({ routine: false, count: 0, status: 'لم يُسجل' });
    expect(report.recorded).toBe(2);
    expect(report.suggestedStrengths).toContain('برامج الإنماء المهني');
    expect(report.rows).toHaveLength(44);
  });

  it('agrees the period unit with the Arabic number', () => {
    expect([1, 2, 4, 13].map((n) => periodUnit('شهري', n))).toEqual(['شهر', 'شهرين', 'أشهر', 'شهرًا']);
    expect(periodUnit('أسبوعي', 12)).toBe('أسبوعًا');
  });

  it('finds the previous semester and stores notes per semester', () => {
    expect(previousSemester('2026-11-27')).toMatchObject({
      key: '2025-S2',
      start: '2026-02-01',
      end: '2026-07-31',
    });
    expect(previousSemester('2027-03-01')).toMatchObject({ key: '2026-S1' });
    let store = setSemesterNote(
      emptySemesterReportStore(),
      '2026-S1',
      'challenges',
      'كثرة الاحتياط',
    );
    expect(store.semesters['2026-S1']).toEqual({ challenges: 'كثرة الاحتياط' });
    store = setSemesterNote(store, '2026-S1', 'challenges', '   ');
    expect(store.semesters['2026-S1']).toEqual({});
    expect(isSemesterReportStore(store)).toBe(true);
    expect(isSemesterReportStore({ version: 1, semesters: { x: { other: 'a' } } })).toBe(false);
  });
});
