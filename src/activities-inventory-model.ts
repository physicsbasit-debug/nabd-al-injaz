export const ACTIVITIES_INVENTORY_KEY = 'nabd-al-injaz:activities-inventory:v1';

/** كل نوع نشاط يُحتسب لواجبه في روتين الواجبات. */
export const ACTIVITY_KINDS = [
  { kind: 'متابعة أنشطة الطلبة', duty: 13, hint: 'عينة من الأنشطة الصفية واللاصفية والتغذية الراجعة' },
  { kind: 'جماعة علمية', duty: 19, hint: 'اجتماع الجماعة أو نشاطها أو استشارة لأخصائي الأنشطة' },
  { kind: 'مسابقة أو برنامج', duty: 20, hint: 'مسابقة أو دراسة أو برنامج مدرسي مرتبط بالمادة' },
  { kind: 'فعالية مع البيت والمجتمع', duty: 34, hint: 'تواصل أو فعالية مع أولياء الأمور أو المجتمع المحلي' },
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]['kind'];
export const ITEM_CONDITIONS = ['صالح', 'يحتاج صيانة', 'تالف', 'ناقص'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export type ActivityEntry = { id: string; kind: ActivityKind; title: string; date: string; owner: string; participants: string; notes: string; createdAt: string };
export type InventoryItem = { id: string; name: string; location: string; quantity: number; condition: ItemCondition; notes: string };
export type InventoryCheck = { id: string; date: string; items: number; issues: number; note: string };
export type ActivitiesInventoryStore = { version: 1; activities: ActivityEntry[]; inventory: InventoryItem[]; checks: InventoryCheck[] };

export const emptyActivitiesStore = (): ActivitiesInventoryStore => ({ version: 1, activities: [], inventory: [], checks: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const id = (v: unknown) => str(v, 100) && !!(v as string);

export function isActivityEntry(v: unknown): v is ActivityEntry {
  return (
    isRecord(v) && id(v.id) && ACTIVITY_KINDS.some((k) => k.kind === v.kind) && str(v.title, 300) && !!(v.title as string).trim() && day(v.date) &&
    str(v.owner, 300) && str(v.participants, 1000) && str(v.notes, 2000) && typeof v.createdAt === 'string' && !Number.isNaN(Date.parse(v.createdAt))
  );
}
export function isInventoryItem(v: unknown): v is InventoryItem {
  return (
    isRecord(v) && id(v.id) && str(v.name, 300) && !!(v.name as string).trim() && str(v.location, 200) &&
    Number.isInteger(v.quantity) && (v.quantity as number) >= 0 && (v.quantity as number) <= 100000 &&
    ITEM_CONDITIONS.includes(v.condition as ItemCondition) && str(v.notes, 1000)
  );
}
export function isInventoryCheck(v: unknown): v is InventoryCheck {
  return isRecord(v) && id(v.id) && day(v.date) && Number.isInteger(v.items) && Number.isInteger(v.issues) && str(v.note, 1000);
}
export function isActivitiesStore(v: unknown): v is ActivitiesInventoryStore {
  if (!isRecord(v) || v.version !== 1 || !Array.isArray(v.activities) || !Array.isArray(v.inventory) || !Array.isArray(v.checks)) return false;
  const unique = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id)).size === rows.length;
  return (
    v.activities.every(isActivityEntry) && v.inventory.every(isInventoryItem) && v.checks.every(isInventoryCheck) &&
    unique(v.activities as ActivityEntry[]) && unique(v.inventory as InventoryItem[]) && unique(v.checks as InventoryCheck[])
  );
}

export function readActivitiesStore(): ActivitiesInventoryStore {
  const raw = localStorage.getItem(ACTIVITIES_INVENTORY_KEY);
  if (!raw) return emptyActivitiesStore();
  const data: unknown = JSON.parse(raw);
  if (!isActivitiesStore(data)) throw new Error('تعذر قراءة سجل الأنشطة والجرد؛ لم تتغير بياناتك.');
  return data;
}
export function writeActivitiesStore(store: ActivitiesInventoryStore) {
  localStorage.setItem(ACTIVITIES_INVENTORY_KEY, JSON.stringify(store));
}

const uid = () => crypto.randomUUID();

export function saveActivity(store: ActivitiesInventoryStore, input: Omit<ActivityEntry, 'id' | 'createdAt'>, editingId?: string, now = new Date().toISOString(), newId = uid()): ActivitiesInventoryStore {
  const existing = editingId ? store.activities.find((a) => a.id === editingId) : undefined;
  const entry: ActivityEntry = {
    ...input,
    title: input.title.trim(),
    owner: input.owner.trim(),
    participants: input.participants.trim(),
    notes: input.notes.trim(),
    id: existing?.id ?? newId,
    createdAt: existing?.createdAt ?? now,
  };
  if (!isActivityEntry(entry)) throw new Error('أدخل عنوان النشاط وتاريخه.');
  return { ...store, activities: existing ? store.activities.map((a) => (a.id === existing.id ? entry : a)) : [...store.activities, entry] };
}
export const removeActivity = (store: ActivitiesInventoryStore, activityId: string): ActivitiesInventoryStore => ({
  ...store,
  activities: store.activities.filter((a) => a.id !== activityId),
});

export function saveItem(store: ActivitiesInventoryStore, input: Omit<InventoryItem, 'id'>, editingId?: string, newId = uid()): ActivitiesInventoryStore {
  const item: InventoryItem = { ...input, name: input.name.trim(), location: input.location.trim(), notes: input.notes.trim(), id: editingId ?? newId };
  if (!isInventoryItem(item)) throw new Error('أدخل اسم الوسيلة وعددًا صحيحًا.');
  return { ...store, inventory: editingId ? store.inventory.map((i) => (i.id === editingId ? item : i)) : [...store.inventory, item] };
}
export const removeItem = (store: ActivitiesInventoryStore, itemId: string): ActivitiesInventoryStore => ({
  ...store,
  inventory: store.inventory.filter((i) => i.id !== itemId),
});

/** يعتمد جرد اليوم: يحفظ لقطة بعدد الأصناف والملاحظات، ويحدّث جرد اليوم إن وُجد. */
export function recordInventoryCheck(store: ActivitiesInventoryStore, today: string, note = '', newId = uid()): ActivitiesInventoryStore {
  const existing = store.checks.find((c) => c.date === today);
  const check: InventoryCheck = {
    id: existing?.id ?? newId,
    date: today,
    items: store.inventory.length,
    issues: store.inventory.filter((i) => i.condition !== 'صالح').length,
    note: note.trim().slice(0, 1000),
  };
  return { ...store, checks: [...store.checks.filter((c) => c !== existing), check].sort((a, b) => b.date.localeCompare(a.date)) };
}

export type DutyRecordLike = { dutyId: number; date: string; title: string; section: string };
export function activityDutyRecords(store: ActivitiesInventoryStore): DutyRecordLike[] {
  return [
    ...store.activities.map((a) => ({ dutyId: ACTIVITY_KINDS.find((k) => k.kind === a.kind)!.duty, date: a.date, title: `${a.kind}: ${a.title}`, section: 'الأنشطة والجرد' })),
    ...store.checks.map((c) => ({ dutyId: 9, date: c.date, title: `جرد ${c.items} صنفًا`, section: 'الأنشطة والجرد' })),
  ];
}
