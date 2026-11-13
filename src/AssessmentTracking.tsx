import { useEffect, useRef, useState } from 'react';
import { ASSESSMENT_KEY, SUBJECTS, isAssessmentRecord, readAssessments, summarizeAssessments, type AssessmentRecord } from './assessment-tracking';
import { ASSESSMENT_MAX_BYTES, ASSESSMENT_MIMES, listAssessmentFiles, saveAssessmentFile, deleteAssessmentFile, type AssessmentFile } from './assessment-files';
import { readSchedule } from './schedule-model';
import { onAssessmentChange, withAssessmentLock } from './assessment-lock';
import './short-test-review.css';

const blank = { teacher:'', subject:'فيزياء', title:'', grade:'9', submitted:false, analyzed:false, reviewed:false, notes:'' };
const fallbackMimes: Record<string, string> = {pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export default function AssessmentTracking() {
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [files, setFiles] = useState<AssessmentFile[]>([]);
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('الكل');
  const [editing, setEditing] = useState<string | null>(null);
  const editSnapshot = useRef<AssessmentRecord | null>(null);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingFiles = useRef(new Set<string>());
  const [pendingRecords, setPendingRecords] = useState<string[]>([]);
  const teachers = readSchedule().teachers;
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void withAssessmentLock(async () => ({items:readAssessments(), saved:await listAssessmentFiles()}), false)
        .then(({items, saved}) => {if (active) {setRecords(items); setFiles(saved); setReady(true);}})
        .catch((error: unknown) => {if (active) {setReady(false); setMessage(error instanceof Error ? error.message : 'تعذر قراءة سجلات الاختبارات أو ملفاتها؛ لم تُغيّر بياناتك.');}});
    };
    refresh();
    const unsubscribe = onAssessmentChange(refresh);
    const onStorage = (event: StorageEvent) => { if (event.key === ASSESSMENT_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => {active = false; unsubscribe(); window.removeEventListener('storage', onStorage);};
  }, []);
  const visible = filter === 'الكل' ? records : records.filter(r => r.subject === filter);
  const summary = summarizeAssessments(visible);
  async function save() {
    const record = {...form, id:editing ?? crypto.randomUUID(), teacher:form.teacher.trim(), title:form.title.trim(), notes:form.notes.trim()};
    if (!isAssessmentRecord(record)) {setMessage('أدخل عنوان الاختبار واسم المعلم واختر التخصص والصف.'); return;}
    if (saving) return;
    setSaving(true);
    try {
      const next = await withAssessmentLock(async () => {
        const current = readAssessments();
        if (editing && JSON.stringify(current.find(r => r.id === editing)) !== JSON.stringify(editSnapshot.current)) throw new Error('تغيّر السجل في نافذة أخرى؛ افتحه مجددًا قبل التعديل.');
        const updated = editing ? current.map(r => r.id === editing ? record : r) : [...current, record];
        localStorage.setItem(ASSESSMENT_KEY, JSON.stringify(updated));
        return updated;
      });
      setRecords(next); setForm(blank); setEditing(null); editSnapshot.current = null; setMessage('حُفظ سجل المتابعة على هذا الجهاز.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'تعذر حفظ السجل.');}
    finally {setSaving(false);}
  }
  async function addFile(record: AssessmentRecord, kind: 'اختبار' | 'تحليل', file?: File) {
    if (!file) return;
    const mime = file.type || fallbackMimes[file.name.split('.').pop()?.toLowerCase() ?? ''];
    if (!mime || !ASSESSMENT_MIMES.includes(mime) || file.size < 1 || file.size > ASSESSMENT_MAX_BYTES) {setMessage('استخدم PDF أو صورة أو DOCX أو XLSX بحجم لا يتجاوز 8MB للملف.'); return;}
    if (pendingFiles.current.has(record.id)) {setMessage('انتظر حتى يكتمل حفظ الملف الحالي.'); return;}
    pendingFiles.current.add(record.id); setPendingRecords(current => [...current, record.id]);
    const item: AssessmentFile = {id:crypto.randomUUID(), recordId:record.id, kind, name:file.name, mime, size:file.size, createdAt:new Date().toISOString(), blob:file};
    try {
      const savedFiles = await withAssessmentLock(async () => {
        if (!readAssessments().some(saved => saved.id === record.id)) throw new Error('السجل لم يعد موجودًا؛ لم يُحفظ الملف.');
        await saveAssessmentFile(item);
        return listAssessmentFiles();
      });
      setFiles(savedFiles); setMessage('حُفظ الملف على هذا الجهاز.');
    }
    catch (error) {setMessage(error instanceof Error ? error.message : 'تعذر حفظ الملف؛ تحقق من مساحة الجهاز.');}
    finally {pendingFiles.current.delete(record.id); setPendingRecords(current => current.filter(id => id !== record.id));}
  }
  function download(file: AssessmentFile) {
    const url=URL.createObjectURL(file.blob); const a=document.createElement('a');
    a.href=url; a.download=file.name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  async function removeFile(file: AssessmentFile) {
    if (!window.confirm('سيُحذف هذا الملف المحفوظ محليًا. هل تريد المتابعة؟')) return;
    try {const savedFiles = await withAssessmentLock(async () => {await deleteAssessmentFile(file.id); return listAssessmentFiles();}); setFiles(savedFiles); setMessage('حُذف الملف.');}
    catch (error) {setMessage(error instanceof Error ? error.message : 'تعذر حذف الملف.');}
  }
  async function removeRecord(record: AssessmentRecord) {
    if (pendingFiles.current.has(record.id)) {setMessage('انتظر حتى يكتمل حفظ الملف.'); return;}
    if (!window.confirm('سيُحذف سجل المتابعة. هل تريد المتابعة؟')) return;
    try {
      const next = await withAssessmentLock(async () => {
        const current = readAssessments();
        const saved = current.find(r => r.id === record.id);
        if (JSON.stringify(saved) !== JSON.stringify(record)) throw new Error('تغيّر السجل في نافذة أخرى؛ أعد فتح القسم قبل الحذف.');
        if ((await listAssessmentFiles()).some(f => f.recordId === record.id)) throw new Error('احذف ملفات السجل أولًا أو احتفظ بالسجل للحفاظ عليها.');
        const updated = current.filter(r => r.id !== record.id);
        localStorage.setItem(ASSESSMENT_KEY, JSON.stringify(updated));
        return updated;
      });
      setRecords(next); if (editing===record.id) {setEditing(null);setForm(blank); editSnapshot.current = null;} setMessage('حُذف سجل المتابعة.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'تعذر حذف السجل.');}
  }
  return <section className="card short-test-review" aria-label="متابعة الاختبارات والتحليل">
    <h2>متابعة الاختبارات والتحليل</h2>
    <p>سجّل اختبار المعلم وتابع مراجعته وتسليمه وتحليله. بعد حفظ السجل، افتحه لإرفاق نسخة الاختبار والتحليل. تُحفظ البيانات والملفات في هذا المتصفح فقط.</p>
    <div className="assessment-overview">
      <label className="assessment-filter">عرض حسب التخصص<select aria-label="عرض حسب التخصص" value={filter} onChange={e=>setFilter(e.target.value)}><option>الكل</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label>
      <div className="assessment-counts" aria-label="ملخص المتابعة"><span>السجلات <strong>{summary.total}</strong></span><span>لم يُراجع <strong>{summary.pendingReview}</strong></span><span>لم يُسلّم <strong>{summary.pendingSubmission}</strong></span><span>لم يُحلّل <strong>{summary.pendingAnalysis}</strong></span></div>
    </div>
    <h3>{editing ? 'تعديل سجل المتابعة' : 'إضافة سجل متابعة'}</h3>
    <fieldset className="short-test-fields" disabled={saving}>
      <label>عنوان الاختبار<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>المعلم<input list="assessment-teachers" value={form.teacher} onChange={e=>setForm({...form,teacher:e.target.value})}/><datalist id="assessment-teachers">{teachers.map(t=><option value={t} key={t}/>)}</datalist></label>
      <label>التخصص<select aria-label="التخصص" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>الصف<select aria-label="صف الاختبار" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option value="8">الثامن</option><option value="9">التاسع</option><option value="10">العاشر</option></select></label>
      <label><input type="checkbox" checked={form.submitted} onChange={e=>setForm({...form,submitted:e.target.checked})}/> تم تسليم الاختبار</label>
      <label><input type="checkbox" checked={form.analyzed} onChange={e=>setForm({...form,analyzed:e.target.checked})}/> تم تحليل النتائج</label>
      <label><input type="checkbox" checked={form.reviewed} onChange={e=>setForm({...form,reviewed:e.target.checked})}/> تمت مراجعة الاختبار</label>
      <label className="short-test-notes">ملاحظات<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </fieldset>
    <div><button type="button" disabled={!ready || saving} onClick={save}>{editing ? 'حفظ تعديل المتابعة' : 'حفظ سجل المتابعة'}</button>{editing && <button type="button" disabled={saving} onClick={()=>{setEditing(null);setForm(blank);}}>إلغاء تعديل المتابعة</button>}</div>
    {message && <p role="status">{message}</p>}
    <h3>سجلات المتابعة ({visible.length})</h3>
    {visible.length===0 && <p>لا توجد سجلات في هذا التخصص.</p>}
    {visible.map(r=><details className="short-test-item" key={r.id}>
      <summary><strong>{r.title} · {r.teacher}</strong><span>{r.subject} · الصف {r.grade}</span></summary>
      <p>تسليم الاختبار: {r.submitted ? 'تم التسليم' : 'لم يُسلّم'} · تحليل النتائج: {r.analyzed ? 'تم التحليل' : 'لم يُحلّل'}</p>
      <p>مراجعة الاختبار: {r.reviewed ? 'تمت المراجعة' : 'لم تتم المراجعة'}</p>
      {r.notes && <p>ملاحظات: {r.notes}</p>}
      {(['اختبار','تحليل'] as const).map(kind=><div className="assessment-file-group" key={kind}>
        <h4>ملفات {kind === 'اختبار' ? 'الاختبار' : 'التحليل'}</h4>
        {files.filter(f=>f.recordId===r.id && f.kind===kind).map(f=><div className="assessment-file-row" key={f.id}><span>{f.name}</span><div><button type="button" onClick={()=>download(f)}>تنزيل الملف</button> <button type="button" onClick={()=>void removeFile(f)}>حذف الملف</button></div></div>)}
        <label className="assessment-file-upload">{kind === 'اختبار' ? 'إرفاق نسخة الاختبار' : 'إرفاق التحليل'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e=>{void addFile(r,kind,e.target.files?.[0]); e.currentTarget.value='';}}/></label>
      </div>)}
      <p><button type="button" disabled={saving} onClick={()=>{editSnapshot.current = r;setEditing(r.id);setForm({teacher:r.teacher,subject:r.subject,title:r.title,grade:r.grade,submitted:r.submitted,analyzed:r.analyzed,reviewed:r.reviewed === true,notes:r.notes});}}>تعديل المتابعة</button> <button type="button" disabled={saving || pendingRecords.includes(r.id)} onClick={()=>void removeRecord(r)}>حذف سجل المتابعة</button></p>
    </details>)}
  </section>;
}
