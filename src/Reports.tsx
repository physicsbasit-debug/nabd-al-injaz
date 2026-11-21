import { PdfExport } from './PdfExport';
import { useEffect, useState } from 'react';
import type { Task } from './task-model';
import type { Plan } from './plan-model';
import { localDateKey } from './dashboard-metrics';
import { readSupervisoryVisits } from './supervisory-visits-model';
import { readTechnicalTopics, TECHNICAL_FOLLOWUP_STORAGE_KEY } from './technical-followup-model';
import { readProfessionalPrograms } from './professional-development-model';
import { readAssessments } from './assessment-tracking';
import { readShortTests } from './short-test-model';
import { readCoverStore, COVER_DRAFT_KEY } from './cover-planning';
import { allEvidence } from './evidence-store';
import { listWorkEvidence } from './work-evidence';
import { listVisitFiles } from './supervisory-visit-files';
import { listProfessionalFiles } from './professional-development-files';
import { buildReport, filterReport, type ReportRow } from './report-model';
import './reports.css';
import VisitReport from './VisitReport';
import PlansReport from './PlansReport';
import ProfessionalReport from './ProfessionalReport';
import AssessmentReport from './AssessmentReport';
import CoverReport from './CoverReport';
type Props={tasks:Task[];plans:Plan[]};
type Counts={plans:Set<string>;work:Set<string>;visits:Set<string>;programs:Set<string>};
function GeneralReport({tasks,plans}:Props){
 const [filters,setFilters]=useState({section:'الكل',person:'',from:'',to:'',status:'الكل'});
 const [counts,setCounts]=useState<Counts|null>(null);const [filesError,setFilesError]=useState(false);
 useEffect(()=>{let live=true;Promise.all([allEvidence(),listWorkEvidence(),listVisitFiles(),listProfessionalFiles()]).then(([p,w,v,g])=>{if(live)setCounts({plans:new Set(p.map(f=>f.planId+':'+f.activityId)),work:new Set(w.map(f=>f.ownerType+':'+f.ownerId)),visits:new Set(v.map(f=>f.recordId)),programs:new Set(g.filter(f=>f.kind==='شاهد').map(f=>f.recordId))})}).catch(()=>{if(live)setFilesError(true)});return()=>{live=false}},[]);
 const today=localDateKey(new Date());let rows:ReportRow[]=[];let readError=false;
 try{
  const topics=readTechnicalTopics();const topicRaw=localStorage.getItem(TECHNICAL_FOLLOWUP_STORAGE_KEY);
  if(topicRaw!==null){const data:unknown=JSON.parse(topicRaw);if(!Array.isArray(data)||data.length!==topics.length)throw new Error('invalid topics');}
  const cover=readCoverStore();const coverRaw=localStorage.getItem(COVER_DRAFT_KEY);
  if(coverRaw!==null){const data:unknown=JSON.parse(coverRaw);if(!data||typeof data!=='object'||Array.isArray(data)||!('days' in data)||!data.days||typeof data.days!=='object'||Array.isArray(data.days)||Object.keys(data.days).length!==Object.keys(cover.days).length)throw new Error('invalid cover');}
  rows=buildReport({tasks,plans,visits:readSupervisoryVisits(),topics,programs:readProfessionalPrograms(),assessments:readAssessments(),reviews:readShortTests(),cover,today});
 }catch{readError=true}
 const sections=Array.from(new Set(rows.map(r=>r.section))).sort((a,b)=>a.localeCompare(b,'ar'));
 const visible=filterReport(rows,filters);const invalid=!!filters.from&&!!filters.to&&filters.from>filters.to;
 const evidence=(row:ReportRow)=>{if(!counts)return 'تعذر التحقق';const found=row.source==='activity'?counts.plans.has(row.planId+':'+row.activityId):row.source==='visit'?counts.visits.has(row.sourceId):row.source==='program'?counts.programs.has(row.sourceId):counts.work.has(row.source+':'+row.sourceId);return found?'مرفق':'لا يوجد شاهد';};
 return <section className="reports" aria-label="التقارير">
 <div className="reports-heading"><h2>تقارير العمل والمتابعة</h2><p>اختر البيانات المطلوبة، ثم صدّر التقرير بصيغة PDF.</p></div>
 <div className="reports-controls"><label>القسم<select value={filters.section} onChange={e=>setFilters({...filters,section:e.target.value})}><option>الكل</option>{sections.map(s=><option key={s}>{s}</option>)}</select></label><label>الحالة<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option>الكل</option><option>منجز</option><option>قيد المتابعة</option></select></label><label>المعلم أو المسؤول<input value={filters.person} onChange={e=>setFilters({...filters,person:e.target.value})}/></label><label>من تاريخ<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>إلى تاريخ<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label><PdfExport disabled={readError||filesError||!counts||invalid} filename="work-report.pdf" /></div>
 {invalid&&<p role="alert">تاريخ البداية بعد تاريخ النهاية.</p>}{readError&&<p role="alert">تعذرت قراءة بعض السجلات؛ لا يمكن إعداد تقرير كامل.</p>}{filesError&&<p role="alert">تعذرت قراءة الشواهد؛ لم يُجهز التقرير.</p>}
 <div className="report-preview" dir="rtl"><header className="report-document-header"><p>سلطنة عُمان · مدرسة الباسط للتعليم الأساسي (8–10)</p><h2>تقرير العمل والمتابعة</h2><p>تاريخ إعداد التقرير: {today}</p></header><div className="report-scope"><span>القسم: {filters.section}</span><span>الحالة: {filters.status}</span><span>المسؤول: {filters.person||'الكل'}</span><span>الفترة: {filters.from||'البداية'} — {filters.to||'دون حد'}</span><span>عدد السجلات: {visible.length}</span></div>
 <p className="report-note">عند اختيار فترة، تُستبعد السجلات التي لا يوجد لها تاريخ مسجل. تاريخ السجل المفتوح هو موعده، وتاريخ المنجز هو تاريخ إنجازه عند توفره. قد يظهر نشاط وزيارته المرتبطة كسجلين.</p>
 <div className="report-table-wrap"><table><thead><tr><th>العمل</th><th>القسم</th><th>المسؤول</th><th>الحالة</th><th>التاريخ</th><th>الشاهد</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><strong>{row.title}</strong><small>{row.detail}</small></td><td>{row.section}</td><td>{row.person||'غير مسجل'}</td><td>{row.status}</td><td dir="ltr">{row.date||'غير مسجل'}</td><td>{counts?evidence(row):filesError?'تعذر التحقق':'جارٍ التحقق'}</td></tr>)}</tbody></table></div>{visible.length===0&&<p className="report-empty">لا توجد سجلات مطابقة للاختيار الحالي.</p>}<footer>نبض الإنجاز · تقرير مبني على البيانات المحفوظة في هذا المتصفح</footer></div>
 </section>;
}

