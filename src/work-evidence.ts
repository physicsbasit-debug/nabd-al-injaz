import { VISIT_MAX_BYTES, VISIT_MIMES } from './supervisory-visit-files';
export type WorkEvidence = {id:string;ownerType:'task'|'topic';ownerId:string;name:string;mime:string;size:number;createdAt:string;blob:Blob};
type Entry=Omit<WorkEvidence,'blob'> & {base64:string};
function validEntry(x:unknown):x is Entry {
  if(!x || typeof x!=='object' || Array.isArray(x)) return false;
  const v=x as Record<string,unknown>;
  return ['id','ownerId','name','mime','createdAt','base64'].every(k=>typeof v[k]==='string' && !!v[k]) && (v.ownerType==='task'||v.ownerType==='topic') && VISIT_MIMES.includes(String(v.mime)) && Number.isInteger(v.size) && Number(v.size)>0 && Number(v.size)<=VISIT_MAX_BYTES;
}
export async function encodeWorkEvidence(records:WorkEvidence[]):Promise<Entry[]> {
  return Promise.all(records.map(async ({blob,...row})=>{
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(bytes.length!==row.size) throw new Error('حجم شاهد العمل غير صالح.');
    let binary='';for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const entry={...row,base64:btoa(binary)};
    if(!validEntry(entry)) throw new Error('بيانات شاهد العمل غير صالحة.');
    return entry;
  }));
}
export function decodeWorkEvidence(raw:unknown):WorkEvidence[] {
  if(!Array.isArray(raw)||raw.length>1000) throw new Error('شواهد الأعمال في النسخة غير صالحة.');
  const ids=new Set<string>();return raw.map(value=>{
    if(!validEntry(value)||ids.has(value.id)) throw new Error('شاهد عمل غير صالح في النسخة.');
    ids.add(value.id);let binary:string;try{binary=atob(value.base64)}catch{throw new Error('تعذر قراءة شاهد العمل.');}
    if(binary.length!==value.size||btoa(binary)!==value.base64) throw new Error('حجم شاهد العمل غير صالح.');
    const {base64:_,...record}=value;void _;
    return {...record,blob:new Blob([Uint8Array.from(binary,ch=>ch.charCodeAt(0))],{type:value.mime})};
  });
}
const DB='nabd-al-injaz:work-evidence:v1';
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function run<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore,set:(value:T)=>void)=>void):Promise<T>{const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);let result:T;action(tx.objectStore('files'),v=>{result=v});tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)};});}
export function listWorkEvidence():Promise<WorkEvidence[]>{return run('readonly',(s,set)=>{const r=s.getAll();r.onsuccess=()=>set(r.result as WorkEvidence[])});}
export function saveWorkEvidence(file:WorkEvidence):Promise<void>{return run('readwrite',(s,set)=>{s.put(file);set(undefined)});}
export function deleteWorkEvidence(id:string):Promise<void>{return run('readwrite',(s,set)=>{s.delete(id);set(undefined)});}
export function replaceWorkEvidence(files:WorkEvidence[]):Promise<void>{return run('readwrite',(s,set)=>{s.clear();for(const file of files)s.put(file);set(undefined)});}
