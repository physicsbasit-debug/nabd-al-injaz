import { beforeEach, describe, expect, it } from 'vitest';
import { daysSinceBackup, markBackupDone } from '../src/backup-reminder';

describe('backup reminder', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });
  it('reports days since the last successful backup', () => {
    expect(daysSinceBackup()).toBeNull();
    markBackupDone('2026-11-20T08:00:00.000Z');
    expect(daysSinceBackup(new Date('2026-11-27T09:00:00.000Z'))).toBe(7);
    expect(daysSinceBackup(new Date('2026-11-20T10:00:00.000Z'))).toBe(0);
  });
});
