import { useState } from 'react';
import { DUTIES, DUTY_FREQUENCIES, DUTY_GROUPS, type DutyFrequency } from './duties';
import { effectiveFrequency, readRoutineStore, semesterCompletions, semesterOf, setDutyFrequency, writeRoutineStore } from './duty-routine';
import { localDateKey } from './dashboard-metrics';
import './morning-brief.css';

type Props = { onNavigate: (section: string) => void };

export default function DutyGuide({ onNavigate }: Props) {
  const [store, setStore] = useState(readRoutineStore);
  const [query, setQuery] = useState('');
  const today = localDateKey(new Date());
  const counts = semesterCompletions(store, today);
  const q = query.trim();
  const visible = DUTIES.filter((d) => !q || d.text.includes(q) || d.short.includes(q) || String(d.id) === q);
  const routineCount = DUTIES.filter((d) => ['يومي', 'أسبوعي', 'شهري', 'فصلي'].includes(effectiveFrequency(d, store))).length;
  const touched = DUTIES.filter((d) => counts[d.id]).length;
  const change = (id: number, f: DutyFrequency) => {
    const duty = DUTIES.find((d) => d.id === id)!;
    const next = setDutyFrequency(store, duty, f);
    setStore(next);
    writeRoutineStore(next);
  };
  return (
    <section className="card duty-guide" aria-label="دليل الواجبات">
      <h2>واجبات المعلم الأول ومسؤولياته</h2>
      <p className="brief-summary">
        44 واجبًا من بطاقة الوصف الوظيفي (دليل مهام الوظائف المدرسية، 2015م). لكل واجب طريقة إنجاز مقترحة والشاهد المطلوب.
        الواجبات ذات التكرار اليومي والأسبوعي والشهري والفصلي تظهر تلقائيًا في موجز اليوم ({routineCount} واجبًا).
        في {semesterOf(today).label} سجّلت إنجازًا في <b>{touched}</b> من 44 واجبًا.
      </p>
      <label className="duty-search">بحث في الواجبات
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="مثال: الزيارات، الدرجات، 32" />
      </label>
      {DUTY_GROUPS.map((group) => {
        const items = visible.filter((d) => d.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="duty-group">
            <h3>{group}</h3>
            {items.map((duty) => {
              const frequency = effectiveFrequency(duty, store);
              return (
                <details key={duty.id} className="duty-card">
                  <summary>
                    <span className="duty-number">{duty.id}</span>
                    <strong>{duty.short}</strong>
                    <span className="duty-chip">{frequency}</span>
                    {counts[duty.id] ? <span className="duty-chip duty-chip-done">أُنجز {counts[duty.id]} مرة هذا الفصل</span> : null}
                  </summary>
                  <blockquote>{duty.text}</blockquote>
                  <p><b>طريقة الإنجاز:</b></p>
                  <ol>{duty.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  <p><b>الشاهد المطلوب:</b> {duty.evidence}</p>
                  <div className="duty-controls">
                    <label>التكرار في روتيني
                      <select value={frequency} onChange={(e) => change(duty.id, e.target.value as DutyFrequency)}>
                        {DUTY_FREQUENCIES.map((f) => <option key={f} value={f}>{f}{f === duty.frequency ? ' (مقترح)' : ''}</option>)}
                      </select>
                    </label>
                    {duty.section && duty.section !== 'دليل الواجبات' && <button type="button" className="brief-secondary" onClick={() => onNavigate(duty.section!)}>فتح قسم {duty.section}</button>}
                  </div>
                </details>
              );
            })}
          </div>
        );
      })}
      {!visible.length && <p className="brief-empty">لا يوجد واجب مطابق للبحث.</p>}
    </section>
  );
}
