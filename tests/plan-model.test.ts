import { describe, expect, it } from 'vitest';
import {
  changeProgress,
  planStats,
  validDate,
  type Plan,
  type PlanActivity,
} from '../src/plan-model';
const activity = (id: string, overrides: Partial<PlanActivity> = {}): PlanActivity => ({
  id,
  title: id,
  details: '',
  assignee: '',
  dueDate: '',
  progress: 'not_started',
  completedAt: null,
  createdAt: '2026-11-09',
  ...overrides,
});
const plan = (activities: PlanActivity[]): Plan => ({
  id: 'p',
  title: 'خطة المادة',
  kind: 'خطة المادة',
  owner: '',
  periodStart: '',
  periodEnd: '',
  archived: false,
  createdAt: '2026-11-09',
  activities,
});
describe('plan progress rules', () => {
  it('does not fabricate a percentage when there are no activities', () =>
    expect(planStats(plan([]), '2026-11-09')).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      percent: null,
    }));
  it('counts completed and overdue separately, not due today', () => {
    const items = [
      activity('done', { progress: 'completed', dueDate: '2026-11-01' }),
      activity('late', { dueDate: '2026-11-08' }),
      activity('today', { dueDate: '2026-11-09', progress: 'in_progress' }),
      activity('no-date'),
    ];
    expect(planStats(plan(items), '2026-11-09')).toEqual({
      total: 4,
      completed: 1,
      inProgress: 1,
      overdue: 1,
      percent: 25,
    });
  });
  it('rejects impossible dates', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2026-11-09')).toBe(true);
  });
  it('records completion time and clears it on reopening', () => {
    const completed = changeProgress(activity('a'), 'completed', '2026-11-09T12:00:00Z');
    expect(completed.completedAt).toBe('2026-11-09T12:00:00Z');
    expect(changeProgress(completed, 'in_progress', '2026-11-10').completedAt).toBe(null);
  });
});
