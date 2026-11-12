import { useState } from 'react';
import { checkShortTest, isReviewRecord, readShortTests, SHORT_TEST_KEY, type Grade, type ReviewRecord, type ShortTestNumbers } from './short-test-model';
import './short-test-review.css';

const fields: [keyof Omit<ShortTestNumbers, 'grade'>, string][] = [
  ['lessons', 'عدد الدروس'], ['items', 'عدد المفردات'], ['total', 'الدرجة الكلية'],
  ['knowledge', 'درجات المعرفة'], ['application', 'درجات التطبيق'], ['reasoning', 'درجات الاستدلال'],
  ['multipleChoice', 'مفردات الاختيار من متعدد'], ['longAnswer', 'مفردات الإجابة الطويلة'],
];
const empty = { grade: '8' as Grade, items: '', total: '', knowledge: '', application: '', reasoning: '', multipleChoice: '', longAnswer: '', lessons: '', teacher: '', subject: '', title: '', status: 'بانتظار المراجعة' as ReviewRecord['status'], notes: '' };
export default function ShortTestReview() {
  const [records, setRecords] = useState(readShortTests);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  function save() {
    if (!form.teacher.trim() || !form.subject.trim() || !form.title.trim() || fields.some(([key]) => form[key].trim() === '')) { setMessage('أكمل بيانات الاختبار والأعداد قبل الحفظ؛ أدخل صفرًا إذا لم يوجد نوع من المفردات.'); return; }
    const numeric = Object.fromEntries(fields.map(([key]) => [key, Number(form[key])])) as Omit<ShortTestNumbers, 'grade'>;
    const record: ReviewRecord = { ...numeric, id: editing ?? crypto.randomUUID(), grade: form.grade, teacher: form.teacher.trim(), subject: form.subject.trim(), title: form.title.trim(), notes: form.notes.trim(), status: form.status };
    if (!isReviewRecord(record)) { setMessage('أدخل أعدادًا صحيحة غير سالبة.'); return; }
    const next = editing ? records.map((item) => item.id === editing ? record : item) : [...records, record];
    try { localStorage.setItem(SHORT_TEST_KEY, JSON.stringify(next)); } catch { setMessage('تعذر الحفظ على الجهاز.'); return; }
    setRecords(next); setForm(empty); setEditing(null); setMessage('حُفظ سجل المراجعة محليًا.');
  }
  function edit(record: ReviewRecord) {
    setForm({ grade: record.grade, teacher: record.teacher, subject: record.subject, title: record.title, notes: record.notes, status: record.status, ...Object.fromEntries(fields.map(([key]) => [key, String(record[key])])) } as typeof empty);
    setEditing(record.id); setMessage('يمكنك تعديل السجل ثم حفظه.');
  }
  return <section className="card short-test-review" aria-label="مراجعة الاختبارات القصيرة">
    <h2>مراجعة الاختبارات القصيرة</h2>
    <p>سجّل بيانات الاختبار لمقارنة الأعداد بالوثيقة. فحص الأعداد لا يغني عن مراجعة الأسئلة ونموذج الإجابة ومحتواهما؛ قرار المراجعة يحدده المعلم الأول.</p>
    <p className="short-test-source">المرجع: وثيقة تقويم تعلم الطلبة في مواد العلوم (5–10)، إصدار 2026–2027، الصفحتان 20 و21.</p>
    <div className="short-test-fields">
      <label>عنوان الاختبار<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>المعلم<input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} /></label>
      <label>المادة<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
      <label>الصف<select aria-label="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}><option value="8">الثامن</option><option value="9">التاسع</option><option value="10">العاشر</option></select></label>
      {fields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max="1000" step="1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label>حالة المراجعة<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ReviewRecord['status'] })}><option>بانتظار المراجعة</option><option>يحتاج تعديلًا</option><option>تمت المراجعة</option></select></label>
      <label className="short-test-notes">ملاحظات المراجع<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    </div>
    <div><button type="button" onClick={save}>{editing ? 'حفظ التعديل' : 'حفظ سجل الاختبار'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>إلغاء التعديل</button>}</div>
    {message && <p role="status">{message}</p>}
    <h3>السجلات ({records.length})</h3>
    {records.length === 0 && <p>لا توجد اختبارات مسجلة بعد.</p>}
    {records.map((record) => { const issues = checkShortTest(record); return <details key={record.id} className="short-test-item">
      <summary><strong>{record.title}</strong><span>{record.teacher} · الصف {record.grade} · {record.status}</span></summary>
      <p>{record.subject} · {record.items} مفردة · {record.total} درجة</p>
      <h4>فحص المواصفات العددية</h4>
      {issues.length ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>الأعداد المدخلة توافق البنود العددية المفحوصة؛ بقية البنود تحتاج مراجعة يدوية.</p>}
      <p>تحقق يدويًا من مراجعة الاختبار ونموذج الإجابة قبل التطبيق، وتنوع أهداف التعلم، ومناسبة الأسئلة والزمن، وتغطية الاختيار من متعدد لأهداف التقويم حيث ينطبق.</p>
      {record.notes && <p>ملاحظات المراجع: {record.notes}</p>}
      <button type="button" onClick={() => edit(record)}>تعديل سجل الاختبار</button>
    </details>; })}
  </section>;
}