export default function Reports(props:Props){
 const [type,setType]=useState<'general'|'visits'|'plans'|'professional'|'assessment'|'cover'>('general');
 return <div className="reports-container"><div className="report-type" role="group" aria-label="نوع التقرير"><button type="button" aria-pressed={type==='general'} onClick={()=>setType('general')}>تقرير العمل والمتابعة</button><button type="button" aria-pressed={type==='visits'} onClick={()=>setType('visits')}>تقرير الزيارات الإشرافية</button><button type="button" aria-pressed={type==='plans'} onClick={()=>setType('plans')}>تقرير الخطط والمهام</button><button type="button" aria-pressed={type==='professional'} onClick={()=>setType('professional')}>تقرير الإنماء المهني</button><button type="button" aria-pressed={type==='assessment'} onClick={()=>setType('assessment')}>تقرير الاختبارات والتحصيل</button><button type="button" aria-pressed={type==='cover'} onClick={()=>setType('cover')}>تقرير الجداول والاحتياط</button></div>{type==='general'?<GeneralReport {...props}/>:type==='visits'?<VisitReport/>:type==='plans'?<PlansReport {...props}/>:type==='professional'?<ProfessionalReport/>:type==='assessment'?<AssessmentReport plans={props.plans}/>:<CoverReport/>}</div>;
}
