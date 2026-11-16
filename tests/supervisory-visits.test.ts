import { describe, expect, it, vi, afterEach } from 'vitest';
import { isSupervisoryVisit, readSupervisoryVisits } from '../src/supervisory-visits-model';
import { createVisitArchive, decodeVisitArchive } from '../src/supervisory-visit-files';

const visit = {
  id: 'visit-1', teacher: 'معلم تجريبي', date: '2026-11-16', status: 'completed',
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
    expect(isSupervisoryVisit({ ...visit, activityId: '' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, date: '2026-02-30' })).toBe(false);
    expect(isSupervisoryVisit({ ...visit, teacher: '  ' })).toBe(false);
  });

  it('refuses corrupt stored records rather than overwriting them with an empty list', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad' });
    expect(() => readSupervisoryVisits()).toThrow();
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
});
