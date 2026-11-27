import { MeetingDecisionList, OpenDecisionsSummary } from './MeetingDecisions';
import './meeting-decisions.css';
import { useState, type Dispatch, type SetStateAction } from 'react';
import EvidencePanel from './EvidencePanel';
import type { Plan, PlanActivity, PlanKind } from './plan-model';
import { activitiesForDestination, type PlanDestination } from './plan-routing';
import './section-register.css';

type Destination = Extract<PlanDestination, 'الاجتماعات الدورية' | 'الزيارات المتبادلة' | 'رفع المستوى التحصيلي'>;
type Props = { plans: Plan[]; setPlans: Dispatch<SetStateAction<Plan[]>>; destination: Destination; onOpenPlan: (id: string, activityId: string) => void };
const settings: Record<Destination, {kind: PlanKind; singular: string; details: string; hint: string}> = {
  'الاجتماعات الدورية': {kind:'خطة الاجتماعات الدورية',singular:'اجتماع',details:'جدول الأعمال والمحضر والقرارات',hint:'سجّل الحاضرين وجدول الأعمال والقرارات وما يلزم متابعته.'},
  'الزيارات المتبادلة': {kind:'خطة الزيارات المتبادلة',singular:'زيارة متبادلة',details:'تفاصيل الزيارة والمتابعة',hint:'سجّل المعلمين المشاركين والدرس أو الهدف وما تم الاتفاق على متابعته، دون تقييم.'},
  'رفع المستوى التحصيلي': {kind:'خطة رفع المستوى التحصيلي',singular:'إجراء لرفع التحصيل',details:'الإجراء والمتابعة والنتيجة',hint:'سجّل الفئة المستهدفة والإجراء والنتائج المتاحة دون افتراض تحققها.'},
};
type Draft={title:string;assignee:string;dueDate:string;details:string};
const blank=():Draft=>({title:'',assignee:'',dueDate:'',details:''});
export default function SectionRegister({plans,setPlans,destination,onOpenPlan}:Props){
 const [draft,setDraft]=useState<Draft>(blank); const [editing,setEditing]=useState<{planId:string;id:string}|null>(null); const [proof,setProof]=useState<{planId:string;id:string;title:string}|null>(null);const [message,setMessage]=useState('');
 const config=settings[destination]; const rows=activitiesForDestination(plans,destination);
 function save(){
  if(!draft.title.trim()){setMessage('أدخل عنوان السجل أولًا.');return;}
  const now=new Date().toISOString();
  if(editing){
   const exists=plans.some(p=>!p.archived&&p.id===editing.planId&&p.activities.some(a=>a.id===editing.id&&a.destination===destination));
   if(!exists){setMessage('السجل لم يعد متاحًا؛ لم تحفظ التغييرات.');return;}
   setPlans(old=>old.map(p=>p.id!==editing.planId?p:{...p,activities:p.activities.map(a=>a.id!==editing.id?a:{...a,title:draft.title.trim(),assignee:draft.assignee.trim(),dueDate:draft.dueDate,details:draft.details.trim()})}));
  } else {
   const activity:PlanActivity={id:crypto.randomUUID(),title:draft.title.trim(),assignee:draft.assignee.trim(),dueDate:draft.dueDate,details:draft.details.trim(),progress:'not_started',completedAt:null,createdAt:now,destination};
   const id='section-register:'+destination;
   setPlans(old=>{
    const existing=old.find(p=>p.id===id);
    if(existing?.archived) return [...old,{id:crypto.randomUUID(),title:'سجل '+destination,kind:config.kind,owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:now,activities:[activity]}];
    if(existing) return old.map(p=>p.id===id?{...p,activities:[...p.activities,activity]}:p);
    return [...old,{id,title:'سجل '+destination,kind:config.kind,owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:now,activities:[activity]}];
   });
  }
  setDraft(blank());setEditing(null);setMessage('حُفظ السجل في هذا المتصفح.');
 }
 function updateProgress(planId:string,id:string,progress:PlanActivity['progress']){setPlans(old=>old.map(p=>p.id!==planId?p:{...p,activities:p.activities.map(a=>a.id!==id?a:{...a,progress,completedAt:progress==='completed'?(a.completedAt||new Date().toISOString()):null})}));}
 return <section className="card section-register" aria-label={'سجل '+destination}>
  <h2>{destination}</h2><p>{config.hint}</p><p>تظهر أنشطة الخطط المرتبطة هنا أيضًا؛ تُحفظ السجلات في الخطط لتظهر في المتابعة والتقارير.</p>
  <details className="section-register-form" open={editing!==null || undefined}><summary>{editing?'تعديل السجل':'إضافة '+config.singular}</summary>
   <label>العنوان<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>المعلم أو المسؤول<input value={draft.assignee} onChange={e=>setDraft({...draft,assignee:e.target.value})}/></label>
   <label>التاريخ<input type="date" value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label>
   <label>{config.details}<textarea value={draft.details} onChange={e=>setDraft({...draft,details:e.target.value})} rows={4}/></label>
   <button type="button" onClick={save}>حفظ السجل</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setDraft(blank());}}>إلغاء التعديل</button>}
  </details>{message&&<p role="status">{message}</p>}
  {destination==='الاجتماعات الدورية'&&<OpenDecisionsSummary/>}
  {rows.length===0?<p>لا توجد سجلات لهذا القسم بعد.</p>:<div className="section-register-list">{rows.map(({plan,activity})=><article key={plan.id+':'+activity.id}>
   <h3>{activity.title}</h3><p>الخطة: {plan.title} · المسؤول: {activity.assignee||'غير مسجل'} · التاريخ: {activity.dueDate||'غير مسجل'}</p>{activity.details&&<p className="section-register-details">{activity.details}</p>}
   <label>حالة التنفيذ<select aria-label={'حالة '+activity.title} value={activity.progress} onChange={e=>updateProgress(plan.id,activity.id,e.target.value as PlanActivity['progress'])}><option value="not_started">لم يبدأ</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتمل</option></select></label>
   <div className="section-register-actions"><button type="button" onClick={()=>{setEditing({planId:plan.id,id:activity.id});setDraft({title:activity.title,assignee:activity.assignee,dueDate:activity.dueDate,details:activity.details});setMessage('');}}>تعديل</button><button type="button" onClick={()=>setProof({planId:plan.id,id:activity.id,title:activity.title})}>الشواهد والتوثيق</button><button type="button" onClick={()=>onOpenPlan(plan.id,activity.id)}>فتح الخطة</button></div>
   {destination==='الاجتماعات الدورية'&&<MeetingDecisionList meeting={{planId:plan.id,meetingId:activity.id,meetingTitle:activity.title}}/>}
   {proof?.planId===plan.id&&proof.id===activity.id&&<EvidencePanel planId={plan.id} activityId={activity.id} activityTitle={activity.title} onClose={()=>setProof(null)}/>}
  </article>)}</div>}
 </section>;
}
