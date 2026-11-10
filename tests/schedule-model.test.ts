import { describe, expect, it } from 'vitest';
import { addLesson, freeTeachers, mergeLessons, readSchedule, type Schedule } from '../src/schedule-model';

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
  it('recovers safely from corrupt local storage', () => {
    const old = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{bad json' } });
    try { expect(readSchedule()).toEqual({ teachers: [], lessons: [] }); }
    finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: old }); }
  });
});
