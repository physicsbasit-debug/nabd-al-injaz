import { useEffect, useState } from 'react';
import { localDateKey } from './dashboard-metrics';
import { readSupervisoryVisits, type SupervisoryVisit } from './supervisory-visits-model';
import { listVisitFiles, type VisitFile } from './supervisory-visit-files';
import { filterVisitReport, visitReportStatus, type VisitReportFilters } from './visit-report-model';

export default function VisitReport(){
 const [visits,setVisits]=useState<SupervisoryVisit[]|null>(null);
 const [files,setFiles]=useState<VisitFile[]|null>(null);
 const [error,setError]=useState('');
 const [filters,setFilters]=useState<VisitReportFilters>({teacher:'',status:'all',from:'',to:''});
 useEffect(()=>{let active=true;try{setVisits(readSupervisoryVisits())}catch{setError('تعذرت قراءة سجل الزيارات؛ لا يمكن إعداد التقرير.')}listVisitFiles().then(value=>{if(active)setFiles(value)}).catch(()=>{if(active)setError('تعذرت قراءة شواهد الزيارات؛ لا يمكن إعداد التقرير.')});return()=>{active=false}},[]);
 const today=localDateKey(new Date());
 const invalid=!!filters.from&&!!filters.to&&filters.from>filters.to;
 const visible=filterVisitReport(visits??[],filters);
 const teachers=Array.from(new Set((visits??[]).map(v=>v.teacher))).sort((a,b)=>a.localeCompare(b,'ar'));
 return <section className="reports visit-report" aria-label="تقرير الزيارات الإشرافية">
  <div className="reports-heading"><h2>تقرير الزيارات الإشرافية</h2><p>متابعة الزيارات وتوثيقها وشواهدها، دون تقييم المعلمين.</p></div>
  <div className="reports-controls">
   <label>المعلم<select value={filters.teacher} onChange={e=>setFilters({...filters,teacher:e.target.value})}><option value="">جميع المعلمين</option>{teachers.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   <label>حالة الزيارة<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value as VisitReportFilters['status']})}><option value="all">الجميع</option><option value="planned">مخططة</option><option value="completed">منفذة</option></select></label>
   <label>من تاريخ<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
   <label>إلى تاريخ<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
   <button type="button" disabled={!!error||!visits||!files||invalid} onClick={()=>window.print()}>طباعة أو حفظ PDF</button>
  </div>
  {invalid&&<p role="alert">تاريخ البداية بعد تاريخ النهاية.</p>}{error&&<p role="alert">{error}</p>}
  {!error&&visits&&files&&<div className="report-preview" dir="rtl">
   <header className="report-document-header"><p>سلطنة عُمان · مدرسة الباسط للتعليم الأساسي (8–10)</p><h2>تقرير الزيارات الإشرافية</h2><p>تاريخ إعداد التقرير: {today}</p></header>
   <div className="report-scope"><span>المعلم: {filters.teacher||'الجميع'}</span><span>الحالة: {filters.status==='all'?'الجميع':filters.status==='planned'?'مخططة':'منفذة'}</span><span>الفترة: {filters.from||'البداية'} — {filters.to||'دون حد'}</span><span>عدد الزيارات: {visible.length}</span></div>
   <p className="report-note">يعرض التقرير حالة الزيارة المسجلة ومتابعتها، ولا يتضمن تقييمًا للمعلم. عند تحديد فترة تُستبعد الزيارات بلا تاريخ. الشواهد المشار إليها محفوظة في التطبيق ولا تُضمّن ملفاتها داخل التقرير.</p>
   <div className="visit-report-list">{visible.map(v=>{const witnesses=files.filter(f=>f.recordId===v.id);return <article className="visit-report-card" key={v.id}>
    <div className="visit-report-card-head"><h3>{v.teacher}</h3><strong>{visitReportStatus(v,today)}</strong></div>
    <div className="visit-report-details"><span><b>التاريخ:</b> {v.date||'غير محدد'}</span><span><b>المادة:</b> {v.subject||'غير مسجلة'}</span><span><b>الصف والشعبة:</b> {v.grade||'غير مسجل'}{v.section?' / '+v.section:''}</span><span><b>الحصة:</b> {v.period||'غير مسجلة'}</span><span><b>الدرس:</b> {v.lesson||'غير مسجل'}</span><span><b>الشاهد:</b> {witnesses.length?`مرفق (${witnesses.length})`:'لا يوجد شاهد'}</span></div>
    <div className="visit-report-notes"><p><b>المتابعة:</b> {v.followUp||'لا توجد ملاحظات مسجلة'}</p><p><b>التوثيق:</b> {v.documentation||'لا يوجد توثيق نصي'}</p>{witnesses.length>0&&<p><b>أسماء الشواهد:</b> {witnesses.map(f=>f.name).join('، ')}</p>}</div>
   </article>})}</div>
   {visible.length===0&&<p className="report-empty">لا توجد زيارات مطابقة للاختيار الحالي.</p>}
   <footer>نبض الإنجاز · تقرير مبني على البيانات المحفوظة في هذا المتصفح</footer>
  </div>}
 </section>;
}
