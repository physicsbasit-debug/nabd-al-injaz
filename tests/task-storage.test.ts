import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTasks, STORAGE_KEY } from '../src/TaskManager';

describe('local task storage', () => {
  const values = new Map<string, string>();

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

  it('keeps valid tasks and rejects invalid entries', () => {
    const valid = {
      id: 'task-1',
      title: 'متابعة تنفيذ المنهج',
      dueDate: '2026-11-15',
      priority: 'عادية',
      done: false,
      createdAt: '2026-11-09T00:00:00.000Z',
    };
    values.set(STORAGE_KEY, JSON.stringify([valid, { ...valid, priority: 'غير معروفة' }, null]));
    expect(readTasks()).toEqual([valid]);
  });
});
