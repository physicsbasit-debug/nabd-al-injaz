import { useRef, useState } from 'react';
import { checkShortTest, isReviewRecord, readShortTests, SHORT_TEST_KEY, type Grade, type ReviewRecord, type ShortTestNumbers } from './short-test-model';
import { withAssessmentLock } from './assessment-lock';
import './short-test-review.css';

const fields: [keyof Omit<ShortTestNumbers, 'grade'>, string][] = [
  ['lessons', 'عدد الدروس'], ['items', 'عدد المفردات'], ['total', 'الدرجة الكلية'],
  ['knowledge', 'درجات المعرفة'], ['application', 'درجات التطبيق'], ['reasoning', 'درجات الاستدلال'],
  ['multipleChoice', 'مفردات الاختيار من متعدد'], ['longAnswer', 'مفردات الإجابة الطويلة'],
];
const empty = { grade: '8' as Grade, items: '', total: '', knowledge: '', application: '', reasoning: '', multipleChoice: '', longAnswer: '', lessons: '', teacher: '', subject: '', title: '', status: 'بانتظار المراجعة' as ReviewRecord['status'], notes: '' };
export default function ShortTestReview() {
  const [loaded] = useState(() => { try { return { records:readShortTests(), error:false }; } catch { return { records:[] as ReviewRecord[], error:true }; } });
  const [records, setRecords] = useState(loaded.records);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const editSnapshot = useRef<ReviewRecord | null>(null);
  const [message, setMessage] = useState('');
  async function save() {
    if (loaded.error) return;
    if (!form.teacher.trim() || !form.subject.trim() || !form.title.trim() || fields.some(([key]) => form[key].trim() === '')) { setMessage('أكمل بيانات الاختبار والأعداد قبل الحفظ؛ أدخل صفرًا إذا لم يوجد نوع من المفردات.'); return; }
    const numeric = Object.fromEntries(fields.map(([key]) => [key, Number(form[key])])) as Omit<ShortTestNumbers, 'grade'>;
    const record: ReviewRecord = { ...numeric, id: editing ?? crypto.randomUUID(), grade: form.grade, teacher: form.teacher.trim(), subject: form.subject.trim(), title: form.title.trim(), notes: form.notes.trim(), status: form.status };
    if (!isReviewRecord(record)) { setMessage('أدخل أعدادًا صحيحة غير سالبة.'); return; }
    try {
      const next = await withAssessmentLock(async () => {
        const current = readShortTests();
        if (editing && JSON.stringify(current.find(item => item.id === editing)) !== JSON.stringify(editSnapshot.current)) throw new Error('تغيّر السجل في نافذة أخرى؛ افتحه مجددًا قبل التعديل.');
        const updated = editing ? current.map(item => item.id === editing ? record : item) : [...current, record];
        localStorage.setItem(SHORT_TEST_KEY, JSON.stringify(updated));
        return updated;
      });
      setRecords(next); setForm(empty); setEditing(null); editSnapshot.current = null; setMessage('حُفظ سجل المراجعة محليًا.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الحفظ على الجهاز.'); }
  }
  async function remove(record: ReviewRecord) {
    if (loaded.error) return;
    if (!window.confirm('سيُحذف سجل مراجعة الاختبار فقط. هل تريد المتابعة؟')) return;
    let next: ReviewRecord[];
    try { next = await withAssessmentLock(async () => {
      const current = readShortTests();
      if (JSON.stringify(current.find(item => item.id === record.id)) !== JSON.stringify(record)) throw new Error('تغيّر السجل في نافذة أخرى؛ أعد فتح القسم قبل الحذف.');
      const updated = current.filter(item => item.id !== record.id);
      localStorage.setItem(SHORT_TEST_KEY, JSON.stringify(updated));
      return updated;
    }); } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حذف السجل من الجهاز.'); return; }
    setRecords(next);
    if (editing === record.id) { setEditing(null); setForm(empty); }
    setMessage('حُذف سجل مراجعة الاختبار.');
  }
  function edit(record: ReviewRecord) {
    editSnapshot.current = record;
    setForm({ grade: record.grade, teacher: record.teacher, subject: record.subject, title: record.title, notes: record.notes, status: record.status, ...Object.fromEntries(fields.map(([key]) => [key, String(record[key])])) } as typeof empty);
    setEditing(record.id); setMessage('يمكنك تعديل السجل ثم حفظه.');
  }
  return <section className="card short-test-review" aria-label="مراجعة الاختبارات القصيرة">
    <h2>مراجعة الاختبارات القصيرة</h2>
    {loaded.error && <p role="alert">تعذر قراءة سجلات المراجعة؛ أوقفنا التعديل لحماية البيانات. استعد نسخة سليمة.</p>}
    <p className="short-test-source">هذه مراجعة اختيارية بسجل مستقل عن سجل المتابعة أعلاه، وتُستخدم لفحص المواصفات العددية.</p>
    <p>سجّل بيانات الاختبار لمقارنة الأعداد بالوثيقة. فحص الأعداد لا يغني عن مراجعة الأسئلة ونموذج الإجابة ومحتواهما؛ قرار المراجعة يحدده المعلم الأول.</p>
    <p className="short-test-source">المرجع: وثيقة تقويم تعلم الطلبة في مواد العلوم (5–10)، إصدار 2026–2027، الصفحتان 20 و21.</p>
    <div className="short-test-fields">
      <label>عنوان الاختبار<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>المعلم<input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} /></label>
      <label>المادة<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
      <label>الصف<select aria-label="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}><option value="8">الثامن</option><option value="9">التاسع</option><option value="10">العاشر</option></select></label>
      {fields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max="1000" step="1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label className="short-test-status">حالة المراجعة<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ReviewRecord['status'] })}><option>بانتظار المراجعة</option><option>يحتاج تعديلًا</option><option>تمت المراجعة</option></select></label>
      <label className="short-test-notes">ملاحظات المراجع<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    </div>
    <div><button type="button" disabled={loaded.error} onClick={save}>{editing ? 'حفظ التعديل' : 'حفظ سجل الاختبار'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>إلغاء التعديل</button>}</div>
    {message && <p role="status">{message}</p>}
    <h3>السجلات ({records.length})</h3>
    {!loaded.error && records.length === 0 && <p>لا توجد اختبارات مسجلة بعد.</p>}
    {records.map((record) => { const issues = checkShortTest(record); return <details key={record.id} className="short-test-item">
      <summary><strong>{record.title}</strong><span>{record.teacher} · الصف {record.grade} · {record.status}</span></summary>
      <p>{record.subject} · {record.items} مفردة · {record.total} درجة</p>
      <h4>فحص المواصفات العددية</h4>
      {issues.length ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>الأعداد المدخلة توافق البنود العددية المفحوصة؛ بقية البنود تحتاج مراجعة يدوية.</p>}
      <p>تحقق يدويًا من مراجعة الاختبار ونموذج الإجابة قبل التطبيق، وتنوع أهداف التعلم، ومناسبة الأسئلة والزمن، وتغطية الاختيار من متعدد لأهداف التقويم حيث ينطبق.</p>
      {record.notes && <p>ملاحظات المراجع: {record.notes}</p>}
      <button type="button" onClick={() => edit(record)}>تعديل سجل الاختبار</button>
      <button type="button" onClick={() => void remove(record)}>حذف سجل الاختبار</button>
    </details>; })}
  </section>;
}
