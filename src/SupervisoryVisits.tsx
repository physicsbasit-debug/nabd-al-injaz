import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { readPlans, type Plan } from './plan-model';
import { activitiesForDestination } from './plan-routing';
import { readSchedule, SCHEDULE_STORAGE_KEY } from './schedule-model';
import { onAssessmentChange, withAssessmentLock } from './assessment-lock';
import { emptySupervisoryVisitForm, hasUnsavedVisitChanges, isFutureCompletedVisit, isSupervisoryVisit, readSupervisoryVisits, summarizeTeacherVisits, SUPERVISORY_VISITS_KEY, VISIT_SUBJECTS, type SupervisoryVisit, type SupervisoryVisitForm } from './supervisory-visits-model';
import { localDateKey } from './dashboard-metrics';
import { deleteVisitFile, listVisitFiles, saveVisitFile, VISIT_MAX_BYTES, VISIT_MIMES, type VisitFile } from './supervisory-visit-files';
import { ensureVisitFileFitsBackup } from './app-backup';
import './short-test-review.css';
import './supervisory-visits.css';

type PlanLink = { planId: string; activityId: string };
type Form = SupervisoryVisitForm;
type Props = { plans: Plan[]; requestedLink: PlanLink | null; onLinkHandled: () => void; onOpenPlan: (planId: string, activityId: string) => void; form: Form; setForm: Dispatch<SetStateAction<Form>>; editing: SupervisoryVisit | null; setEditing: Dispatch<SetStateAction<SupervisoryVisit | null>> };
const mimeByExtension: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

