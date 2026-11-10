import { describe, expect, it, vi } from 'vitest';
import { addLesson, setDayVerification, type Schedule } from '../src/schedule-model';
import { addCoverAssignment, draftCandidates, getCoverDay, readCoverStore, removeCoverAssignment, setCoverAbsences, validateAssignment, weekdayForDate, EMPTY_COVER_STORE } from '../src/cover-planning';

function sample() {
  let schedule: Schedule = { teachers: ['أحمد', 'سالم', 'نورة', 'علي'], lessons: [], verifiedDays: [] };
  schedule = addLesson(schedule, { teacher: 'أحمد', day: 'الثلاثاء', period: 1, description: 'علوم' });
  schedule = addLesson(schedule, { teacher: 'أحمد', day: 'الثلاثاء', period: 2, description: 'علوم' });
  schedule = addLesson(schedule, { teacher: 'علي', day: 'الثلاثاء', period: 1, description: 'رياضيات' });
  for (const teacher of schedule.teachers) schedule = setDayVerification(schedule, teacher, 'الثلاثاء', true);
  return schedule;
}
const date = '2026-11-10';
describe('date-scoped cover planning', () => {
  it('rejects malformed dates, impossible days and weekends', () => {
    expect(weekdayForDate('2026-11-10')).toBe('الثلاثاء');
    expect(weekdayForDate('2026-11-13')).toBeNull();
    expect(weekdayForDate('2026-02-30')).toBeNull();
    expect(weekdayForDate('2026-11-10x')).toBeNull();
  });
  it('requires absence and verified completeness before proposing a substitute', () => {
    const schedule = sample();
    const lesson = schedule.lessons[0];
    expect(draftCandidates(schedule, EMPTY_COVER_STORE, date, lesson.id)).toEqual([]);
    const store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    expect(draftCandidates(schedule, store, date, lesson.id)).toEqual(['سالم', 'نورة']);
    const unverified = setDayVerification(schedule, 'أحمد', 'الثلاثاء', false);
    expect(draftCandidates(unverified, store, date, lesson.id)).toEqual([]);
    expect(() => addCoverAssignment(unverified, store, date, lesson.id, 'سالم')).toThrow(/غير مؤهل/);
  });
  it('never assigns absent, busy or same-period already assigned teachers', () => {
    const schedule = sample();
    const store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد', 'سالم'], schedule);
    expect(draftCandidates(schedule, store, date, schedule.lessons[0].id)).toEqual(['نورة']);
    expect(() => addCoverAssignment(schedule, store, date, schedule.lessons[0].id, 'علي')).toThrow();
    expect(() => addCoverAssignment(schedule, store, date, schedule.lessons[0].id, 'سالم')).toThrow();
    const assigned = addCoverAssignment(schedule, store, date, schedule.lessons[0].id, 'نورة');
    expect(() => addCoverAssignment(schedule, assigned, date, schedule.lessons[0].id, 'نورة')).toThrow(/مغطاة/);
    expect(validateAssignment(schedule, assigned, getCoverDay(assigned, date).assignments[0])).toBeNull();
  });
  it('keeps separate dates and flags stale assignments after absence changes', () => {
    const schedule = sample();
    const store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    const assigned = addCoverAssignment(schedule, store, date, schedule.lessons[0].id, 'سالم');
    const changed = setCoverAbsences(assigned, date, [], schedule);
    expect(validateAssignment(schedule, changed, getCoverDay(changed, date).assignments[0])).toMatch(/لم يعد/);
    expect(getCoverDay(changed, date).assignments).toHaveLength(1);
    expect(getCoverDay(changed, '2026-11-11').assignments).toHaveLength(0);
    expect(getCoverDay(removeCoverAssignment(changed, date, getCoverDay(changed, date).assignments[0].id), date).assignments).toHaveLength(0);
  });
  it('flags stale assignment after teacher schedule changes', () => {
    const schedule = sample();
    const store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    const assigned = addCoverAssignment(schedule, store, date, schedule.lessons[0].id, 'سالم');
    const changed = addLesson(schedule, { teacher: 'سالم', day: 'الثلاثاء', period: 1, description: 'فيزياء' });
    expect(validateAssignment(changed, assigned, getCoverDay(assigned, date).assignments[0])).toMatch(/غير مؤكد/);
  });
  it('returns a safe empty store on corrupted persistence', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad' });
    try { expect(readCoverStore()).toEqual({ version: 1, days: {} }); }
    finally { vi.unstubAllGlobals(); }
  });
});
