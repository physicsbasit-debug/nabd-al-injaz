import { describe, expect, it } from 'vitest';
import { addLesson, freeTeachers, verifiedFreeTeachers, setDayVerification, removeLesson, coverCandidates, mergeScheduleBatch, mergeLessons, readSchedule, type Schedule } from '../src/schedule-model';

const base: Schedule = { teachers: ['أحمد', 'سالم'], lessons: [] };
describe('teacher schedule safeguards', () => {
  it('returns only registered teachers who are free', () => {
    const schedule = addLesson(base, { teacher: 'أحمد', day: 'الأحد', period: 1, description: 'علوم' });
    expect(freeTeachers(schedule, 'الأحد', 1)).toEqual(['سالم']);
    expect(freeTeachers(schedule, 'الإثنين', 1)).toEqual(['أحمد', 'سالم']);
    expect(freeTeachers(schedule, 'الأحد', 0)).toEqual([]);
  });
  it('rejects a duplicate teacher slot', () => {
    const schedule = addLesson(base, { teacher: 'أحمد', day: 'الأحد', period: 1, description: '' });
    expect(() => addLesson(schedule, { teacher: 'أحمد', day: 'الأحد', period: 1, description: '' })).toThrow(/تعارض/);
    expect(schedule.lessons).toHaveLength(1);
  });
  it('does not mutate original schedule if a batch contains a conflict', () => {
    expect(() => mergeLessons(base, [
      { teacher: 'نورة', day: 'الأحد', period: 1, description: '' },
      { teacher: 'نورة', day: 'الأحد', period: 1, description: '' },
    ])).toThrow(/تعارض/);
    expect(base.lessons).toHaveLength(0);
    expect(base.teachers).toEqual(['أحمد', 'سالم']);
  });
  it('fails closed on incomplete days and excludes absent teachers from cover candidates', () => {
    const initial = addLesson(base, { teacher: 'أحمد', day: 'الأحد', period: 1, description: 'علوم' });
    expect(verifiedFreeTeachers(initial, 'الأحد', 1)).toEqual([]);
    const verified = setDayVerification(initial, 'سالم', 'الأحد', true);
    expect(verifiedFreeTeachers(verified, 'الأحد', 1)).toEqual(['سالم']);
    expect(coverCandidates(verified, 'الأحد', 1, ['أحمد', 'سالم'])).toEqual([]);
    expect(coverCandidates(verified, 'الأحد', 1, ['أحمد'])).toEqual(['سالم']);
  });
  it('invalidates verification after changing or deleting lessons', () => {
    const verified = setDayVerification(base, 'أحمد', 'الأحد', true);
    const added = addLesson(verified, { teacher: 'أحمد', day: 'الأحد', period: 2, description: 'علوم' });
    expect(verifiedFreeTeachers(added, 'الأحد', 1)).toEqual([]);
    const again = setDayVerification(added, 'أحمد', 'الأحد', true);
    expect(removeLesson(again, added.lessons[0].id).verifiedDays).toEqual([]);
  });
  it('accepts a fully blank verified wide day without inventing lessons', () => {
    const imported = mergeScheduleBatch(base, { rows: [], verifiedDays: [{ teacher: 'نورة', day: 'الأحد' }] });
    expect(imported.lessons).toHaveLength(0);
    expect(verifiedFreeTeachers(imported, 'الأحد', 1)).toEqual(['نورة']);
  });
  it('rejects wide coverage when a previous day already contains lessons', () => {
    const existing = addLesson(base, { teacher: 'أحمد', day: 'الأحد', period: 1, description: 'علوم' });
    expect(() => mergeScheduleBatch(existing, { rows: [], verifiedDays: [{ teacher: 'أحمد', day: 'الأحد' }] })).toThrow(/تعارض/);
    expect(existing.lessons).toHaveLength(1);
  });
  it('recovers safely from corrupt local storage', () => {
    const old = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{bad json' } });
    try { expect(readSchedule()).toEqual({ teachers: [], lessons: [] }); }
    finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: old }); }
  });
});
