import { describe, expect, it } from 'vitest';
import {
  compactVisit,
  hasUnsavedVisitChanges,
  isSupervisoryVisit,
  emptySupervisoryVisitForm,
  type SupervisoryVisit,
} from '../src/supervisory-visits-model';
import { analyzeVisits } from '../src/visit-analysis';
import { visitMethodRecords } from '../src/duty-records';

const visit = (over: Partial<SupervisoryVisit>): SupervisoryVisit => ({
  id: 'v',
  teacher: 'أحمد',
  date: '2026-11-10',
  status: 'completed',
  subject: '',
  grade: '',
  period: '',
  lesson: '',
  strengths: '',
  improvements: '',
  recommendations: '',
  followUp: '',
  planId: '',
  activityId: '',
  createdAt: '2026-11-10T06:00:00.000Z',
  ...over,
});

describe('visit method and indicators', () => {
  it('accepts optional method and indicator tags and rejects unknown or duplicate values', () => {
    expect(isSupervisoryVisit(visit({}))).toBe(true);
    expect(
      isSupervisoryVisit(
        visit({
          method: 'درس تطبيقي',
          strengthIndicators: ['التخطيط للدرس'],
          priorityIndicators: ['التقويم والتغذية الراجعة'],
        }),
      ),
    ).toBe(true);
    expect(isSupervisoryVisit(visit({ method: 'تفتيش' as never }))).toBe(false);
    expect(isSupervisoryVisit(visit({ strengthIndicators: ['الحضور' as never] }))).toBe(false);
    expect(
      isSupervisoryVisit(visit({ priorityIndicators: ['التخطيط للدرس', 'التخطيط للدرس'] })),
    ).toBe(false);
  });

  it('drops empty optional fields and tracks unsaved tag changes', () => {
    expect(
      compactVisit(visit({ method: undefined, strengthIndicators: [], priorityIndicators: [] })),
    ).toEqual(visit({}));
    const form = emptySupervisoryVisitForm();
    expect(hasUnsavedVisitChanges({ ...form, strengthIndicators: [] }, null)).toBe(false);
    expect(hasUnsavedVisitChanges({ ...form, priorityIndicators: ['التخطيط للدرس'] }, null)).toBe(
      true,
    );
    expect(hasUnsavedVisitChanges({ ...form, method: 'لقاء فردي' }, null)).toBe(true);
  });

  it('analyses methods, strengths and shared priorities within the period only', () => {
    const a = analyzeVisits(
      [
        visit({
          id: '1',
          method: 'زيارة صفية',
          strengthIndicators: ['إدارة البيئة التعليمية'],
          priorityIndicators: ['التقويم والتغذية الراجعة'],
        }),
        visit({
          id: '2',
          teacher: 'سالم',
          method: 'درس تطبيقي',
          priorityIndicators: ['التقويم والتغذية الراجعة', 'مراعاة الفروق الفردية'],
        }),
        visit({ id: '3', teacher: 'خالد', date: '2026-11-12' }),
        visit({
          id: '4',
          teacher: 'خالد',
          status: 'planned',
          priorityIndicators: ['التخطيط للدرس'],
        }),
        visit({ id: '5', date: '2026-10-01', priorityIndicators: ['التخطيط للدرس'] }),
      ],
      '2026-11-01',
      '2026-11-27',
    );
    expect(a.total).toBe(3);
    expect(a.tagged).toBe(2);
    expect(a.byMethod).toEqual([
      ['زيارة صفية', 1],
      ['درس تطبيقي', 1],
      ['غير محدد', 1],
    ]);
    expect(a.priorities[0]).toEqual(['التقويم والتغذية الراجعة', 2]);
    expect(a.sharedPriorities).toEqual([
      { indicator: 'التقويم والتغذية الراجعة', teachers: ['أحمد', 'سالم'] },
    ]);
  });

  it('counts applied lessons for duty 7 and any non-classroom method for duty 12', () => {
    const records = visitMethodRecords(
      [
        visit({ id: '1', method: 'درس تطبيقي' }),
        visit({ id: '2', method: 'زيارة صفية' }),
        visit({ id: '3', method: 'لقاء فردي', teacher: 'سالم' }),
        visit({ id: '4', method: 'قراءة موجهة', status: 'planned' }),
        visit({ id: '5', method: 'قراءة موجهة', date: '2026-12-30' }),
      ],
      '2026-11-27',
    );
    expect(records.map((r) => [r.dutyId, r.title])).toEqual([
      [7, 'درس تطبيقي: أحمد'],
      [12, 'درس تطبيقي: أحمد'],
      [12, 'لقاء فردي: سالم'],
    ]);
  });
});
