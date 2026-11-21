export type DriveBackup = { id:string; name:string; modifiedTime:string; size?:string };
const prefix='nabd-backup-';
const MAX_BYTES=128 * 1024 * 1024;
type Fetcher = typeof fetch;
function check(response:Response) { if (!response.ok) throw new Error(response.status === 401 ? 'انتهى اتصال Google؛ أعد الاتصال.' : 'تعذر الوصول إلى النسخ في Google Drive.'); }
export async function listDriveBackups(token:string, fetcher:Fetcher=fetch):Promise<DriveBackup[]> {
 const result:DriveBackup[]=[]; let pageToken='';
 do {
  const params=new URLSearchParams({spaces:'appDataFolder',q:`name contains '${prefix}' and trashed = false`,fields:'nextPageToken,files(id,name,modifiedTime,size)',pageSize:'100'});
  if(pageToken)params.set('pageToken',pageToken);
  const response=await fetcher('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+token}});check(response);
  const data=await response.json() as {files?:unknown;nextPageToken?:unknown};
  if(!Array.isArray(data.files))throw new Error('تعذرت قراءة قائمة النسخ.');
  for(const file of data.files) if(file && typeof file.id==='string' && typeof file.name==='string' && file.name.startsWith(prefix) && typeof file.modifiedTime==='string')result.push(file as DriveBackup);
  if(data.nextPageToken!==undefined&&typeof data.nextPageToken!=='string')throw new Error('تعذرت قراءة بقية النسخ.');
  pageToken=typeof data.nextPageToken==='string'?data.nextPageToken:'';
 }while(pageToken);
 return result.sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime));
}
export async function uploadDriveBackup(token:string, blob:Blob, fetcher:Fetcher=fetch):Promise<void> {
 if(blob.size>MAX_BYTES)throw new Error('حجم النسخة يتجاوز الحد المدعوم.');
 const boundary='nabd_'+crypto.randomUUID().replaceAll('-','');
 const name=prefix+new Date().toISOString().replaceAll(':','-')+'.json';
 const metadata=JSON.stringify({name,parents:['appDataFolder'],mimeType:'application/json'});
 const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,blob,`\r\n--${boundary}--`],{type:'multipart/related; boundary='+boundary});
 const response=await fetcher('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},body});check(response);
 const data=await response.json() as {id?:unknown}; if(typeof data.id!=='string'||!data.id)throw new Error('لم يُؤكد حفظ النسخة في Google Drive.');
}
export async function downloadDriveBackup(token:string, item:DriveBackup, fetcher:Fetcher=fetch):Promise<File> {
 if(item.size&&Number(item.size)>MAX_BYTES)throw new Error('حجم النسخة يتجاوز الحد المدعوم.');
 const response=await fetcher('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(item.id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});check(response);
 const size=Number(response.headers.get('Content-Length'));if(size>MAX_BYTES)throw new Error('حجم النسخة يتجاوز الحد المدعوم.');
 const blob=await response.blob(); if(blob.size>MAX_BYTES)throw new Error('حجم النسخة يتجاوز الحد المدعوم.');
 return new File([blob],item.name,{type:'application/json'});
}
