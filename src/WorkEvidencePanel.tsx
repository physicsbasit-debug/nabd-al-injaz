import { useEffect, useState } from 'react';
import './work-evidence.css';
import { readPlans } from './plan-model';
import { readTasks } from './task-model';
import { readTechnicalTopics } from './technical-followup-model';
import { withAssessmentLock } from './assessment-lock';
import { ensureWorkEvidenceFitsBackup } from './app-backup';
import { deleteWorkEvidence, listWorkEvidence, saveWorkEvidence, type WorkEvidence } from './work-evidence';
import { VISIT_MAX_BYTES, VISIT_MIMES } from './supervisory-visit-files';

type Props={ownerType:'task'|'topic';ownerId:string;title:string};
export default function WorkEvidencePanel({ownerType,ownerId,title}:Props){
 const [files,setFiles]=useState<WorkEvidence[]|null>(null); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
 async function refresh(){setFiles((await listWorkEvidence()).filter(f=>f.ownerType===ownerType&&f.ownerId===ownerId));}
 useEffect(()=>{let active=true;listWorkEvidence().then(x=>{if(active)setFiles(x.filter(f=>f.ownerType===ownerType&&f.ownerId===ownerId))}).catch(()=>{if(active)setMessage('تعذر قراءة الشواهد.')});return()=>{active=false}},[ownerType,ownerId]);
 async function add(file?:File){if(!file)return;const extensions:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};const mime=file.type||extensions[file.name.split('.').pop()?.toLowerCase()??'']||'';if(!VISIT_MIMES.includes(mime)||file.size<1||file.size>VISIT_MAX_BYTES){setMessage('اختر PDF أو صورة أو Word أو Excel بحجم لا يتجاوز 8MB.');return;}setBusy(true);setMessage('');try{await withAssessmentLock(async()=>{const exists=ownerType==='task'?readTasks().some(t=>t.id===ownerId):readTechnicalTopics().some(t=>t.id===ownerId);if(!exists)throw new Error('العمل لم يعد موجودًا.');const record:WorkEvidence={id:crypto.randomUUID(),ownerType,ownerId,name:file.name,mime,size:file.size,createdAt:new Date().toISOString(),blob:file};await ensureWorkEvidenceFitsBackup(readPlans(),record);await saveWorkEvidence(record);});await refresh();setMessage('حُفظ الشاهد في هذا المتصفح.');}catch(e){setMessage(e instanceof Error?e.message:'تعذر حفظ الشاهد.');}finally{setBusy(false)}}
 async function remove(file:WorkEvidence){if(!window.confirm('حذف هذا الشاهد من الجهاز؟'))return;setBusy(true);try{await withAssessmentLock(()=>deleteWorkEvidence(file.id));await refresh();setMessage('حُذف الشاهد.');}catch{setMessage('تعذر حذف الشاهد.')}finally{setBusy(false)}}
 function download(file:WorkEvidence){const url=URL.createObjectURL(file.blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 return <details className="work-evidence"><summary>شواهد {title}</summary><p>{files===null?'جارٍ قراءة الشواهد':files.length?`${files.length} شاهد مرفق`:'لم يُرفق شاهد بعد'}</p>{files?.map(f=><div className="work-evidence-file" key={f.id}><span>{f.name}</span><button type="button" onClick={()=>download(f)}>تنزيل</button><button type="button" disabled={busy} onClick={()=>void remove(f)}>حذف الشاهد</button></div>)}<label>إرفاق شاهد<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';void add(file)}} /></label>{message&&<p role="status">{message}</p>}</details>
}
