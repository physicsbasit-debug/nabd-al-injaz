import { describe, expect, it } from 'vitest';
import type { Task } from '../src/task-model';
import {
  dashboardMetrics,
  isTaskOverdue,
  localDateKey,
  priorityTasks,
} from '../src/dashboard-metrics';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    dueDate: '',
    priority: 'عادية',
    done: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    category: 'أخرى',
    assignedTo: '',
    progress: 'لم تبدأ',
    notes: '',
    ...overrides,
  };
}

describe('executive dashboard metrics', () => {
  const today = '2026-11-09';

  it('counts overdue only for unfinished tasks before today', () => {
    expect(isTaskOverdue(task('yesterday', { dueDate: '2026-11-08' }), today)).toBe(true);
    expect(isTaskOverdue(task('today', { dueDate: today }), today)).toBe(false);
    expect(isTaskOverdue(task('future', { dueDate: '2026-11-10' }), today)).toBe(false);
    expect(isTaskOverdue(task('done', { dueDate: '2026-11-08', done: true }), today)).toBe(false);
    expect(isTaskOverdue(task('missing'), today)).toBe(false);
    expect(isTaskOverdue(task('invalid', { dueDate: '2026-02-30' }), today)).toBe(false);
  });

  it('uses actual task data for counts and percentage', () => {
    const tasks = [
      task('late', { dueDate: '2026-11-08', progress: 'قيد التنفيذ' }),
      task('urgent', { priority: 'عاجلة' }),
      task('done', { done: true, progress: 'مكتملة', dueDate: '2026-11-01' }),
      task('today', { dueDate: today }),
    ];
    expect(dashboardMetrics(tasks, today)).toEqual({
      total: 4,
      completed: 1,
      inProgress: 1,
      overdue: 1,
      urgentOpen: 1,
      percent: 25,
    });
    expect(dashboardMetrics([], today).percent).toBe(0);
  });

  it('orders overdue before urgent, then nearest date, without mutating saved order', () => {
    const tasks = [
      task('later', { dueDate: '2026-11-30' }),
      task('urgent', { priority: 'عاجلة', dueDate: '2026-11-25' }),
      task('late', { dueDate: '2026-11-08' }),
      task('soon', { dueDate: '2026-11-10' }),
      task('done', { done: true, dueDate: '2026-11-01' }),
    ];
    expect(priorityTasks(tasks, today).map((item) => item.id)).toEqual([
      'late',
      'urgent',
      'soon',
      'later',
    ]);
    expect(tasks.map((item) => item.id)[0]).toBe('later');
    expect(priorityTasks(tasks, today, 2)).toHaveLength(2);
  });

  it('generates local calendar dates without UTC day shifts', () => {
    expect(localDateKey(new Date(2026, 10, 9, 0, 15))).toBe('2026-11-09');
  });
});
