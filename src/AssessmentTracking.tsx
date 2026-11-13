import { useEffect, useState } from 'react';
import { ASSESSMENT_KEY, SUBJECTS, isAssessmentRecord, readAssessments, summarizeAssessments, type AssessmentRecord } from './assessment-tracking';
import { ASSESSMENT_MAX_BYTES, ASSESSMENT_MIMES, listAssessmentFiles, saveAssessmentFile, deleteAssessmentFile, type AssessmentFile } from './assessment-files';
import { readSchedule } from './schedule-model';
import './short-test-review.css';

const blank = { teacher:'', subject:'فيزياء', title:'', grade:'9', submitted:false, analyzed:false, notes:'' };
export default function AssessmentTracking() {
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [files, setFiles] = useState<AssessmentFile[]>([]);
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('الكل');
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const teachers = readSchedule().teachers;
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => readAssessments()).then(async (items) => {
      const saved = await listAssessmentFiles();
      if (active) {setRecords(items); setFiles(saved); setReady(true);}
    }).catch(() => { if (active) setMessage('تعذر قراءة سجلات الاختبارات أو ملفاتها؛ لم تُغيّر بياناتك.'); });
    return () => {active = false;};
  }, []);
  const visible = filter === 'الكل' ? records : records.filter(r => r.subject === filter);
  const summary = summarizeAssessments(visible);
  function save() {
    const record = {...form, id:editing ?? crypto.randomUUID(), teacher:form.teacher.trim(), title:form.title.trim(), notes:form.notes.trim()};
    if (!isAssessmentRecord(record)) {setMessage('أدخل عنوان الاختبار واسم المعلم واختر التخصص والصف.'); return;}
    const next = editing ? records.map(r => r.id === editing ? record : r) : [...records, record];
    try {localStorage.setItem(ASSESSMENT_KEY, JSON.stringify(next));} catch {setMessage('تعذر حفظ السجل.'); return;}
    setRecords(next); setForm(blank); setEditing(null); setMessage('حُفظ سجل المتابعة على هذا الجهاز.');
  }
  async function addFile(record: AssessmentRecord, kind: 'اختبار' | 'تحليل', file?: File) {
    if (!file) return;
    if (!ASSESSMENT_MIMES.includes(file.type) || file.size < 1 || file.size > ASSESSMENT_MAX_BYTES) {setMessage('استخدم PDF أو صورة أو DOCX أو XLSX بحجم لا يتجاوز 8MB للملف.'); return;}
    const item: AssessmentFile = {id:crypto.randomUUID(), recordId:record.id, kind, name:file.name, mime:file.type, size:file.size, createdAt:new Date().toISOString(), blob:file};
    try {await saveAssessmentFile(item); setFiles(current => [...current, item]); setMessage('حُفظ الملف على هذا الجهاز.');}
    catch {setMessage('تعذر حفظ الملف؛ تحقق من مساحة الجهاز.');}
  }
  function download(file: AssessmentFile) {
    const url=URL.createObjectURL(file.blob); const a=document.createElement('a');
    a.href=url; a.download=file.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  async function removeFile(file: AssessmentFile) {
    if (!window.confirm('سيُحذف هذا الملف المحفوظ محليًا. هل تريد المتابعة؟')) return;
    try {await deleteAssessmentFile(file.id); setFiles(current => current.filter(f=>f.id!==file.id)); setMessage('حُذف الملف.');}
    catch {setMessage('تعذر حذف الملف.');}
  }
  function removeRecord(record: AssessmentRecord) {
    if (files.some(f => f.recordId===record.id)) {setMessage('احذف ملفات السجل أولًا أو احتفظ بالسجل للحفاظ عليها.'); return;}
    if (!window.confirm('سيُحذف سجل المتابعة. هل تريد المتابعة؟')) return;
    const next=records.filter(r=>r.id!==record.id);
    try {localStorage.setItem(ASSESSMENT_KEY, JSON.stringify(next)); setRecords(next); if (editing===record.id) {setEditing(null);setForm(blank);} setMessage('حُذف سجل المتابعة.');}
    catch {setMessage('تعذر حذف السجل.');}
  }
  return <section className="card short-test-review" aria-label="متابعة الاختبارات والتحليل">
    <h2>متابعة الاختبارات والتحليل</h2>
    <p>سجّل لكل معلم اختبارًا، وتابع تسليمه وتحليله كلًا على حدة. الملفات والسجلات تحفظ على هذا الجهاز فقط.</p>
    <label>عرض حسب التخصص<select aria-label="عرض حسب التخصص" value={filter} onChange={e=>setFilter(e.target.value)}><option>الكل</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label>
    <p>السجلات: {summary.total} · لم يُسلّم: {summary.pendingSubmission} · لم يُحلّل: {summary.pendingAnalysis}</p>
    <div className="short-test-fields">
      <label>عنوان الاختبار<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>المعلم<input list="assessment-teachers" value={form.teacher} onChange={e=>setForm({...form,teacher:e.target.value})}/><datalist id="assessment-teachers">{teachers.map(t=><option value={t} key={t}/>)}</datalist></label>
      <label>التخصص<select aria-label="التخصص" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>الصف<select aria-label="صف الاختبار" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option value="8">الثامن</option><option value="9">التاسع</option><option value="10">العاشر</option></select></label>
      <label><input type="checkbox" checked={form.submitted} onChange={e=>setForm({...form,submitted:e.target.checked})}/> تم تسليم الاختبار</label>
      <label><input type="checkbox" checked={form.analyzed} onChange={e=>setForm({...form,analyzed:e.target.checked})}/> تم تحليل النتائج</label>
      <label className="short-test-notes">ملاحظات<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </div>
    <div><button type="button" disabled={!ready} onClick={save}>{editing ? 'حفظ تعديل المتابعة' : 'حفظ سجل المتابعة'}</button>{editing && <button type="button" onClick={()=>{setEditing(null);setForm(blank);}}>إلغاء تعديل المتابعة</button>}</div>
    {message && <p role="status">{message}</p>}
    <h3>سجلات المتابعة ({visible.length})</h3>
    {visible.length===0 && <p>لا توجد سجلات في هذا التخصص.</p>}
    {visible.map(r=><details className="short-test-item" key={r.id}>
      <summary><strong>{r.title} · {r.teacher}</strong><span>{r.subject} · الصف {r.grade}</span></summary>
      <p>تسليم الاختبار: {r.submitted ? 'تم التسليم' : 'لم يُسلّم'} · تحليل النتائج: {r.analyzed ? 'تم التحليل' : 'لم يُحلّل'}</p>
      {r.notes && <p>ملاحظات: {r.notes}</p>}
      {(['اختبار','تحليل'] as const).map(kind=><div key={kind}>
        <h4>ملفات {kind === 'اختبار' ? 'الاختبار' : 'التحليل'}</h4>
        {files.filter(f=>f.recordId===r.id && f.kind===kind).map(f=><div key={f.id}><span>{f.name}</span> <button type="button" onClick={()=>download(f)}>تنزيل الملف</button> <button type="button" onClick={()=>void removeFile(f)}>حذف الملف</button></div>)}
        <label>إضافة ملف {kind}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e=>{void addFile(r,kind,e.target.files?.[0]); e.currentTarget.value='';}}/></label>
      </div>)}
      <p><button type="button" onClick={()=>{setEditing(r.id);setForm({teacher:r.teacher,subject:r.subject,title:r.title,grade:r.grade,submitted:r.submitted,analyzed:r.analyzed,notes:r.notes});}}>تعديل المتابعة</button> <button type="button" onClick={()=>removeRecord(r)}>حذف سجل المتابعة</button></p>
    </details>)}
  </section>;
}
