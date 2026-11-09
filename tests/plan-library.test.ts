import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_STORAGE_KEY,
  changeActivityProgress,
  newActivity,
  newPlan,
  planStats,
  readPlans,
} from '../src/plan-model';

describe('independent plan tracking', () => {
  const today = '2026-11-09';
  const plan = () =>
    newPlan({
      title: 'خطة المادة',
      kind: 'خطة المادة',
      owner: 'المعلم الأول',
      periodStart: '',
      periodEnd: '',
    });

  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it('does not invent a percentage when no activities are approved', () => {
    expect(planStats(plan(), today)).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      percent: null,
    });
  });

  it('calculates independent counts and distinguishes overdue from today', () => {
    const a = newActivity({ title: 'زيارة 1', details: '', assignee: '', dueDate: '2026-11-08' });
    const b = newActivity({ title: 'زيارة 2', details: '', assignee: '', dueDate: '2026-11-09' });
    const c = changeActivityProgress(
      newActivity({ title: 'زيارة 3', details: '', assignee: '', dueDate: '2026-11-01' }),
      'completed',
      '2026-11-09T09:00:00Z',
    );
    const first = { ...plan(), activities: [a, b, c] };
    const second = plan();
    expect(planStats(first, today)).toEqual({
      total: 3,
      completed: 1,
      inProgress: 0,
      overdue: 1,
      percent: 33,
    });
    expect(planStats(second, today).percent).toBeNull();
  });

  it('keeps completedAt only for a completed activity', () => {
    const a = newActivity({ title: 'نشاط', details: '', assignee: '', dueDate: '' });
    const completed = changeActivityProgress(a, 'completed', '2026-11-09T09:00:00Z');
    expect(completed.completedAt).toBe('2026-11-09T09:00:00Z');
    expect(
      changeActivityProgress(completed, 'in_progress', '2026-11-10T09:00:00Z').completedAt,
    ).toBeNull();
  });

  it('reads valid local plans and ignores malformed data', () => {
    expect(readPlans()).toEqual([]);
    localStorage.setItem(PLAN_STORAGE_KEY, '{broken');
    expect(readPlans()).toEqual([]);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify([{ title: 'no id' }, plan()]));
    expect(readPlans()).toHaveLength(1);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ unexpected: true }));
    expect(readPlans()).toEqual([]);
  });

  it('retains manually created plans and archived flags after reloading', () => {
    const original = { ...plan(), archived: true };
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify([original]));
    expect(readPlans()[0]).toMatchObject({
      title: original.title,
      archived: true,
      kind: 'خطة المادة',
    });
  });
});
