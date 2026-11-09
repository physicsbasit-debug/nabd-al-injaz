import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTasks, STORAGE_KEY } from '../src/TaskManager';
import { setTaskProgress, taskCounts, toggleTaskCompletion, type Task } from '../src/task-model';

describe('local task storage', () => {
  const values = new Map<string, string>();
  const legacy = {
    id: 'task-1',
    title: 'متابعة تنفيذ المنهج',
    dueDate: '2026-11-15',
    priority: 'عادية',
    done: false,
    createdAt: '2026-11-09T00:00:00.000Z',
  };

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list when nothing is saved', () => {
    expect(readTasks()).toEqual([]);
  });

  it('rejects malformed JSON and non-array values', () => {
    values.set(STORAGE_KEY, '{invalid');
    expect(readTasks()).toEqual([]);
    values.set(STORAGE_KEY, '{}');
    expect(readTasks()).toEqual([]);
  });

  it('migrates existing tasks without losing the original fields', () => {
    values.set(STORAGE_KEY, JSON.stringify([legacy, { ...legacy, priority: 'غير معروفة' }, null]));
    expect(readTasks()).toEqual([
      { ...legacy, category: 'أخرى', assignedTo: '', progress: 'لم تبدأ', notes: '' },
    ]);
  });

  it('keeps valid educational task details and normalizes conflicting progress', () => {
    values.set(
      STORAGE_KEY,
      JSON.stringify([
        {
          ...legacy,
          category: 'متابعة فنية',
          assignedTo: 'فريق العلوم',
          progress: 'قيد التنفيذ',
          notes: 'مراجعة الخطة',
        },
        { ...legacy, id: 'task-2', done: true, progress: 'قيد التنفيذ' },
      ]),
    );
    expect(readTasks()).toEqual([
      {
        ...legacy,
        category: 'متابعة فنية',
        assignedTo: 'فريق العلوم',
        progress: 'قيد التنفيذ',
        notes: 'مراجعة الخطة',
      },
      {
        ...legacy,
        id: 'task-2',
        done: true,
        category: 'أخرى',
        assignedTo: '',
        progress: 'مكتملة',
        notes: '',
      },
    ]);
  });

  it('keeps completed status and checkbox completion in sync', () => {
    const task = {
      ...legacy,
      category: 'أخرى',
      assignedTo: '',
      progress: 'قيد التنفيذ',
      notes: '',
    } as Task;
    const completed = setTaskProgress(task, 'مكتملة');
    expect(completed.done).toBe(true);
    expect(completed.progress).toBe('مكتملة');
    const reopened = toggleTaskCompletion(completed);
    expect(reopened.done).toBe(false);
    expect(reopened.progress).toBe('لم تبدأ');
    expect(taskCounts([task, completed, reopened])).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
    });
  });
});
