import { describe, expect, it, vi } from 'vitest';
import { addLesson, setDayVerification, type Schedule } from '../src/schedule-model';
import { addCoverAssignment, autoAssignCovers, clearCoverDay, draftCandidates, getCoverDailySummary, getCoverDay, getCoverBalance, processCoverDay, readCoverStore, removeCoverAssignment, reopenCoverDay, setCoverAbsences, setCoverTeacherPolicy, validateAssignment, weekdayForDate, EMPTY_COVER_STORE } from '../src/cover-planning';

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
  it('excludes exempt teachers and ranks by balance before explicit priority', () => {
    const schedule = sample();
    let store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    store = setCoverTeacherPolicy(store, 'سالم', { carryInBalance: 3, priority: 5 });
    store = setCoverTeacherPolicy(store, 'نورة', { carryInBalance: 3, priority: 1 });
    expect(getCoverBalance(schedule, store, 'سالم')).toBe(3);
    expect(draftCandidates(schedule, store, date, schedule.lessons[0].id).slice(0, 2)).toEqual(['نورة', 'سالم']);
    store = setCoverTeacherPolicy(store, 'نورة', { exempt: true });
    expect(draftCandidates(schedule, store, date, schedule.lessons[0].id)).toEqual(['سالم']);
    const exemptAssignment = { id: 'manual', date, lessonId: schedule.lessons[0].id, absentTeacher: 'أحمد', substitute: 'نورة' };
    const withAssignment = { ...store, days: { ...store.days, [date]: { ...getCoverDay(store, date), assignments: [exemptAssignment] } } };
    expect(validateAssignment(schedule, withAssignment, exemptAssignment)).toMatch(/مستثنى/);
  });
  it('ranks equal-balance candidates by matching department, then by the fewest assignments today', () => {
    let schedule: Schedule = { teachers: ['أحمد', 'سالم', 'نورة', 'علي'], lessons: [], verifiedDays: [] };
    schedule = addLesson(schedule, { teacher: 'أحمد', day: 'الثلاثاء', period: 1, description: '10/1 فيزياء' });
    schedule = addLesson(schedule, { teacher: 'أحمد', day: 'الثلاثاء', period: 2, description: '10/2 فيزياء' });
    schedule = addLesson(schedule, { teacher: 'سالم', day: 'الخميس', period: 1, description: 'فيزياء' });
    schedule = addLesson(schedule, { teacher: 'نورة', day: 'الخميس', period: 1, description: 'علوم عامة' });
    schedule = addLesson(schedule, { teacher: 'علي', day: 'الخميس', period: 1, description: 'رياضيات' });
    for (const teacher of schedule.teachers) schedule = setDayVerification(schedule, teacher, 'الثلاثاء', true);
    let store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    const firstSlot = schedule.lessons.find((lesson) => lesson.teacher === 'أحمد' && lesson.period === 1)!;
    expect(draftCandidates(schedule, store, date, firstSlot.id).slice(0, 2)).toEqual(expect.arrayContaining(['نورة', 'سالم']));
    expect(draftCandidates(schedule, store, date, firstSlot.id)).not.toContain('علي');

    const secondSlot = schedule.lessons.find((lesson) => lesson.teacher === 'أحمد' && lesson.period === 2)!;
    store = addCoverAssignment(schedule, store, date, secondSlot.id, 'سالم');
    store = setCoverTeacherPolicy(store, 'نورة', { carryInBalance: 1 });
    store = setCoverTeacherPolicy(store, 'علي', { carryInBalance: 1 });
    expect(getCoverBalance(schedule, store, 'سالم')).toBe(getCoverBalance(schedule, store, 'نورة'));
    expect(draftCandidates(schedule, store, date, firstSlot.id)[0]).toBe('نورة');
  });
  it('keeps lowest total cover balance ahead of department preference', () => {
    let schedule: Schedule = { teachers: ['أحمد', 'سالم', 'علي'], lessons: [], verifiedDays: [] };
    schedule = addLesson(schedule, { teacher: 'أحمد', day: 'الثلاثاء', period: 1, description: '10/1 فيزياء' });
    schedule = addLesson(schedule, { teacher: 'سالم', day: 'الخميس', period: 1, description: 'فيزياء' });
    schedule = addLesson(schedule, { teacher: 'علي', day: 'الخميس', period: 1, description: 'رياضيات' });
    for (const teacher of schedule.teachers) schedule = setDayVerification(schedule, teacher, 'الثلاثاء', true);
    let store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    store = setCoverTeacherPolicy(store, 'سالم', { carryInBalance: 1 });
    expect(draftCandidates(schedule, store, date, schedule.lessons[0].id)[0]).toBe('علي');
  });
  it('automatically covers multiple absences without assigning one teacher twice in a period', () => {
    let schedule: Schedule = { teachers: ['أحمد', 'سالم', 'علي', 'ناصر', 'يوسف'], lessons: [], verifiedDays: [] };
    for (const teacher of ['أحمد', 'سالم', 'علي']) schedule = addLesson(schedule, { teacher, day: 'الثلاثاء', period: 1, description: 'علوم' });
    for (const teacher of schedule.teachers) schedule = setDayVerification(schedule, teacher, 'الثلاثاء', true);
    let store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد', 'سالم'], schedule);
    store = setCoverTeacherPolicy(store, 'ناصر', { carryInBalance: 2 });
    const result = autoAssignCovers(schedule, store, date);
    expect(result.blockedReason).toBeUndefined();
    expect(result.added).toHaveLength(2);
    expect(result.uncovered).toEqual([]);
    expect(result.added.map((assignment) => assignment.substitute)).toEqual(['يوسف', 'ناصر']);
    expect(new Set(result.added.map((assignment) => assignment.substitute)).size).toBe(2);
    expect(result.added.every((assignment) => validateAssignment(schedule, result.store, assignment) === null)).toBe(true);
  });
  it('leaves a slot uncovered when the only other available teacher is exempt', () => {
    let schedule: Schedule = { teachers: ['أحمد', 'سالم', 'علي', 'ناصر', 'يوسف'], lessons: [], verifiedDays: [] };
    for (const teacher of ['أحمد', 'سالم', 'علي']) schedule = addLesson(schedule, { teacher, day: 'الثلاثاء', period: 1, description: 'علوم' });
    for (const teacher of schedule.teachers) schedule = setDayVerification(schedule, teacher, 'الثلاثاء', true);
    let store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد', 'سالم'], schedule);
    store = setCoverTeacherPolicy(store, 'ناصر', { exempt: true });
    const result = autoAssignCovers(schedule, store, date);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].substitute).toBe('يوسف');
    expect(result.uncovered).toHaveLength(1);
    expect(getCoverDay(result.store, date).assignments.map((assignment) => assignment.substitute)).not.toContain('ناصر');
  });
  it('tracks a processed day, prevents accidental mutation, supports reopen and whole-day undo', () => {
    const schedule = sample();
    const absent = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    const withAssignment = addCoverAssignment(schedule, absent, date, schedule.lessons[0].id, 'سالم');
    const processed = processCoverDay(schedule, withAssignment, date, '2026-11-10T07:00:00.000Z');
    expect(getCoverDailySummary(schedule, processed, date)).toMatchObject({ absentCount: 1, required: 2, assigned: 1, uncovered: 1, invalid: 0, processedAt: '2026-11-10T07:00:00.000Z', bySubstitute: [['سالم', 1]] });
    expect(() => setCoverAbsences(processed, date, [], schedule)).toThrow(/أعد فتحه/);
    expect(autoAssignCovers(schedule, processed, date).blockedReason).toMatch(/أعد فتحه/);
    const reopened = reopenCoverDay(processed, date);
    expect(getCoverDay(reopened, date).processedAt).toBeUndefined();
    expect(getCoverDay(reopened, date).assignments).toHaveLength(1);
    expect(getCoverDay(clearCoverDay(processed, date), date)).toEqual({ absent: [], assignments: [] });
  });
  it('does not save daily processing while an absent teacher schedule is unverified', () => {
    const schedule = setDayVerification(sample(), 'أحمد', 'الثلاثاء', false);
    const store = setCoverAbsences(EMPTY_COVER_STORE, date, ['أحمد'], schedule);
    expect(() => processCoverDay(schedule, store, date)).toThrow(/تأكيد اكتمال جداول/);
  });

});
