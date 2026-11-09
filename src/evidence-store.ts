export const EVIDENCE_DB = 'nabd-al-injaz:evidence:v1';
export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export type Evidence = {
  id: string;
  planId: string;
  activityId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  note: string;
  blob: Blob;
};
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EVIDENCE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore('files', { keyPath: 'id' });
      store.createIndex('by_activity', 'activityId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (v: T) => void, reject: (e: Error) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    let result: T;
    let settled = false;
    const store = tx.objectStore('files');
    const set = (v: T) => {
      result = v;
      settled = true;
    };
    action(store, set, (e) => {
      reject(e);
      tx.abort();
    });
    tx.oncomplete = () => {
      db.close();
      if (settled) resolve(result);
      else reject(new Error('تعذّر إتمام حفظ الشاهد.'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('تعذّر الوصول إلى التخزين المحلي.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('أُلغي حفظ الشاهد.'));
    };
  });
}
export function validateEvidence(file: File): string | null {
  if (!EVIDENCE_TYPES.includes(file.type))
    return 'نوع الملف غير مدعوم. استخدم PDF أو JPG أو PNG أو DOCX أو XLSX.';
  if (file.size === 0 || file.size > EVIDENCE_MAX_BYTES)
    return 'يجب أن يكون حجم الشاهد أكبر من صفر ولا يتجاوز 8MB.';
  return null;
}
export function listEvidence(activityId: string): Promise<Evidence[]> {
  return transaction<Evidence[]>('readonly', (store, set) => {
    const r = store.index('by_activity').getAll(activityId);
    r.onsuccess = () => set(r.result as Evidence[]);
  });
}
export function saveEvidence(record: Evidence): Promise<void> {
  return transaction<void>('readwrite', (store, set) => {
    const r = store.put(record);
    r.onsuccess = () => set(undefined);
  });
}
export function removeEvidence(id: string): Promise<void> {
  return transaction<void>('readwrite', (store, set) => {
    const r = store.delete(id);
    r.onsuccess = () => set(undefined);
  });
}
export function countEvidence(activityId: string): Promise<number> {
  return transaction<number>('readonly', (store, set) => {
    const r = store.index('by_activity').count(activityId);
    r.onsuccess = () => set(r.result);
  });
}
export function deleteActivityEvidence(activityId: string): Promise<void> {
  return transaction<void>('readwrite', (store, set) => {
    const r = store.index('by_activity').openCursor(IDBKeyRange.only(activityId));
    r.onsuccess = () => {
      const cursor = r.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else set(undefined);
    };
  });
}
