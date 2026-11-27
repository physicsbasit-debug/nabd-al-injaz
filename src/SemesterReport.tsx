import { useState } from 'react';
import { PdfExport } from './PdfExport';
import type { Task } from './task-model';
import type { Plan } from './plan-model';
import { localDateKey } from './dashboard-metrics';
import { DUTY_GROUPS } from './duties';
import { readRoutineStore, semesterOf } from './duty-routine';
import { readDutyRecords } from './duty-records';
import {
  REPORT_FIELDS,
  buildSemesterReport,
  emptySemesterReportStore,
  periodUnit,
  previousSemester,
  readSemesterReportStore,
  setSemesterNote,
  writeSemesterReportStore,
  type ReportField,
} from './semester-report-model';
import './semester-report.css';

type Props = { tasks: Task[]; plans: Plan[] };
const pct = (v: number | null) => (v === null ? '—' : Math.round(v * 100) + '٪');
const formatDay = (day: string) =>
  new Intl.DateTimeFormat('ar-OM', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));

export default function SemesterReport({ tasks, plans }: Props) {
  const today = localDateKey(new Date());
  const [which, setWhich] = useState<'current' | 'previous'>('current');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [broken] = useState(() => {
    try {
      readSemesterReportStore();
      return false;
    } catch {
      return true;
    }
  });
  const [notesStore, setNotesStore] = useState(() => {
    try {
      return readSemesterReportStore();
    } catch {
      return emptySemesterReportStore();
    }
  });
  const semester = which === 'current' ? semesterOf(today) : previousSemester(today);
  const report = buildSemesterReport({ today, semester, store: readRoutineStore(), records: readDutyRecords(tasks, plans, today) });
  const notes = notesStore.semesters[semester.key] ?? {};
  const until = today < semester.end ? today : semester.end;
  const count = (id: number) => report.rows.find((r) => r.duty.id === id)?.count ?? 0;
  const keyNumbers = [
    ['زيارات إشرافية', count(11)],
    ['برامج إنماء منفذة', count(27)],
    ['اجتماعات دورية', count(16)],
    ['أيام احتياط معالجة', count(4)],
    ['فحوص سجلات المعلمين', count(30)],
    ['متابعات إدخال الدرجات', count(24)],
  ] as const;
  const save = (field: ReportField, value: string) => {
    if (broken) return;
    const next = setSemesterNote(notesStore, semester.key, field, value);
    setNotesStore(next);
    writeSemesterReportStore(next);
  };

  return (
    <section className="reports semester-report" aria-label="التقرير الفصلي حسب الواجبات">
      <div className="reports-heading">
        <h2>التقرير الفصلي حسب الواجبات</h2>
        <p>يُبنى من روتين الواجبات وسجلات الأقسام، مرتبًا حسب بطاقة الوصف الوظيفي (الواجبان 32 و43).</p>
      </div>
      <div className="reports-controls">
        <label>
          الفصل
          <select value={which} onChange={(e) => setWhich(e.target.value as 'current' | 'previous')}>
            <option value="current">{semesterOf(today).label} (الحالي)</option>
            <option value="previous">{previousSemester(today).label} (السابق)</option>
          </select>
        </label>
        <label className="semester-check">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          إخفاء الواجبات دون سجلات
        </label>
        <PdfExport disabled={false} filename={`semester-report-${semester.key}.pdf`} />
      </div>
      <details className="semester-editor" open>
        <summary>كتابة التقويم الذاتي والمقترحات</summary>
        {(report.suggestedStrengths.length > 0 || report.suggestedPriorities.length > 0) && (
          <p className="semester-hint">
            اقتراح من البيانات: {report.suggestedStrengths.length > 0 && <>أعلى التزام في {report.suggestedStrengths.join('، ')}. </>}
            {report.suggestedPriorities.length > 0 && <>{report.suggestedStrengths.length > 0 ? 'وأقل' : 'أقل'} التزام في {report.suggestedPriorities.join('، ')}.</>}
          </p>
        )}
        <div className="semester-fields">
          {REPORT_FIELDS.map(([field, label]) => (
            <label key={semester.key + field}>
              {label}
              <textarea rows={3} maxLength={3000} readOnly={broken} defaultValue={notes[field] ?? ''} onBlur={(e) => save(field, e.target.value)} />
            </label>
          ))}
        </div>
      </details>
      {broken && <p role="alert">ملاحظات التقرير المحفوظة تالفة؛ عُطّل حفظها حتى لا تُستبدل. استعد نسخة احتياطية.</p>}

      <div className="report-preview" dir="rtl">
        <header className="report-document-header">
          <div className="report-official-identity">
            <p>سلطنة عُمان</p>
            <p>وزارة التعليم</p>
            <p>مدرسة الباسط للتعليم الأساسي (8–10)</p>
          </div>
          <h2>التقرير الفصلي لأعمال المعلم الأول</h2>
          <p>
            {semester.label} · من {formatDay(semester.start)} إلى {formatDay(until)} · تاريخ الإعداد: {today}
          </p>
        </header>

        <div className="semester-summary">
          <div><b>{report.recorded}</b><span>من 44 واجبًا لها إنجاز مسجل</span></div>
          <div><b>{pct(report.compliance)}</b><span>الالتزام بالواجبات الدورية</span></div>
          {keyNumbers.map(([label, value]) => (
            <div key={label}><b>{value}</b><span>{label}</span></div>
          ))}
        </div>

        <div className="report-table-wrap">
          <table className="semester-table">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr><th>م</th><th>الواجب</th><th>التكرار</th><th>الإنجاز</th><th>الحالة</th><th>أمثلة من الشواهد</th></tr>
            </thead>
            {DUTY_GROUPS.map((group) => {
              const rows = report.rows.filter((r) => r.duty.group === group && (!hideEmpty || r.count > 0));
              if (!rows.length) return null;
              return (
                <tbody key={group}>
                  <tr className="semester-group"><th colSpan={6} scope="colgroup">{group}</th></tr>
                  {rows.map((r) => (
                    <tr key={r.duty.id}>
                      <td>{r.duty.id}</td>
                      <td><strong>{r.duty.short}</strong></td>
                      <td>{r.frequency}</td>
                      <td>
                        {r.routine && r.periodsElapsed
                          ? `${r.periodsDone} من ${r.periodsElapsed} ${periodUnit(r.frequency, r.periodsElapsed)} (${pct(r.rate)})`
                          : r.count
                            ? `${r.count} ${r.count === 1 ? 'مرة' : 'مرات'}`
                            : '—'}
                      </td>
                      <td><span className={'semester-status s-' + (r.status === 'منجز' ? 'done' : r.status === 'جزئي' ? 'part' : 'none')}>{r.status}</span></td>
                      <td>{r.examples.length ? r.examples.join('؛ ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>

        <h3 className="semester-h">التقويم الذاتي والمقترحات</h3>
        <dl className="semester-notes">
          {REPORT_FIELDS.map(([field, label]) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>{notes[field]?.trim() || '—'}</dd>
            </div>
          ))}
        </dl>
        <p className="report-note">
          الالتزام = الفترات التي سُجل فيها الواجب ÷ الفترات المنقضية من الفصل (الأيام الدراسية من الأحد إلى الخميس). يُحتسب الواجب من زر «تم» أو من سجلات الأقسام أو من مهمة مرتبطة به.
        </p>
        <footer>نبض الإنجاز · تقرير مبني على البيانات المحفوظة في هذا المتصفح</footer>
      </div>
    </section>
  );
}
