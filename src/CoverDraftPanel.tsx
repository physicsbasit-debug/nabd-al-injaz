import { useEffect, useState } from 'react';
import type { Schedule } from './schedule-model';
import { COVER_DRAFT_KEY, addCoverAssignment, autoAssignCovers, clearCoverDay, draftCandidates, draftSlots, getCoverBalance, getCoverDailySummary, getCoverDay, getCoverTeacherPolicy, processCoverDay, readCoverStore, removeCoverAssignment, reopenCoverDay, setCoverAbsences, setCoverTeacherPolicy, validateAssignment, weekdayForDate } from './cover-planning';
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
  const summary = getCoverDailySummary(schedule, store, date);
  const processed = !!record.processedAt;
  const hasProcessedDays = Object.values(store.days).some((item) => !!item.processedAt);
  const history = Object.entries(store.days).filter(([, item]) => item.absent.length || item.assignments.length).sort(([a], [b]) => b.localeCompare(a));
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
  const processDay = () => {
    try { setStore(processCoverDay(schedule, store, date)); setMessage('حُفظت معالجة اليوم على هذا الجهاز.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ معالجة اليوم.'); }
  };
  const editProcessedDay = () => {
    if (!window.confirm('سيُعاد اليوم إلى حالة المسودة لتعديل الغياب والتكليفات. هل تريد المتابعة؟')) return;
    setStore(reopenCoverDay(store, date)); setMessage('أُعيد اليوم إلى المسودة ويمكنك تعديله.');
  };
  const undoDay = () => {
    if (!window.confirm('سيُحذف سجل هذا اليوم بالكامل، بما فيه الغياب والتكليفات. هل تريد المتابعة؟')) return;
    setStore(clearCoverDay(store, date)); setMessage('حُذف سجل اليوم من هذا الجهاز.');
  };
  const invalidCount = record.assignments.filter((a) => validateAssignment(schedule, store, a)).length;
  return (
    <section className="card cover-draft" aria-label="مسودة توزيع الاحتياط">
      <h3>معاينة الاحتياط للغياب</h3>
      <p>سجّل الغياب، راجع التوزيع، ثم احفظ معالجة اليوم. السجل محلي على هذا الجهاز ولا يرسل تكليفات أو إشعارات.</p>
      <label>تاريخ الغياب<input aria-label="تاريخ مسودة الاحتياط" type="date" value={date} onChange={(e) => { setDate(e.target.value); setChoices({}); setMessage(''); }} /></label>
      {day && <div className="cover-daily-summary" aria-label="ملخص الاحتياط اليومي">
        <div><strong>{summary.absentCount}</strong><span>معلم غائب</span></div><div><strong>{summary.required}</strong><span>حصة مطلوبة</span></div><div><strong>{summary.assigned}</strong><span>لها بديل</span></div><div className={summary.uncovered ? 'needs-attention' : ''}><strong>{summary.uncovered}</strong><span>دون بديل</span></div>
      </div>}
      {processed && <p className="cover-processed" role="status">اليوم محفوظ كمعالَج محليًا · {new Intl.DateTimeFormat('ar-OM', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.processedAt!))}</p>}
      <h4>سياسة توزيع البدائل</h4>
      <p>الترتيب المقترح: الأقل رصيدًا حتى هذا التاريخ، ثم معلم القسم نفسه بحسب المادة الظاهرة في الجدول، ثم الأقل تكليفًا اليوم. عند استمرار التعادل تُراعى الأولوية اليدوية ثم الاسم. راجع المقترحات قبل الحفظ.</p>
      {hasProcessedDays && <p className="cover-warning">خيارات الاستثناء والأولوية والرصيد مقفلة لوجود يوم محفوظ؛ افتح الأيام المحفوظة للتعديل أولًا حتى لا يتغير تقييم تكليفاتها السابقة.</p>}
      <div className="cover-policy-list" aria-label="سياسة تكليف البدائل">
        {schedule.teachers.map((name) => {
          const policy = getCoverTeacherPolicy(store, name);
          return <details key={name} className="cover-policy-item" data-teacher={name}>
            <summary><strong>{name}</strong><span>الرصيد حتى التاريخ المحدد: {getCoverBalance(schedule, store, name, date)} · {policy.exempt ? 'مستثنى' : policy.priority ? 'أولوية ' + policy.priority : 'دون أولوية خاصة'}</span></summary>
            <div className="cover-policy-fields">
              <label><input type="checkbox" aria-label={'استثناء ' + name} checked={policy.exempt} disabled={hasProcessedDays} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { exempt: e.target.checked }))} />استثناء من تكليف الاحتياط</label>
              <label>الرصيد السابق · {name}<input aria-label={'رصيد سابق ' + name} type="number" min="0" max="10000" step="1" value={policy.carryInBalance} disabled={hasProcessedDays} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { carryInBalance: Number(e.target.value) }))} /></label>
              <label>أولوية التوزيع · {name}<input aria-label={'أولوية ' + name} type="number" min="0" max="99" step="1" value={policy.priority} disabled={hasProcessedDays} onChange={(e) => setStore((current) => setCoverTeacherPolicy(current, name, { priority: Number(e.target.value) }))} /><small>1 أعلى أولوية، و0 دون أولوية خاصة.</small></label>
            </div>
          </details>;
        })}
      </div>
      {!day ? <p role="status">اختر يومًا دراسيًا صالحًا من الأحد إلى الخميس.</p> : <>
        <p>اليوم: <strong>{day}</strong>. اختر الغائبين بعد التأكد من صحة التاريخ.</p>
        <div className="cover-absences schedule-absent">
          {schedule.teachers.map((name) => <label key={name}><input type="checkbox" checked={record.absent.includes(name)} disabled={processed} onChange={(e) => saveAbsent(name, e.target.checked)} />{name}</label>)}
        </div>
        {record.absent.length > 0 && <>
          <div className="cover-auto-actions"><p>يملأ التوزيع الآلي الحصص التي لها بديل مؤكد، ويترك الباقي دون تكليف.</p><button type="button" disabled={processed || !slots.length || invalidCount > 0} onClick={autoAssign}>توزيع تلقائي للمسودة</button></div>
          <h4>الحصص المطلوب تغطيتها ({slots.length})</h4>
          {record.absent.some((name) => !schedule.verifiedDays?.some((c) => c.teacher === name && c.day === day)) && <p className="cover-warning">بعض جداول الغائبين غير مؤكدة الاكتمال. قد توجد حصص غير مسجلة؛ لن يُسمح بتكليف البدائل لهذه الحصص حتى التحقق.</p>}
          {!slots.length ? <p>لا توجد حصص مسجلة لهؤلاء الغائبين؛ لا يمكن الجزم بعدم وجود احتياط.</p> :
            <div className="schedule-table-wrap"><table><thead><tr><th>الغائب</th><th>الحصة</th><th>المادة أو الصف</th><th>البديل المقترح</th></tr></thead><tbody>{slots.map((slot) => {
              const candidates = draftCandidates(schedule, store, date, slot.id);
              const assigned = record.assignments.find((a) => a.lessonId === slot.id);
              return <tr key={slot.id}><td>{slot.teacher}</td><td>{slot.period}</td><td>{slot.description || 'غير محدد'}</td><td>{assigned ? 'مسجل في المسودة: ' + assigned.substitute : <div className="cover-choice"><select aria-label={'بديل ' + slot.teacher + ' الحصة ' + slot.period} disabled={processed} value={choices[slot.id] ?? ''} onChange={(e) => setChoices((current) => ({ ...current, [slot.id]: e.target.value }))}><option value="">اختر البديل</option>{candidates.map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="button" disabled={processed || !choices[slot.id] || !candidates.includes(choices[slot.id])} onClick={() => add(slot.id)}>إضافة للمسودة</button>{!candidates.length && <span>لا يوجد بديل مؤكد</span>}</div>}</td></tr>;
            })}</tbody></table></div>}
        </>}
        <h4>تكليفات المسودة ({record.assignments.length})</h4>
        {invalidCount > 0 && <p className="cover-warning" role="alert">{invalidCount} تكليف غير صالح بعد تغيير الجدول أو الغياب؛ يجب إزالته أو تصحيحه قبل استخدام المسودة.</p>}
        {!record.assignments.length ? <p>لا توجد تكليفات محفوظة لهذا التاريخ.</p> :
          <div className="schedule-table-wrap"><table><thead><tr><th>الغائب</th><th>البديل</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{record.assignments.map((a) => {
            const reason = validateAssignment(schedule, store, a);
            return <tr key={a.id}><td>{a.absentTeacher}</td><td>{a.substitute}</td><td>{reason ? 'غير صالح: ' + reason : processed ? 'محفوظ ضمن معالجة اليوم' : 'صالح للمراجعة اليدوية'}</td><td><button type="button" disabled={processed} aria-label={'إلغاء تكليف ' + a.substitute + ' عن ' + a.absentTeacher} onClick={() => { setStore(removeCoverAssignment(store, date, a.id)); setMessage('أُلغي التكليف من المسودة.'); }}>إلغاء</button></td></tr>;
          })}</tbody></table></div>}
        <div className="cover-day-actions">{processed ? <button type="button" onClick={editProcessedDay}>إعادة فتح اليوم للتعديل</button> : <button type="button" disabled={!record.absent.length || invalidCount > 0} onClick={processDay}>حفظ معالجة اليوم</button>}{(record.absent.length > 0 || record.assignments.length > 0) && <button type="button" className="cover-undo" onClick={undoDay}>التراجع عن سجل اليوم</button>}</div>
        {summary.bySubstitute.length > 0 && <div className="cover-loads"><h4>نصيب البدائل اليوم</h4><ul>{summary.bySubstitute.map(([name, count]) => <li key={name}>{name}<strong>{count} {count === 1 ? 'حصة' : 'حصص'}</strong></li>)}</ul></div>}
      </>}
      {history.length > 0 && <details className="cover-history"><summary>سجل الأيام السابقة ({history.length})</summary><div className="schedule-table-wrap"><table><thead><tr><th>التاريخ</th><th>الغياب</th><th>مغطاة</th><th>دون بديل</th><th>الحالة</th><th>فتح</th></tr></thead><tbody>{history.map(([historyDate]) => { const item = getCoverDailySummary(schedule, store, historyDate); return <tr key={historyDate}><td>{historyDate}</td><td>{item.absentCount}</td><td>{item.assigned}</td><td>{item.uncovered}</td><td>{item.processedAt ? 'محفوظ' : 'مسودة'}</td><td><button type="button" onClick={() => { setDate(historyDate); setChoices({}); setMessage(''); }}>عرض اليوم</button></td></tr>; })}</tbody></table></div></details>}
      {message && <p role="status" className="schedule-message">{message}</p>}
    </section>
  );
}
