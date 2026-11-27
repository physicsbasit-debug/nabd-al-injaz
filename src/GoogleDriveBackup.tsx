import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createAppBackupBlob, restoreAppBackup } from './app-backup';
import { markBackupDone } from './backup-reminder';
import { listDriveBackups, uploadDriveBackup, downloadDriveBackup, type DriveBackup } from './drive-backup';
import type { Plan } from './plan-model';
import type { Task } from './task-model';

type TokenClient={requestAccessToken: (options?:{prompt?:string})=>void};
type GoogleApi={accounts:{oauth2:{initTokenClient:(config:{client_id:string;scope:string;callback:(reply:{access_token?:string;error?:string})=>void;error_callback:()=>void})=>TokenClient}}};
declare global { interface Window { google?:GoogleApi } }
const CLIENT_KEY='nabd-al-injaz:google-client-id:v1';
const scope='https://www.googleapis.com/auth/drive.appdata';
let scriptPromise:Promise<void>|null=null;
function loadGoogle():Promise<void>{
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>window.google?.accounts?.oauth2?resolve():reject(new Error('تعذر تحميل خدمة Google.'));
  script.onerror=()=>reject(new Error('تعذر تحميل خدمة Google. تحقق من الاتصال.'));
  document.head.appendChild(script);
 }).catch(error=>{scriptPromise=null;throw error});
 return scriptPromise!;
}
type Props={plans:Plan[];setPlans:Dispatch<SetStateAction<Plan[]>>;setTasks:Dispatch<SetStateAction<Task[]>>};
export default function GoogleDriveBackup({plans,setPlans,setTasks}:Props){
 const [client,setClient]=useState(()=>localStorage.getItem(CLIENT_KEY)||'');const [token,setToken]=useState('');const [backups,setBackups]=useState<DriveBackup[]|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{void loadGoogle().catch(()=>undefined)},[]);
 async function connect(){
  const value=client.trim();
  if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(value)){setMessage('أدخل معرّف عميل Google الصحيح.');return;}
  setBusy(true);setMessage('');setToken('');setBackups(null);
  try{
   await loadGoogle();
   const google=window.google;if(!google)throw new Error('تعذر تحميل خدمة Google.');
   google.accounts.oauth2.initTokenClient({client_id:value,scope,callback:reply=>{
    if(!reply.access_token){setMessage('لم يكتمل الاتصال بحساب Google.');setBusy(false);return;}
    localStorage.setItem(CLIENT_KEY,value);setToken(reply.access_token);
    void listDriveBackups(reply.access_token).then(setBackups).then(()=>setMessage('تم الاتصال. يمكنك حفظ نسخة أو اختيار نسخة لاستعادتها.')).catch((error:unknown)=>setMessage(error instanceof Error?error.message:'تعذر قراءة النسخ.')).finally(()=>setBusy(false));
   },error_callback:()=>{setMessage('أُغلق اتصال Google أو تعذر فتحه.');setBusy(false);}}).requestAccessToken({prompt:'consent'});
  }catch(error){setMessage(error instanceof Error?error.message:'تعذر الاتصال بحساب Google.');setBusy(false);}
 }
 async function upload(){if(!token)return;setBusy(true);setMessage('');try{const blob=await createAppBackupBlob(plans);await uploadDriveBackup(token,blob);markBackupDone();try{setBackups(await listDriveBackups(token));setMessage('حُفظت نسخة جديدة في Google Drive.');}catch{setBackups(null);setMessage('حُفظت النسخة، لكن تعذر تحديث قائمة النسخ. أعد الاتصال لعرضها.');}}catch(error){setMessage(error instanceof Error?error.message:'تعذر حفظ النسخة.');}finally{setBusy(false)}}
 async function restore(item:DriveBackup){
  if(!token||!window.confirm('ستستبدل النسخة المختارة بيانات هذا المتصفح وشواهده. نزّل نسخة محلية أولًا إذا كانت لديك تغييرات مهمة. هل تتابع؟'))return;
  setBusy(true);setMessage('');try{const file=await downloadDriveBackup(token,item);const restored=await restoreAppBackup(file);setTasks(restored.tasks);setPlans(restored.plans);setMessage('استُعيدت النسخة المختارة. أعد فتح الأقسام للاطلاع على البيانات.');}catch(error){setMessage(error instanceof Error?error.message:'تعذرت استعادة النسخة.');}finally{setBusy(false)}
 }
 return <details className="drive-backup"><summary>نسخ Google Drive</summary>
  <p>احفظ نسخة كاملة في مساحة التطبيق الخاصة بحسابك، ثم استعدها من جهاز آخر. الحفظ والاستعادة يدويان؛ لا توجد مزامنة تلقائية أو دمج للتغييرات.</p>
  <label>معرّف عميل Google للتطبيق<input type="text" value={client} onChange={e=>{setClient(e.target.value);setToken('');setBackups(null)}} placeholder="…apps.googleusercontent.com" autoComplete="off" disabled={busy}/></label>
  <button type="button" onClick={()=>void connect()} disabled={busy}>{busy?'جارٍ التنفيذ…':token?'إعادة الاتصال بـ Google':'الاتصال بـ Google'}</button>
  {token&&<><button type="button" disabled={busy} onClick={()=>void upload()}>حفظ نسخة جديدة على Google Drive</button><p>النسخ المحفوظة في مساحة التطبيق:</p>{backups===null?<p>لم تُحمّل قائمة النسخ.</p>:backups.length?<ul>{backups.map(item=><li key={item.id}><span dir="ltr">{item.modifiedTime.slice(0,10)} {item.modifiedTime.slice(11,16)} UTC</span> <button type="button" disabled={busy} onClick={()=>void restore(item)}>استعادة هذه النسخة</button></li>)}</ul>:<p>لا توجد نسخ محفوظة لهذا التطبيق في الحساب المتصل.</p>}</>}
  <small>تُحفظ كل عملية كنسخة جديدة. تحتاج إعداد Google للتطبيق مرة واحدة قبل الاتصال، ثم إدخال معرّف العميل في كل جهاز.</small>
  {message&&<p role="status">{message}</p>}
 </details>;
}
