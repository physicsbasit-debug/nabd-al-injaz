import { useState } from 'react';
import type { SupervisoryVisit } from './supervisory-visits-model';
import { analyzeVisits } from './visit-analysis';
import { dutyById } from './duties';
import { markRoutine, periodFor, readRoutineStore, semesterOf, unmarkRoutine, writeRoutineStore } from './duty-routine';

type Props = { visits: SupervisoryVisit[]; today: string };

/** تحليل نتائج الإشراف وفق مؤشرات الأداء (الواجب 15) واعتماده لشهره في روتين الواجبات. */
export default function VisitAnalysisPanel({ visits, today }: Props) {
  const [range, setRange] = useState<'month' | 'semester'>('month');
  const [store, setStore] = useState(readRoutineStore);
  const semester = semesterOf(today);
  const from = range === 'month' ? today.slice(0, 7) + '-01' : semester.start;
  const a = analyzeVisits(visits, from, today);
  const duty = dutyById(15)!;
  const month = periodFor('شهري', today)!;
  const item = { duty, periodKey: month.key };
  const approved = store.done[`15|${month.key}`];
  const top = a.sharedPriorities[0]?.indicator ?? a.priorities[0]?.[0];
  const approve = () => {
    const monthly = analyzeVisits(visits, today.slice(0, 7) + '-01', today);
    const focus = monthly.sharedPriorities[0]?.indicator ?? monthly.priorities[0]?.[0];
    const note = `${monthly.total} زيارات${focus ? ' · أبرز أولوية: ' + focus : ''}`;
    const next = markRoutine(store, item, note);
    setStore(next);
    writeRoutineStore(next);
  };
  const undo = () => {
    const next = unmarkRoutine(store, item);
    setStore(next);
    writeRoutineStore(next);
  };
  const bars = (rows: Array<[string, number]>, tone: string) => {
    const max = Math.max(1, ...rows.map(([, n]) => n));
    return (
      <ul className="visit-bars">
        {rows.map(([label, n]) => (
          <li key={label}>
            <span>{label}</span>
            <span className={'visit-bar ' + tone} style={{ inlineSize: `${(n / max) * 100}%` }} aria-hidden="true" />
            <b>{n}</b>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <section className="visit-analysis" aria-label="تحليل نتائج الإشراف">
      <div className="visit-analysis-head">
        <h3>تحليل نتائج الإشراف</h3>
        <label>
          الفترة
          <select value={range} onChange={(e) => setRange(e.target.value as 'month' | 'semester')}>
            <option value="month">هذا الشهر</option>
            <option value="semester">{semester.label}</option>
          </select>
        </label>
      </div>
      <p className="visit-analysis-lead">
        {a.total} زيارات منفذة، منها {a.tagged} موسومة بمؤشرات الأداء. التوسيم يحدد جوانب القوة وأولويات التطوير دون درجات.
      </p>
      {a.total === 0 ? (
        <p>لا توجد زيارات منفذة في هذه الفترة.</p>
      ) : (
        <div className="visit-analysis-grid">
          <div>
            <strong>أساليب الإشراف المستخدمة</strong>
            {bars(a.byMethod, 'method')}
          </div>
          <div>
            <strong>أكثر المؤشرات قوة</strong>
            {a.strengths.length ? bars(a.strengths, 'strength') : <p>لم توسم جوانب قوة بعد.</p>}
          </div>
          <div>
            <strong>أكثر أولويات التطوير</strong>
            {a.priorities.length ? bars(a.priorities, 'priority') : <p>لم توسم أولويات بعد.</p>}
          </div>
        </div>
      )}
      {a.sharedPriorities.length > 0 && (
        <p className="visit-analysis-suggest">
          مرشح لبرنامج إنماء جماعي: <b>{a.sharedPriorities[0].indicator}</b> (أولوية لدى {a.sharedPriorities[0].teachers.join('، ')}).
        </p>
      )}
      {!a.sharedPriorities.length && top && <p className="visit-analysis-suggest">أبرز أولوية في الفترة: <b>{top}</b>.</p>}
      <div className="visit-actions">
        {approved ? (
          <>
            <span className="visit-done">اعتُمد تحليل هذا الشهر{approved.note ? ' · ' + approved.note : ''}</span>
            <button type="button" onClick={undo}>إلغاء الاعتماد</button>
          </>
        ) : (
          <button type="button" onClick={approve}>اعتماد تحليل هذا الشهر (الواجب 15)</button>
        )}
      </div>
    </section>
  );
}
