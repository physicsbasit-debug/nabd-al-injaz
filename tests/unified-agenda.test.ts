import { describe, it, expect } from 'vitest';
import { buildAgenda } from '../src/unified-agenda';

describe('unified agenda', () => {
  it('classifies tasks, plan activities, visits and teacher follow-up without inventing dates', () => {
    const task = (id: string, dueDate: string, done = false) => ({ id, title: id, dueDate, done, priority: 'عادية' as const, createdAt: '', category: 'أخرى' as const, assignedTo: '', progress: (done ? 'مكتملة' : 'لم تبدأ') as 'مكتملة' | 'لم تبدأ', notes: '' });
    const result = buildAgenda({ today: '2026-11-17', tasks: [task('today', '2026-11-17'), task('late', '2026-11-16'), task('undated', ''), task('done', '', true), task('future', '2026-11-24')], plans: [], visits: [{ id: 'v', teacher: 'معلم', date: '2026-11-18', status: 'planned' } as never], topics: [{ id: 't', title: 'درس', teacher: 'معلم', targetDate: '2026-11-17', taughtLessons: 0, plannedLessons: 2 } as never], programs: [] });
    expect(result.today.map(x => x.id).sort()).toEqual(['task:today', 'topic:t']);
    expect(result.week.map(x => x.id)).toEqual(['visit:v']);
    expect(result.overdue.map(x => x.id)).toEqual(['task:late']);
    expect(result.undated.map(x => x.id)).toEqual(['task:undated']);
    expect(result.completed[0].completionDate).toBeNull();
  });
  it('keeps archived completed activities and excludes archived open activities', () => {
    const activity = (id: string, progress: 'completed' | 'not_started') => ({ id, title: id, details: '', assignee: '', dueDate: '', progress, completedAt: null, createdAt: '' });
    const plans = [{ id: 'p', title: 'خطة', kind: 'خطة أخرى' as const, owner: '', periodStart: '', periodEnd: '', archived: true, createdAt: '', activities: [activity('a', 'completed'), activity('b', 'not_started')] }];
    const result = buildAgenda({today: '2026-11-17', tasks: [], plans, visits: [], topics: [], programs: []});
    expect(result.completed.map(x => x.id)).toEqual(['activity:p:a']);
    expect(result.undated).toHaveLength(0);
  });
});
