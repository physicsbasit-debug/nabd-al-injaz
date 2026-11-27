import { describe, expect, it } from 'vitest';
import {
  activityDutyRecords,
  emptyActivitiesStore,
  isActivitiesStore,
  recordInventoryCheck,
  removeActivity,
  removeItem,
  saveActivity,
  saveItem,
} from '../src/activities-inventory-model';

const act = {
  kind: 'مسابقة أو برنامج' as const,
  title: ' مسابقة الفيزياء ',
  date: '2026-11-20',
  owner: 'سالم',
  participants: '12 طالبًا',
  notes: '',
};

describe('activities and inventory', () => {
  it('saves, edits and removes activities and maps each kind to its duty', () => {
    let store = saveActivity(
      emptyActivitiesStore(),
      act,
      undefined,
      '2026-11-20T06:00:00.000Z',
      'a',
    );
    store = saveActivity(
      store,
      { ...act, kind: 'فعالية مع البيت والمجتمع', title: 'لقاء أولياء الأمور', date: '2026-11-22' },
      undefined,
      '2026-11-22T06:00:00.000Z',
      'b',
    );
    expect(store.activities[0].title).toBe('مسابقة الفيزياء');
    store = saveActivity(store, { ...act, notes: 'المركز الثاني' }, 'a');
    expect(store.activities).toHaveLength(2);
    expect(store.activities[0]).toMatchObject({
      id: 'a',
      notes: 'المركز الثاني',
      createdAt: '2026-11-20T06:00:00.000Z',
    });
    expect(activityDutyRecords(store).map((r) => r.dutyId)).toEqual([20, 34]);
    expect(removeActivity(store, 'a').activities.map((a) => a.id)).toEqual(['b']);
    expect(() => saveActivity(store, { ...act, title: '  ' })).toThrow();
    expect(() => saveActivity(store, { ...act, date: '' })).toThrow();
  });

  it('records an inventory check snapshot once per day and counts it for duty 9', () => {
    let store = saveItem(
      emptyActivitiesStore(),
      { name: 'عربة ديناميكا', location: 'المختبر', quantity: 4, condition: 'صالح', notes: '' },
      undefined,
      'i1',
    );
    store = saveItem(
      store,
      { name: 'جهاز عرض', location: '', quantity: 1, condition: 'يحتاج صيانة', notes: '' },
      undefined,
      'i2',
    );
    expect(() =>
      saveItem(store, { name: 'x', location: '', quantity: -1, condition: 'صالح', notes: '' }),
    ).toThrow();
    store = recordInventoryCheck(store, '2026-11-27', 'جرد أول', 'c1');
    store = recordInventoryCheck(removeItem(store, 'i2'), '2026-11-27', 'بعد الإصلاح', 'c2');
    expect(store.checks).toEqual([
      { id: 'c1', date: '2026-11-27', items: 1, issues: 0, note: 'بعد الإصلاح' },
    ]);
    expect(activityDutyRecords(store)).toEqual([
      { dutyId: 9, date: '2026-11-27', title: 'جرد 1 صنفًا', section: 'الأنشطة والجرد' },
    ]);
    expect(isActivitiesStore(store)).toBe(true);
    expect(
      isActivitiesStore({ ...store, inventory: [{ ...store.inventory[0], condition: 'مفقود' }] }),
    ).toBe(false);
  });
});