export default function SupervisoryVisits({ plans, requestedLink, onLinkHandled, onOpenPlan, form, setForm, editing, setEditing }: Props) {
  const [records, setRecords] = useState<SupervisoryVisit[]>([]);
  const [files, setFiles] = useState<VisitFile[]>([]);
  const [teachers, setTeachers] = useState<string[]>(() => readSchedule().teachers);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(new Set<string>());
  const formRef = useRef<HTMLHeadingElement>(null);
  const options = useMemo(() => activitiesForDestination(plans, 'الزيارات الإشرافية'), [plans]);
  const today = localDateKey(new Date());
  const teacherFollowup = summarizeTeacherVisits(teachers, records, today);
  const linkValue = form.planId && form.activityId ? JSON.stringify([form.planId, form.activityId]) : '';
  const knownLink = options.some(({ plan, activity }) => plan.id === form.planId && activity.id === form.activityId);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void withAssessmentLock(async () => ({ records: readSupervisoryVisits(), files: await listVisitFiles() }), false)
        .then((value) => { if (active) { setRecords(value.records); setFiles(value.files); setReady(true); } })
        .catch((error: unknown) => { if (active) { setReady(false); setMessage(error instanceof Error ? error.message : 'تعذر قراءة سجلات الزيارات.'); } });
    };
    refresh();
    const unsubscribe = onAssessmentChange(refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SUPERVISORY_VISITS_KEY) refresh();
      if (event.key === SCHEDULE_STORAGE_KEY) setTeachers(readSchedule().teachers);
    };
    window.addEventListener('storage', onStorage);
    return () => { active = false; unsubscribe(); window.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    if (!requestedLink) return;
    setForm(current => ({ ...current, ...requestedLink }));
    setMessage('حُدد نشاط الخطة لهذا السجل. أكمل بيانات الزيارة ثم احفظها.');
    onLinkHandled();
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [requestedLink, onLinkHandled]);

  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => ({ ...current, [key]: value })); }
  function canReplaceDraft(): boolean {
    return !hasUnsavedVisitChanges(form, editing) || window.confirm('لديك بيانات زيارة غير محفوظة. هل تريد تجاهلها؟');
  }
  function prepareTeacher(teacher: string) {
    if (editing) {
      if (!canReplaceDraft()) return;
      setEditing(null);
      setForm({ ...emptySupervisoryVisitForm(), teacher });
    } else {
      if (form.teacher && form.teacher !== teacher && !window.confirm('سيُغيّر اسم المعلم في المسودة الحالية. هل تتابع؟')) return;
      setForm(current => ({ ...current, teacher }));
    }
    setMessage('أكمل حالة الزيارة، ثم احفظ المتابعة.');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function save() {
    if (busy) return;
    const record: SupervisoryVisit = { ...form, teacher: form.teacher.trim(), lesson: form.lesson.trim(), documentation: form.documentation?.trim() ?? '', id: editing?.id ?? crypto.randomUUID(), createdAt: editing?.createdAt ?? new Date().toISOString() };
    if (!isSupervisoryVisit(record)) { setMessage('أدخل اسم المعلم، وتاريخًا صحيحًا عند تسجيل زيارة تمت.'); return; }
    const unchangedFuture = editing?.status === 'completed' && editing.date === record.date;
    if (isFutureCompletedVisit(record, today) && !unchangedFuture) { setMessage('لا يمكن تسجيل زيارة بتاريخ مستقبلي على أنها تمت. اختر تاريخًا حتى اليوم أو اجعلها غير منفذة.'); return; }
    const unchangedLink = editing && editing.planId === record.planId && editing.activityId === record.activityId;
    if (record.planId && !knownLink && !unchangedLink) { setMessage('نشاط الخطة لم يعد متاحًا؛ اختر نشاطًا آخر أو احفظ الزيارة مستقلة.'); return; }
    setBusy(true);
    try {
      const updated = await withAssessmentLock(async () => {
        const current = readSupervisoryVisits();
        if (editing && JSON.stringify(current.find(item => item.id === editing.id)) !== JSON.stringify(editing)) throw new Error('تغيّر سجل الزيارة في نافذة أخرى؛ أعد فتحه قبل التعديل.');
        const linkStillExists = activitiesForDestination(readPlans(), 'الزيارات الإشرافية').some(({ plan, activity }) => plan.id === record.planId && activity.id === record.activityId);
        if (record.planId && !linkStillExists && !unchangedLink) throw new Error('نشاط الخطة لم يعد متاحًا؛ اختر نشاطًا آخر أو احفظ الزيارة مستقلة.');
        const next = editing ? current.map(item => item.id === editing.id ? record : item) : [...current, record];
        localStorage.setItem(SUPERVISORY_VISITS_KEY, JSON.stringify(next));
        return next;
      });
      setRecords(updated); setForm(emptySupervisoryVisitForm()); setEditing(null); setMessage('حُفظت الزيارة على هذا الجهاز.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ الزيارة.'); }
    finally { setBusy(false); }
  }
  async function addFile(record: SupervisoryVisit, file?: File) {
    if (!file) return;
    const mime = file.type || mimeByExtension[file.name.split('.').pop()?.toLowerCase() ?? ''];
    if (!mime || !VISIT_MIMES.includes(mime) || file.size < 1 || file.size > VISIT_MAX_BYTES) { setMessage('اختر PDF أو صورة أو DOCX أو XLSX بحجم لا يتجاوز 8MB للملف.'); return; }
    if (pending.current.has(record.id)) { setMessage('انتظر حتى يكتمل حفظ الشاهد الحالي.'); return; }
    pending.current.add(record.id); setBusy(true);
    try {
      const next = await withAssessmentLock(async () => {
        if (!readSupervisoryVisits().some(item => item.id === record.id)) throw new Error('سجل الزيارة لم يعد موجودًا؛ لم يُحفظ الشاهد.');
        const item: VisitFile = { id: crypto.randomUUID(), recordId: record.id, kind: 'شاهد', name: file.name, mime, size: file.size, createdAt: new Date().toISOString(), blob: file };
        await ensureVisitFileFitsBackup(readPlans(), item);
        await saveVisitFile(item);
        return listVisitFiles();
      });
      setFiles(next); setMessage('حُفظ شاهد الزيارة على هذا الجهاز.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ الشاهد.'); }
    finally { pending.current.delete(record.id); setBusy(false); }
  }
  function download(file: VisitFile) {
    const url = URL.createObjectURL(file.blob); const link = document.createElement('a');
    link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function removeFile(file: VisitFile) {
    if (!window.confirm('سيُحذف شاهد الزيارة المحفوظ في هذا المتصفح. هل تتابع؟')) return;
    setBusy(true);
    try { setFiles(await withAssessmentLock(async () => { await deleteVisitFile(file.id); return listVisitFiles(); })); setMessage('حُذف شاهد الزيارة.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حذف الشاهد.'); }
    finally { setBusy(false); }
  }
  async function remove(record: SupervisoryVisit) {
    if (pending.current.has(record.id)) { setMessage('انتظر حتى يكتمل حفظ الشاهد.'); return; }
    if (!window.confirm('سيُحذف سجل الزيارة من هذا المتصفح. هل تتابع؟')) return;
    setBusy(true);
    try {
      const next = await withAssessmentLock(async () => {
        const current = readSupervisoryVisits();
        if (JSON.stringify(current.find(item => item.id === record.id)) !== JSON.stringify(record)) throw new Error('تغيّر سجل الزيارة في نافذة أخرى؛ أعد فتح القسم.');
        if ((await listVisitFiles()).some(file => file.recordId === record.id)) throw new Error('احذف شواهد الزيارة أولًا أو احتفظ بالسجل للحفاظ عليها.');
        const updated = current.filter(item => item.id !== record.id);
        localStorage.setItem(SUPERVISORY_VISITS_KEY, JSON.stringify(updated));
        return updated;
      });
      setRecords(next); if (editing?.id === record.id) { setEditing(null); setForm(emptySupervisoryVisitForm()); } setMessage('حُذف سجل الزيارة.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حذف الزيارة.'); }
    finally { setBusy(false); }
  }

  const shown = records.filter(record => [record.teacher, record.lesson, record.subject].some(value => value.includes(filter.trim()))).sort((a, b) => b.date.localeCompare(a.date));
  return <section className="card short-test-review supervisory-visits" aria-label="سجل الزيارات الإشرافية">
    <h2>سجل الزيارات الإشرافية</h2>
    <p>تابع إتمام الزيارات ووثّقها بالشواهد. يمكنك ربط الزيارة بنشاط من الخطة عند الحاجة.</p>
    <section className="visit-teacher-followup" aria-label="متابعة زيارات المعلمين">
      <h3>متابعة المعلمين</h3>
      <p>تعتمد الحالة على الزيارات المسجلة هنا؛ عدم تسجيل زيارة لا يعني بالضرورة أنها لم تحدث.</p>
      {!ready ? <p>{message ? 'تعذر تحميل المتابعة.' : 'جارٍ تحميل المتابعة...'}</p> : <>
        <div className="visit-summary" aria-label="ملخص متابعة المعلمين"><span>المعلمون <strong>{teacherFollowup.length}</strong></span><span>تمت زيارتهم <strong>{teacherFollowup.filter(item => item.completedCount > 0).length}</strong></span><span>لم تُسجّل لهم زيارة منفذة حتى اليوم <strong>{teacherFollowup.filter(item => item.completedCount === 0).length}</strong></span></div>
        {teacherFollowup.length === 0 ? <p>أضف جداول المعلمين أو سجّل زيارة ليظهر المعلمون هنا.</p> : <ul className="visit-teacher-list">{teacherFollowup.map(item => <li key={item.teacher}><div><strong>{item.teacher}</strong><span className={item.completedCount ? 'visit-done' : 'visit-pending'}>{item.completedCount ? 'تمت الزيارة' : 'لم تُسجّل زيارة منفذة'}</span>{item.lastVisit && <small>آخر زيارة مسجلة: {item.lastVisit}</small>}{item.futureCount > 0 && <small>تاريخ زيارة لاحق يحتاج مراجعة.</small>}</div><button type="button" disabled={busy} aria-label={'تسجيل متابعة: ' + item.teacher} onClick={() => prepareTeacher(item.teacher)}>تسجيل متابعة</button></li>)}</ul>}
      </>}
    </section>
    <h3 ref={formRef}>{editing ? 'تعديل الزيارة' : 'إضافة زيارة'}</h3>
    <fieldset className="short-test-fields" disabled={!ready || busy}>
      <label>المعلم<input list="visit-teachers" value={form.teacher} maxLength={300} onChange={e => change('teacher', e.target.value)} /><datalist id="visit-teachers">{teachers.map(name => <option key={name} value={name} />)}</datalist></label>
      <label>تاريخ الزيارة<input type="date" value={form.date} onChange={e => change('date', e.target.value)} /><small>يلزم عند تسجيل زيارة تمت.</small></label>
      <label>حالة الزيارة<select value={form.status} onChange={e => change('status', e.target.value as Form['status'])}><option value="planned">لم تُسجّل كمنفذة</option><option value="completed">تمت الزيارة</option></select></label>
      <label>المادة<select value={form.subject} onChange={e => change('subject', e.target.value)}><option value="">غير محددة</option>{VISIT_SUBJECTS.map(subject => <option key={subject}>{subject}</option>)}</select></label>
      <label>الصف<select value={form.grade} onChange={e => change('grade', e.target.value)}><option value="">غير محدد</option><option value="8">الثامن</option><option value="9">التاسع</option><option value="10">العاشر</option></select></label>
      <label>الشعبة<input value={form.section ?? ''} maxLength={100} onChange={e => change('section', e.target.value)} /></label>
      <label>الحصة<select value={form.period} onChange={e => change('period', e.target.value)}><option value="">غير محددة</option>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={String(n)}>{n}</option>)}</select></label>
      <label className="short-test-notes">موضوع الدرس<input value={form.lesson} maxLength={300} onChange={e => change('lesson', e.target.value)} /></label>
      <label className="short-test-notes">النشاط المرتبط من الخطة<select value={linkValue} onChange={e => { const option = options.find(({ plan, activity }) => JSON.stringify([plan.id, activity.id]) === e.target.value); setForm(current => ({ ...current, planId: option?.plan.id ?? '', activityId: option?.activity.id ?? '' })); }}><option value="">زيارة مستقلة — دون ربط بخطة</option>{linkValue && !knownLink && <option value={linkValue}>النشاط المرتبط سابقًا غير متاح حاليًا</option>}{options.map(({ plan, activity }) => <option key={JSON.stringify([plan.id, activity.id])} value={JSON.stringify([plan.id, activity.id])}>{plan.title} — {activity.title}</option>)}</select></label>
      <label className="short-test-notes">ملاحظة التوثيق<textarea value={form.documentation ?? ''} maxLength={4000} onChange={e => change('documentation', e.target.value)} /></label>
    </fieldset>
    <div className="visit-actions"><button type="button" disabled={!ready || busy} onClick={() => void save()}>{editing ? 'حفظ التعديل' : 'حفظ الزيارة'}</button>{editing && <button type="button" disabled={busy} onClick={() => { if (!canReplaceDraft()) return; setEditing(null); setForm(emptySupervisoryVisitForm()); setMessage(''); }}>إلغاء التعديل</button>}</div>
    {message && <p role="status">{message}</p>}
    <div className="visit-list-header"><h3>الزيارات المسجلة ({shown.length})</h3><label>بحث في الزيارات<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="اسم المعلم أو المادة أو الدرس" /></label></div>
    {shown.length === 0 && <p>لا توجد زيارات مطابقة.</p>}
    {shown.map(record => {
      const plan = plans.find(item => item.id === record.planId);
      const activity = plan?.activities.find(item => item.id === record.activityId);
      return <details className="short-test-item" key={record.id}>
        <summary><strong>{record.teacher} · {record.date || 'دون تاريخ'}</strong><span>{isFutureCompletedVisit(record, today) ? 'تاريخ لاحق يحتاج مراجعة' : record.status === 'completed' ? 'تمت الزيارة' : 'لم تُسجّل كمنفذة'}{record.subject ? ' · ' + record.subject : ''}</span></summary>
        <p>{record.grade ? 'الصف: ' + record.grade + ' · ' : ''}{record.section ? 'الشعبة: ' + record.section + ' · ' : ''}{record.period ? 'الحصة: ' + record.period + ' · ' : ''}{record.lesson ? 'الدرس: ' + record.lesson : ''}</p>
        <p>{record.planId ? plan && activity ? 'الخطة: ' + plan.title + ' · النشاط: ' + activity.title : 'النشاط المرتبط غير متاح حاليًا؛ الزيارة محفوظة.' : 'زيارة مستقلة دون ربط بخطة.'}</p>
        {plan && activity && <button type="button" onClick={() => onOpenPlan(plan.id, activity.id)}>فتح نشاط الخطة</button>}
        {record.documentation && <p><strong>ملاحظة التوثيق:</strong> {record.documentation}</p>}
        {(record.strengths || record.improvements || record.recommendations || record.followUp) && <details className="visit-legacy-notes"><summary>ملاحظات محفوظة من إصدار سابق</summary>{record.strengths && <p><strong>الجوانب الإيجابية:</strong> {record.strengths}</p>}{record.improvements && <p><strong>جوانب التحسين:</strong> {record.improvements}</p>}{record.recommendations && <p><strong>التوصيات:</strong> {record.recommendations}</p>}{record.followUp && <p><strong>المتابعة اللاحقة:</strong> {record.followUp}</p>}</details>}
        <div className="assessment-file-group"><h4>شواهد الزيارة</h4>
          {files.filter(file => file.recordId === record.id).map(file => <div className="assessment-file-row" key={file.id}><span>{file.name}</span><div><button type="button" onClick={() => download(file)}>تنزيل الشاهد</button> <button type="button" disabled={busy} onClick={() => void removeFile(file)}>حذف الشاهد</button></div></div>)}
          <label className="assessment-file-upload">إرفاق شاهد للزيارة<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; void addFile(record, file); }} /></label>
        </div>
        <div className="visit-actions"><button type="button" disabled={busy} onClick={() => { if (!canReplaceDraft()) return; setEditing(record); setForm(record); setMessage(''); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>تعديل الزيارة</button> <button type="button" disabled={busy} onClick={() => void remove(record)}>حذف الزيارة</button></div>
      </details>;
    })}
  </section>;
}
