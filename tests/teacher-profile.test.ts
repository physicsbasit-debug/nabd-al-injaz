import { describe, expect, it } from 'vitest';
import {
  buildTeacherProfiles,
  emptyTeacherStore,
  isTeacherStore,
  recordCheck,
  removeCheck,
  setTeacherNote,
  teacherNames,
  type ProfileInput,
} from '../src/teacher-profile-model';
import type { SupervisoryVisit } from '../src/supervisory-visits-model';

const visit = (over: Partial<SupervisoryVisit>): SupervisoryVisit => ({
  id: 'v',
  teacher: 'أحمد',
  date: '2026-11-10',
  status: 'completed',
  subject: 'فيزياء',
  grade: '10',
  period: '1',
  lesson: 'القوة',
  strengths: 'إدارة صف',
  improvements: 'التقويم الختامي',
  recommendations: '',
  followUp: '',
  planId: '',
  activityId: '',
  createdAt: '',
  ...over,
});

const base = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  today: '2026-11-27',
  scheduleTeachers: ['أحمد', 'سالم'],
  visits: [],
  programs: [],
  topics: [],
  assessments: [],
  reviews: [],
  plans: [],
  store: emptyTeacherStore(),
  ...over,
});

describe('teacher profiles', () => {
  it('collects names from every section and normalises spacing', () => {
    expect(
      teacherNames(
        base({
          visits: [visit({ teacher: ' أحمد  ' })],
          programs: [
            {
              id: 'p',
              title: 'ب',
              kind: 'ورشة' as never,
              date: '2026-11-01',
              period: '',
              presenter: '',
              notes: '',
              attendance: { 'خالد  سعيد': 'حاضر' },
              completed: true,
            },
          ],
        }),
      ),
    ).toEqual(['أحمد', 'خالد سعيد', 'سالم'].sort((a, b) => a.localeCompare(b, 'ar')));
  });

  it('builds visits, development, cover and alerts and sorts teachers needing attention first', () => {
    const profiles = buildTeacherProfiles(
      base({
        visits: [
          visit({ id: '1', date: '2026-09-01' }),
          visit({ id: '2', date: '2026-11-20', status: 'planned' }),
          visit({ id: '3', teacher: 'سالم', date: '2026-11-25' }),
        ],
        programs: [
          {
            id: 'a',
            title: 'التعلم النشط',
            kind: 'ورشة' as never,
            date: '2026-10-01',
            period: '',
            presenter: '',
            notes: '',
            attendance: { أحمد: 'غائب' },
            completed: true,
          },
          {
            id: 'b',
            title: 'التقويم',
            kind: 'ورشة' as never,
            date: '2026-11-01',
            period: '',
            presenter: '',
            notes: '',
            attendance: { أحمد: 'غائب', سالم: 'حاضر' },
            completed: true,
          },
        ],
        topics: [
          {
            id: 't',
            teacher: 'أحمد',
            grade: '10' as never,
            subject: 'فيزياء' as never,
            title: 'الحركة',
            plannedLessons: 6,
            taughtLessons: 3,
            targetDate: '2026-11-15',
          },
        ],
        cover: {
          version: 1,
          days: {
            '2026-11-02': {
              absent: ['أحمد'],
              assignments: [
                {
                  id: 'c',
                  date: '2026-11-02',
                  lessonId: 'l',
                  absentTeacher: 'أحمد',
                  substitute: 'سالم',
                },
              ],
            },
          },
        },
      }),
    );
    expect(profiles.map((p) => p.name)).toEqual(['أحمد', 'سالم']);
    const ahmad = profiles[0];
    expect(ahmad.visits.semesterCount).toBe(1);
    expect(ahmad.visits.daysSince).toBe(87);
    expect(ahmad.alerts).toEqual([
      'آخر زيارة قبل 87 يومًا',
      'زيارة مخططة فات موعدها',
      'غاب عن 2 برامج إنماء',
      'متأخر في 1 موضوع من المنهج',
    ]);
    expect(ahmad.curriculum).toMatchObject({ planned: 6, taught: 3 });
    expect(ahmad.cover).toEqual({ given: 0, absences: 1 });
    expect(profiles[1]).toMatchObject({
      alerts: [],
      cover: { given: 1, absences: 0 },
      development: { attended: ['التقويم'] },
    });
  });

  it('flags teachers with no visit this semester', () => {
    const [p] = buildTeacherProfiles(
      base({ scheduleTeachers: ['أحمد'], visits: [visit({ date: '2026-05-01' })] }),
    );
    expect(p.alerts).toContain('لم يُزر في الفصل الدراسي الأول');
  });

  it('keeps one check per kind per month and validates the store', () => {
    let store = recordCheck(
      emptyTeacherStore(),
      ' أحمد ',
      'سجلات',
      false,
      'ينقص سجل المتابعة',
      '2026-11-20',
      'x',
    );
    store = recordCheck(store, 'أحمد', 'سجلات', true, 'اكتمل', '2026-11-27', 'y');
    expect(store.checks).toEqual([
      { id: 'x', teacher: 'أحمد', kind: 'سجلات', date: '2026-11-27', ok: true, note: 'اكتمل' },
    ]);
    store = recordCheck(store, 'أحمد', 'سجلات', false, '', '2026-12-02', 'z');
    expect(store.checks).toHaveLength(2);
    const [profile] = buildTeacherProfiles(
      base({ today: '2026-12-02', scheduleTeachers: ['أحمد'], store }),
    );
    expect(profile.checks.سجلات?.id).toBe('z');
    expect(profile.alerts).toContain('فحص السجلات والملفات: يحتاج استكمالًا');
    expect(removeCheck(store, 'z').checks).toHaveLength(1);
    expect(setTeacherNote(store, 'أحمد', 'مبادرة القراءة').notes).toEqual({
      أحمد: 'مبادرة القراءة',
    });
    expect(setTeacherNote(setTeacherNote(store, 'أحمد', 'x'), 'أحمد', '  ').notes).toEqual({});
    expect(isTeacherStore(store)).toBe(true);
    expect(
      isTeacherStore({
        version: 1,
        notes: {},
        checks: [
          { id: 'a', teacher: 'أحمد', kind: 'أخرى', date: '2026-11-01', ok: true, note: '' },
        ],
      }),
    ).toBe(false);
  });
});
