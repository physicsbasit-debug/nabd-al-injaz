import { useEffect, useState } from 'react';
import type { Schedule } from './schedule-model';
import { COVER_DRAFT_KEY, addCoverAssignment, autoAssignCovers, draftCandidates, draftSlots, getCoverBalance, getCoverDay, getCoverTeacherPolicy, readCoverStore, removeCoverAssignment, setCoverAbsences, setCoverTeacherPolicy, validateAssignment, weekdayForDate } from './cover-planning';
import './cover-draft.css';

function todayLocal(): string {
  const date = new Date();
  const part = (n: number) => String(n).padStart(2, '0');
  return [date.getFullYear(), part(date.getMonth() + 1), part(date.getDate())].join('-');
}
export default function CoverDraftPanel({ schedule }: { schedule: Schedule }) {
  const [store, setStore] = useState(readCoverStore);
  const [date, setDate] = useState(todayLocal);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { localStorage.setItem(COVER_DRAFT_KEY, JSON.stringify(store)); }
    catch { setMessage('تعذّر حفظ المسودة في هذا المتصفح؛ تحقق من مساحة التخزين.'); }
  }, [store]);
  const day = weekdayForDate(date);
  const record = getCoverDay(store, date);
  const slots = draftSlots(schedule, store, date);
  const saveAbsent = (name: string, checked: boolean) => {
    try {
      const absent = checked ? [...record.absent, name] : record.absent.filter((n) => n !== name);
      setStore(setCoverAbsences(store, date, absent, schedule));
      setMessage('حُفظ تحديث الغياب. راجع صلاحية أي تكليف سابق بعد التعديل.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر تحديث الغياب.'); }
  };
  const add = (lessonId: string) => {
    try {
      setStore(addCoverAssignment(schedule, store, date, lessonId, choices[lessonId] ?? ''));
      setChoices((current) => ({ ...current, [lessonId]: '' }));
      setMessage('أُضيف التكليف إلى المسودة المحلية فقط، ولم يُعتمد أو يُرسل.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذّر تسجيل التكليف.'); }
  };
  const autoAssign = () => {
    const result = autoAssignCovers(schedule, store, date);
    if (result.blockedReason) { setMessage('تعذّر التوزيع الآلي: ' + result.blockedReason); return; }
    setStore(result.store);
    setMessage('التوزيع الآلي: أُضيف ' + result.added.length + ' تكليفًا إلى المسودة، وبقيت ' + result.uncovered.length + ' حصة دون بديل مؤكد. راجع المسودة قبل اعتمادها.');
  };
  const invalidCount = record.assignments.filter((a) => validateAssignment(schedule, store, a)).length;
  return (
    <section className="card cover-draft" aria-label="مسودة توزيع الاحتياط">
      <h3>مسودة توزيع الاحتياط</h3>
      <p>توزيع يدوي أو آلي مقترح، بتاريخ محدد، دون اعتماد رسمي أو رسائل. لا يُتاح البديل إلا إذا كان جدوله مكتملًا ومؤكدًا، وغير غائب أو مشغول.</p>
      <label>تاريخ الغياب<input aria-label="تاريخ مسودة الاحتياط" type="date" value={date} onChange={(e) => { setDate(e.target.value); setChoices({}); setMessage(''); }} /></label>
      <h4>سياسة توزيع البدائل</h4>
      <p>يُستثنى المعلم عند تفعيل الاستثناء. يتقدم صاحب الرصيد الأقل؛ وعند التعادل تُقدّم الأولوية الأقل رقمًا. الرصيد السابق يضاف إلى التكليفات الصالحة المسجلة في المسودات المحلية.</p>
      <div className="cover-policy-list" aria-label="سياسة تكليف البدائل">
        {schedule.teachers.map((name) => {
          const policy = getCoverTeacherPolicy(store, name);
          return <details key={name} className="cover-policy-item" data-teacher={name}>
            <summary><strong>{name}</strong><span>الرصيد الحالي: {getCoverBalance(schedule, store, name)} · {policy.exempt ? 'مستثنى' : policy.priority ? 'أولوية ' + policy.priority : 'دون أولوية خاصة'}</span></summary>
            <div className="cover-policy-fields">
              <label><input type="checkbox" aria-label={'استثناء ' + name} checked={policy.exempt} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { exempt: e.target.checked }))} />استثناء من تكليف الاحتياط</label>
              <label>الرصيد السابق · {name}<input aria-label={'رصيد سابق ' + name} type="number" min="0" max="10000" step="1" value={policy.carryInBalance} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { carryInBalance: Number(e.target.value) }))} /></label>
              <label>أولوية التوزيع · {name}<input aria-label={'أولوية ' + name} type="number" min="0" max="99" step="1" value={policy.priority} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { priority: Number(e.target.value) }))} /><small>1 أعلى أولوية، و0 دون أولوية خاصة.</small></label>
            </div>
          </details>;
        })}
      </div>
      {!day ? <p role="status">اختر يومًا دراسيًا صالحًا من الأحد إلى الخميس.</p> : <>
        <p>اليوم: <strong>{day}</strong>. اختر الغائبين بعد التأكد من صحة التاريخ.</p>
        <div className="cover-absences">
          {schedule.teachers.map((name) => <label key={name}><input type="checkbox" checked={record.absent.includes(name)} onChange={(e) => saveAbsent(name, e.target.checked)} />{name}</label>)}
        </div>
        {record.absent.length > 0 && <>
          <div className="cover-auto-actions"><p>يملأ التوزيع الآلي الحصص التي لها بديل مؤكد، ويترك الباقي دون تكليف.</p><button type="button" disabled={!slots.length || invalidCount > 0} onClick={autoAssign}>توزيع تلقائي للمسودة</button></div>
          <h4>الحصص المطلوب تغطيتها ({slots.length})</h4>
          {record.absent.some((name) => !schedule.verifiedDays?.some((c) => c.teacher === name && c.day === day)) && <p className="cover-warning">بعض جداول الغائبين غير مؤكدة الاكتمال. قد توجد حصص غير مسجلة؛ لن يُسمح بتكليف البدائل لهذه الحصص حتى التحقق.</p>}
          {!slots.length ? <p>لا توجد حصص مسجلة لهؤلاء الغائبين؛ لا يمكن الجزم بعدم وجود احتياط.</p> :
            <div className="schedule-table-wrap"><table><thead><tr><th>الغائب</th><th>الحصة</th><th>المادة أو الصف</th><th>البديل المقترح</th></tr></thead><tbody>{slots.map((slot) => {
              const candidates = draftCandidates(schedule, store, date, slot.id);
              const assigned = record.assignments.find((a) => a.lessonId === slot.id);
              return <tr key={slot.id}><td>{slot.teacher}</td><td>{slot.period}</td><td>{slot.description || 'غير محدد'}</td><td>{assigned ? 'مسجل في المسودة: ' + assigned.substitute : <div className="cover-choice"><select aria-label={'بديل ' + slot.teacher + ' الحصة ' + slot.period} value={choices[slot.id] ?? ''} onChange={(e) => setChoices((current) => ({ ...current, [slot.id]: e.target.value }))}><option value="">اختر البديل</option>{candidates.map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="button" disabled={!choices[slot.id] || !candidates.includes(choices[slot.id])} onClick={() => add(slot.id)}>إضافة للمسودة</button>{!candidates.length && <span>لا يوجد بديل مؤكد</span>}</div>}</td></tr>;
            })}</tbody></table></div>}
        </>}
        <h4>تكليفات المسودة ({record.assignments.length})</h4>
        {invalidCount > 0 && <p className="cover-warning" role="alert">{invalidCount} تكليف غير صالح بعد تغيير الجدول أو الغياب؛ يجب إزالته أو تصحيحه قبل استخدام المسودة.</p>}
        {!record.assignments.length ? <p>لا توجد تكليفات محفوظة لهذا التاريخ.</p> :
          <div className="schedule-table-wrap"><table><thead><tr><th>الغائب</th><th>البديل</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{record.assignments.map((a) => {
            const reason = validateAssignment(schedule, store, a);
            return <tr key={a.id}><td>{a.absentTeacher}</td><td>{a.substitute}</td><td>{reason ? 'غير صالح: ' + reason : 'صالح للمراجعة اليدوية'}</td><td><button type="button" aria-label={'إلغاء تكليف ' + a.substitute + ' عن ' + a.absentTeacher} onClick={() => { setStore(removeCoverAssignment(store, date, a.id)); setMessage('أُلغي التكليف من المسودة.'); }}>إلغاء</button></td></tr>;
          })}</tbody></table></div>}
      </>}
      {message && <p role="status" className="schedule-message">{message}</p>}
    </section>
  );
}
