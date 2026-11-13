export const ASSESSMENT_DB = 'nabd-al-injaz:assessment-files:v1';
export const ASSESSMENT_MAX_BYTES = 8 * 1024 * 1024;
export const ASSESSMENT_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
export type AssessmentFile = { id: string; recordId: string; kind: 'اختبار' | 'تحليل'; name: string; mime: string; size: number; createdAt: string; blob: Blob };
type Entry = Omit<AssessmentFile, 'blob'> & { base64: string };
function isEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return ['id', 'recordId', 'name', 'mime', 'createdAt', 'base64'].every(k => typeof r[k] === 'string' && !!r[k]) &&
    (r.kind === 'اختبار' || r.kind === 'تحليل') && ASSESSMENT_MIMES.includes(String(r.mime)) &&
    Number.isInteger(r.size) && Number(r.size) > 0 && Number(r.size) <= ASSESSMENT_MAX_BYTES;
}
export async function createAssessmentArchive(records: AssessmentFile[]): Promise<Entry[]> {
  return Promise.all(records.map(async ({blob, ...r}) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length !== r.size || !ASSESSMENT_MIMES.includes(r.mime) || !r.size || r.size > ASSESSMENT_MAX_BYTES) throw new Error('ملف اختبار غير صالح؛ لم تُنشأ النسخة.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const entry = {...r, base64: btoa(binary)};
    if (!isEntry(entry)) throw new Error('بيانات ملف الاختبار غير صالحة.');
    return entry;
  }));
}
export function decodeAssessmentArchive(raw: unknown): AssessmentFile[] {
  if (!Array.isArray(raw) || raw.length > 1000) throw new Error('ملفات الاختبارات في النسخة غير صالحة.');
  const ids = new Set<string>();
  return raw.map(value => {
    if (!isEntry(value) || ids.has(value.id)) throw new Error('ملف اختبار غير صالح في النسخة.');
    ids.add(value.id);
    let binary: string;
    try { binary = atob(value.base64); } catch { throw new Error('تعذر قراءة ملف اختبار من النسخة.'); }
    if (binary.length !== value.size || btoa(binary) !== value.base64) throw new Error('حجم ملف الاختبار أو ترميزه غير صالح.');
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const record = {id:value.id, recordId:value.recordId, kind:value.kind, name:value.name, mime:value.mime, size:value.size, createdAt:value.createdAt};
    return {...record, blob: new Blob([bytes], { type: value.mime })};
  });
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(ASSESSMENT_DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('files', { keyPath:'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore, set: (x:T)=>void) => void): Promise<T> {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('files', mode); let result: T;
    action(tx.objectStore('files'), value => {result = value;});
    tx.oncomplete = () => {db.close(); resolve(result);};
    tx.onerror = () => {db.close(); reject(tx.error ?? new Error('تعذر تخزين ملفات الاختبارات.'));};
    tx.onabort = () => {db.close(); reject(tx.error ?? new Error('أُلغي حفظ الملفات.'));};
  });
}
export function listAssessmentFiles(): Promise<AssessmentFile[]> {
  return run('readonly', (s, set) => { const q=s.getAll(); q.onsuccess=()=>set(q.result as AssessmentFile[]); });
}
export function saveAssessmentFile(file: AssessmentFile): Promise<void> {
  return run('readwrite', (s,set) => {s.put(file); set(undefined);});
}
export function deleteAssessmentFile(id: string): Promise<void> {
  return run('readwrite', (s,set) => {s.delete(id); set(undefined);});
}
export function replaceAssessmentFiles(files: AssessmentFile[]): Promise<void> {
  return run('readwrite', (s,set) => {s.clear(); for (const file of files) s.put(file); set(undefined);});
}
