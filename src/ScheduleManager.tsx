import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { previewScheduleExcel, type SchedulePreview } from './schedule-import';
import { addLesson, DAYS, freeTeachers, verifiedFreeTeachers, isDayVerified, setDayVerification, mergeScheduleBatch, removeLesson, absenceSlots, coverCandidates, normalizeTeacher, readSchedule, SCHEDULE_STORAGE_KEY, type Day, type Schedule } from './schedule-model';
import './schedule-manager.css';

export default function ScheduleManager() {
  const [schedule, setSchedule] = useState<Schedule>(readSchedule);
  const [teacherName, setTeacherName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [day, setDay] = useState<Day>('الأحد');
  const [period, setPeriod] = useState(1);
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [wideConfirmed, setWideConfirmed] = useState(false);
  const [verificationTeacher, setVerificationTeacher] = useState('');
  const [absentTeachers, setAbsentTeachers] = useState<string[]>([]);
  useEffect(() => { localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule)); }, [schedule]);
  const provisionalFree = freeTeachers(schedule, day, period);
  const free = verifiedFreeTeachers(schedule, day, period);
  const slots = absenceSlots(schedule, day, absentTeachers);
  const addTeacher = (event: FormEvent) => {
    event.preventDefault();
    const name = normalizeTeacher(teacherName);
    if (!name) { setMessage('أدخل اسم المعلم.'); return; }
    if (schedule.teachers.includes(name)) { setMessage('المعلم موجود بالفعل.'); return; }
    setSchedule((current) => ({ ...current, teachers: [...current.teachers, name] }));
    setTeacher(name);
    setTeacherName('');
    setMessage('تمت إضافة المعلم.');
  };
  const saveLesson = (event: FormEvent) => {
    event.preventDefault();
    try {
      const updated = addLesson(schedule, { teacher, day, period, description });
      setSchedule(updated);
      setDescription('');
      setMessage('تم تسجيل الحصة.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذّر حفظ الحصة.'); }
  };
  const importFile = async (file?: File) => {
    setPreview(null);
    setWideConfirmed(false);
    setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      const result = await previewScheduleExcel(file);
      setPreview(result);
      if (result.errors.length) setMessage('توجد صفوف غير صالحة؛ لن تُعتمد بيانات جزئية.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذّرت قراءة الملف.'); }
    finally { setBusy(false); }
  };
  const approve = () => {
    if (!preview || preview.errors.length || (preview.format === 'wide' && !wideConfirmed) || (!preview.rows.length && !preview.verifiedDays.length)) return;
    try {
      const updated = mergeScheduleBatch(schedule, preview);
      setSchedule(updated);
      setPreview(null);
      setMessage('تم اعتماد ' + preview.rows.length + ' حصة و' + preview.verifiedDays.length + ' يومًا موثق الاكتمال، دون استبدال البيانات السابقة.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعارض مع جدول موجود؛ لم يُعتمد أي صف.'); }
  };
  return (
    <section className="schedule-manager" aria-label="إدارة جداول المعلمين">
      <div className="schedule-intro">
        <h2>جداول المعلمين والمتفرغون</h2>
        <p>سجّل المعلمين وحصصهم، ثم تحقق من اكتمال الجداول قبل اعتبار أي معلم متفرغًا للاحتياط. البيانات محلية في هذا المتصفح فقط.</p>
      </div>
      <div className="schedule-panels">
        <section className="card">
          <h3>قائمة المعلمين</h3>
          <form onSubmit={addTeacher} className="schedule-inline-form">
            <label>اسم المعلم<input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} maxLength={100} required /></label>
            <button type="submit">إضافة معلم</button>
          </form>
          <p>المعلمون المسجلون: {schedule.teachers.length}</p>
          <div className="schedule-teacher-tags">{schedule.teachers.map((name) => <span key={name}>{name}</span>)}</div>
        </section>
        <section className="card">
          <h3>تسجيل حصة</h3>
          <form onSubmit={saveLesson} className="schedule-fields">
            <label>المعلم<select aria-label="معلم الحصة" value={teacher} onChange={(e) => setTeacher(e.target.value)} required><option value="">اختر المعلم</option>{schedule.teachers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>اليوم<select aria-label="يوم الحصة" value={day} onChange={(e) => setDay(e.target.value as Day)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label>رقم الحصة<input aria-label="رقم الحصة" type="number" min="1" max="12" value={period} onChange={(e) => setPeriod(Number(e.target.value))} required /></label>
            <label>المادة أو الصف<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={150} /></label>
            <button type="submit">حفظ الحصة</button>
          </form>
        </section>
      </div>
      <section className="card">
        <h3>استيراد جدول Excel</h3>
        <p>يُقبل ملف XLSX جدولي (المعلم، اليوم، الحصة) أو صف لكل معلم ويوم مع أعمدة ح1، ح2... وتظهر معاينة قبل الاعتماد. لا تُستنتج الفراغات من جدول ناقص أو خلايا غامضة.</p>
        <label className="schedule-file-label">ملف جدول المعلمين<input aria-label="ملف جدول المعلمين" type="file" accept=".xlsx" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void importFile(file); }} /></label>
        {preview && <div className="schedule-preview">
          <h4>معاينة: {preview.sheet}</h4>
          <p>نوع القالب: {preview.format === 'wide' ? 'جدول حصص أفقي' : 'قائمة حصص'}، صفوف المعلمين: {preview.totalRows}، حصص صالحة: {preview.rows.length}، أيام قابلة للتوثيق: {preview.verifiedDays.length}، أخطاء: {preview.errors.length}</p>
          {preview.errors.length > 0 && <ul>{preview.errors.slice(0, 10).map((error, i) => <li key={i}>{error}</li>)}</ul>}
          <div className="schedule-table-wrap"><table><thead><tr><th>المعلم</th><th>اليوم</th><th>الحصة</th><th>المادة</th></tr></thead><tbody>{preview.rows.slice(0, 15).map((row, i) => <tr key={i}><td>{row.teacher}</td><td>{row.day}</td><td>{row.period}</td><td>{row.description}</td></tr>)}</tbody></table></div>
          {preview.format === 'wide' && <label className="schedule-confirm"><input type="checkbox" checked={wideConfirmed} onChange={(e) => setWideConfirmed(e.target.checked)} />أؤكد أن صفوف الأيام كاملة، وأن خلايا الحصص الفارغة تعني فراغًا فعليًا، وليست بيانات ناقصة.</label>}
          <button type="button" disabled={!!preview.errors.length || (preview.format === 'wide' && !wideConfirmed) || (!preview.rows.length && !preview.verifiedDays.length)} onClick={approve}>اعتماد الجدول ({preview.rows.length})</button>
          <button type="button" onClick={() => setPreview(null)}>إلغاء المعاينة</button>
        </div>}
      </section>
      <section className="card">
        <h3>التحقق من اكتمال جدول المعلم</h3>
        <p>يُعتبر المعلم متفرغًا بصورة موثوقة فقط بعد تأكيد اكتمال جميع حصص يومه. تُلغى هذه الثقة تلقائيًا عند تعديل حصص ذلك اليوم.</p>
        <div className="schedule-query">
          <label>المعلم المطلوب التحقق منه<select aria-label="معلم التحقق" value={verificationTeacher} onChange={(e) => setVerificationTeacher(e.target.value)}><option value="">اختر المعلم</option>{schedule.teachers.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>يوم التحقق<select aria-label="يوم التحقق" value={day} onChange={(e) => setDay(e.target.value as Day)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <button type="button" disabled={!verificationTeacher} onClick={() => {
            if (!verificationTeacher) return;
            const alreadyVerified = isDayVerified(schedule, verificationTeacher, day);
            if (!alreadyVerified && !window.confirm('هل تحققت من اكتمال حصص هذا المعلم لهذا اليوم، بما فيها حصص الفراغ؟')) return;
            setSchedule((current) => setDayVerification(current, verificationTeacher, day, !alreadyVerified));
            setMessage(alreadyVerified ? 'أُلغي توثيق اكتمال اليوم.' : 'تم توثيق اكتمال يوم المعلم.');
          }}>{verificationTeacher && isDayVerified(schedule, verificationTeacher, day) ? 'إلغاء التوثيق' : 'تأكيد اكتمال اليوم'}</button>
        </div>
      </section>
      <section className="card">
        <h3>المتفرغون المؤكدون حسب اليوم والحصة</h3>
        <div className="schedule-query">
          <label>اليوم<select aria-label="يوم الاستعلام" value={day} onChange={(e) => setDay(e.target.value as Day)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>الحصة<input aria-label="حصة الاستعلام" type="number" min="1" max="12" value={period} onChange={(e) => setPeriod(Number(e.target.value))} /></label>
        </div>
        <p>متفرغون مؤكّدون: <strong>{free.length} من {schedule.teachers.length}</strong>، حالة غير مؤكدة: {provisionalFree.length - free.length}.</p>
        <p>المعلم غير المسجل له حصة لا يُعد متفرغًا مؤكدًا ما لم يُوثّق اكتمال جدوله لذلك اليوم.</p>
        {schedule.teachers.length === 0 ? <p>أضف أسماء المعلمين أولًا.</p> : free.length === 0 ? <p>لا يوجد متفرغون مؤكدون لهذه الحصة.</p> : <div className="schedule-teacher-tags">{free.map((name) => <span key={name}>{name}</span>)}</div>}
      </section>
      <section className="card">
        <h3>معاينة الاحتياط للغياب</h3>
        <p>اختر المعلمين الغائبين في اليوم المحدد. تُعرض حصصهم التي تحتاج تغطية والمرشحون المتفرغون المؤكدون فقط. لا يجري أي توزيع أو إرسال تلقائي.</p>
        <div className="schedule-absent">{schedule.teachers.map((name) => <label key={name}><input type="checkbox" checked={absentTeachers.includes(name)} onChange={(e) => setAbsentTeachers((old) => e.target.checked ? [...old, name] : old.filter((n) => n !== name))} />{name}</label>)}</div>
        {absentTeachers.length > 0 && (slots.length === 0 ? <p>لا توجد حصص مسجلة للغائبين في هذا اليوم؛ قد يكون الجدول ناقصًا، فلا يمكن الجزم بعدم وجود احتياط.</p> : <div className="schedule-table-wrap"><table><thead><tr><th>الغائب</th><th>الحصة</th><th>الصف أو المادة</th><th>مرشحون مؤكدون</th></tr></thead><tbody>{slots.map((slot) => {
          const candidates = coverCandidates(schedule, day, slot.period, absentTeachers);
          return <tr key={slot.id}><td>{slot.teacher}</td><td>{slot.period}</td><td>{slot.description || 'غير محدد'}</td><td>{candidates.length ? candidates.join('، ') : 'لا يوجد مرشح مؤكد'}</td></tr>;
        })}</tbody></table></div>)}
      </section>
      <section className="card">
        <h3>الحصص المسجلة ({schedule.lessons.length})</h3>
        <div className="schedule-table-wrap"><table><thead><tr><th>المعلم</th><th>اليوم</th><th>الحصة</th><th>المادة</th><th>إجراء</th></tr></thead><tbody>{schedule.lessons.map((lesson) => <tr key={lesson.id}><td>{lesson.teacher}</td><td>{lesson.day}</td><td>{lesson.period}</td><td>{lesson.description}</td><td><button type="button" aria-label={'حذف حصة ' + lesson.teacher + ' ' + lesson.day + ' ' + lesson.period} onClick={() => { if (window.confirm('حذف هذه الحصة من الجدول؟')) setSchedule((current) => removeLesson(current, lesson.id)); }}>حذف</button></td></tr>)}</tbody></table></div>
      </section>
      {message && <p className="schedule-message" role="status">{message}</p>}
    </section>
  );
}
