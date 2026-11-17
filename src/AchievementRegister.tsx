import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, Search } from 'lucide-react';
import { allEvidence, type Evidence } from './evidence-store';
import { listVisitFiles, type VisitFile } from './supervisory-visit-files';
import { readSupervisoryVisits } from './supervisory-visits-model';
import { readTechnicalTopics } from './technical-followup-model';
import { localDateKey } from './dashboard-metrics';
import { buildAchievements, filterAchievements } from './achievement-register';
import type { Plan } from './plan-model';
import type { Task } from './task-model';
import './achievement-register.css';

type Props = { tasks:Task[]; plans:Plan[]; navigate:(section:string,planId?:string,activityId?:string)=>void };
export default function AchievementRegister({tasks,plans,navigate}:Props) {
  const [files,setFiles]=useState<Evidence[]|null>(null);
  const [visitFiles,setVisitFiles]=useState<VisitFile[]|null>(null);
  const [planError,setPlanError]=useState(false);
  const [visitError,setVisitError]=useState(false);
  const [section,setSection]=useState('الكل'); const [person,setPerson]=useState('');
  const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [evidenceFilter,setEvidenceFilter]=useState('الكل');
  useEffect(()=>{ let live=true; allEvidence().then(x=>{if(live)setFiles(x)}).catch(()=>{if(live)setPlanError(true)}); listVisitFiles().then(x=>{if(live)setVisitFiles(x)}).catch(()=>{if(live)setVisitError(true)});return ()=>{live=false}; },[]);
  let visits:ReturnType<typeof readSupervisoryVisits>=[]; let visitReadError=false;
  try {visits=readSupervisoryVisits()} catch {visitReadError=true}
  const rows=buildAchievements({tasks,plans,visits,topics:readTechnicalTopics(),today:localDateKey(new Date())});
  const options=Array.from(new Set(rows.map(r=>r.section))).sort((a,b)=>a.localeCompare(b,'ar'));
  function related(row:typeof rows[number]):Array<Evidence|VisitFile>|null {
    if(row.source==='activity') return files?.filter(f=>f.planId===row.planId&&f.activityId===row.activityId)??null;
    if(row.source==='visit') return visitFiles?.filter(f=>f.recordId===row.sourceId)??null;
    return null;
  }
  const visible=useMemo(()=>filterAchievements(rows,{section,person,from,to}).filter(row=>{
    if(evidenceFilter==='الكل') return true;
    if(row.source!=='activity'&&row.source!=='visit') return evidenceFilter==='غير متاح';
    const matches=related(row);
    if(matches===null) return evidenceFilter==='تعذر التحقق' && ((row.source==='activity'&&planError)||(row.source==='visit'&&visitError));
    return evidenceFilter===(matches.length?'مرفق':'لا يوجد شاهد');
  }),[rows,section,person,from,to,evidenceFilter,files,visitFiles,planError,visitError]);
  function download(file:Evidence|VisitFile) {const url=URL.createObjectURL(file.blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  return <section className="achievement-register" aria-label="سجل الإنجاز والشواهد">
    <div className="achievement-hero"><span><FileCheck2 size={24} aria-hidden="true"/></span><div><p>أعمال مكتملة من سجلاتك</p><h2>سجل الإنجاز والشواهد</h2><p>راجع ما أُنجز، وافتح الشواهد أو انتقل إلى العمل الأصلي.</p></div></div>
    {(visitReadError||planError||visitError)&&<p className="achievement-warning" role="alert">{visitReadError?'تعذر قراءة سجلات الزيارات. ':''}{planError?'تعذر قراءة شواهد الخطط. ':''}{visitError?'تعذر قراءة شواهد الزيارات. ':''}لم تتغير بياناتك.</p>}
    <div className="achievement-filters" aria-label="تصفية سجل الإنجاز">
      <label>القسم<select value={section} onChange={e=>setSection(e.target.value)}><option>الكل</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>
      <label>المعلم أو المسؤول<input value={person} onChange={e=>setPerson(e.target.value)} placeholder="ابحث بالاسم" /></label>
      <label>من تاريخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>إلى تاريخ<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>الشاهد<select value={evidenceFilter} onChange={e=>setEvidenceFilter(e.target.value)}><option>الكل</option><option>مرفق</option><option>لا يوجد شاهد</option><option>غير متاح</option><option>تعذر التحقق</option></select></label>
    </div>
    {from&&to&&from>to&&<p role="alert" className="achievement-warning">تاريخ البداية بعد تاريخ النهاية؛ يرجى تعديل الفترة.</p>}
    <div className="achievement-list-heading"><div><h3>الإنجازات المسجلة</h3><p>عند تحديد فترة تظهر الأعمال التي سُجل تاريخ إنجازها فقط.</p></div><strong>{visible.length} من {rows.length}</strong></div>
    {visible.length===0?<div className="achievement-empty"><Search size={24} aria-hidden="true"/><p>لا توجد إنجازات تطابق العرض الحالي.</p></div>:<div className="achievement-list">{visible.map(row=>{
      const attachments=related(row); const applicable=row.source==='activity'||row.source==='visit';
      const loading=applicable&&attachments===null&&!((row.source==='activity'&&planError)||(row.source==='visit'&&visitError));
      const evidenceStatus=!applicable?'إرفاق الشاهد غير متاح لهذا النوع':loading?'جارٍ التحقق من الشواهد':attachments===null?'تعذر التحقق من الشواهد':attachments.length?`${attachments.length} شاهد مرفق`:'لا يوجد شاهد مرفق';
      return <article key={row.id} className="achievement-card"><div className="achievement-card-head"><div><span>{row.section}</span><h3>{row.title}</h3><p>{row.detail}</p></div><span className={'achievement-badge'+(attachments?.length?' documented':'')}>{evidenceStatus}</span></div>
        <div className="achievement-meta"><span>المسؤول: {row.person||'غير مسجل'}</span><span>تاريخ الإنجاز: {row.date||'غير مسجل'}</span></div>
        {!!attachments?.length&&<div className="achievement-files">{attachments.map(f=><button key={f.id} type="button" onClick={()=>download(f)}>تنزيل الشاهد: {f.name}</button>)}</div>}
        <button type="button" className="achievement-open" onClick={()=>navigate(row.source==='activity'?'مكتبة الخطط':row.section,row.planId,row.activityId)}>فتح السجل الأصلي ←</button>
      </article>;
    })}</div>}
    <p className="achievement-footnote">يشمل السجل المهام وأنشطة الخطط والزيارات المنفذة والموضوعات المكتملة في المتابعة الفنية. البرامج التي لها موعد وحده لا تُعد منجزة تلقائيًا. قد يظهر نشاط خطة وزيارته المرتبطة كسجلين منفصلين.</p>
  </section>;
}
