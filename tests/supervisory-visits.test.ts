import { describe, expect, it, vi, afterEach } from 'vitest';
import { emptySupervisoryVisitForm, hasUnsavedVisitChanges, isFutureCompletedVisit, isSupervisoryVisit, readSupervisoryVisits, summarizeTeacherVisits } from '../src/supervisory-visits-model';
import { createVisitArchive, decodeVisitArchive } from '../src/supervisory-visit-files';
import { projectedBackupBytes, assertVisitBackupCapacity } from '../src/backup-capacity';

const visit = {
  id: 'visit-1', teacher: 'معلم تجريبي', date: '2026-11-16', status: 'completed' as const,
  subject: 'فيزياء', grade: '10', period: '2', lesson: 'القوى',
  strengths: '', improvements: '', recommendations: '', followUp: '',
  planId: 'plan-1', activityId: 'activity-1', createdAt: '2026-11-16T08:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('supervisory visit records', () => {
  it('accepts a linked or independent visit and rejects incomplete links and invalid dates', () => {
    expect(isSupervisoryVisit(visit)).toBe(true);
    expect(isSupervisoryVisit({ ...visit, planId: '', activityId: '' })).toBe(true);
    expect(isSupervisoryVisit({ ...visit, status: 'planned', subject: '', grade: '', period: '', planId: '', activityId: '' })).toBe(true);
    expect(isSupervisoryVisit({ ...visit, section: '2' })).toBe(true);
    expect(isSupervisoryVisit({ ...visit, section: 'x'.repeat(101) })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, activityId: '' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, date: '2026-02-30' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, teacher: '  ' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, status: 'planned', date: '' })).toBe(true);
    expect(isSupervisoryVisit({ ...visit, status: 'completed', date: '' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, documentation: 'تم توثيق الزيارة' })).toBe(true);
  });

  it('summarizes teachers by completed visits without assuming unsaved visits occurred', () => {
    const rows = summarizeTeacherVisits(['أحمد', 'سالم', 'أحمد'], [
      { ...visit, id: 'v1', teacher: 'أحمد', date: '2026-10-01', status: 'completed' },
      { ...visit, id: 'v2', teacher: 'أحمد', date: '2026-11-16', status: 'completed' },
      { ...visit, id: 'v3', teacher: 'سالم', date: '', status: 'planned' },
      { ...visit, id: 'v4', teacher: 'ناصر', date: '2026-11-01', status: 'completed' },
      { ...visit, id: 'v5', teacher: 'سالم', date: '2027-01-01', status: 'completed' },
    ], '2026-11-16');
    expect(rows).toEqual([
      { teacher: 'أحمد', completedCount: 2, lastVisit: '2026-11-16', futureCount: 0 },
      { teacher: 'سالم', completedCount: 0, lastVisit: null, futureCount: 1 },
      { teacher: 'ناصر', completedCount: 1, lastVisit: '2026-11-01', futureCount: 0 },
    ]);
  });

  it('matches harmless whitespace differences without creating two teacher rows', () => {
    expect(summarizeTeacherVisits(['أحمد محمد'], [{ ...visit, teacher: 'أحمد  محمد', status: 'completed' }], '2026-11-16')).toEqual([
      { teacher: 'أحمد محمد', completedCount: 1, lastVisit: '2026-11-16', futureCount: 0 },
    ]);
  });

  it('flags completed visits dated after today while retaining them as valid stored records', () => {
    const future = { ...visit, date: '2027-01-01' };
    expect(isSupervisoryVisit(future)).toBe(true);
    expect(isFutureCompletedVisit(future, '2026-11-16')).toBe(true);
    expect(isFutureCompletedVisit({ ...future, status: 'planned' }, '2026-11-16')).toBe(false);
  });

  it('refuses corrupt stored records rather than overwriting them with an empty list', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad' });
    expect(() => readSupervisoryVisits()).toThrow();
  });

  it('detects an unfinished new visit or a changed saved visit before replacing the form', () => {
    expect(hasUnsavedVisitChanges(emptySupervisoryVisitForm(), null)).toBe(false);
    expect(hasUnsavedVisitChanges({ ...emptySupervisoryVisitForm(), teacher: 'معلم تجريبي' }, null)).toBe(true);
    expect(hasUnsavedVisitChanges(visit, visit)).toBe(false);
    expect(hasUnsavedVisitChanges({ ...visit, recommendations: 'متابعة' }, visit)).toBe(true);
  });
});

describe('visit evidence archives', () => {
  it('round-trips file content and rejects a corrupted archive', async () => {
    const blob = new Blob(['proof'], { type: 'application/pdf' });
    const archive = await createVisitArchive([{ id: 'file-1', recordId: 'visit-1', kind: 'شاهد', name: 'proof.pdf', mime: 'application/pdf', size: blob.size, createdAt: '2026-11-16T08:00:00.000Z', blob }]);
    const restored = decodeVisitArchive(archive);
    expect(await restored[0].blob.text()).toBe('proof');
    expect(() => decodeVisitArchive([{ ...archive[0], base64: 'AA==' }])).toThrow();
    expect(() => decodeVisitArchive([archive[0], archive[0]])).toThrow();
  });
  it('counts Arabic metadata and encoded attachments before allowing a backup to exceed its limit', () => {
    const stub = { files: [{ name: 'شاهد.pdf', base64: '' }, { name: 'ثاني.pdf', base64: '' }] };
    const actual = { files: [{ name: 'شاهد.pdf', base64: 'YWJjZGU=' }, { name: 'ثاني.pdf', base64: 'eA==' }] };
    const size = projectedBackupBytes(stub, [5, 1]);
    expect(size).toBe(new Blob([JSON.stringify(actual)]).size);
    expect(() => assertVisitBackupCapacity(size, size, 2)).not.toThrow();
    expect(() => assertVisitBackupCapacity(size + 1, size, 2)).toThrow();
    expect(() => assertVisitBackupCapacity(1, size, 1001)).toThrow();
  });
});
