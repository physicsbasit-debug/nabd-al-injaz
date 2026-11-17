import { useEffect, useState } from 'react';
import type { Task } from './task-model';
import type { Plan } from './plan-model';
import { localDateKey } from './dashboard-metrics';
import { readSupervisoryVisits } from './supervisory-visits-model';
import { readTechnicalTopics } from './technical-followup-model';
import { readProfessionalPrograms } from './professional-development-model';
import { evidenceCounts } from './evidence-store';
import { listWorkEvidence } from './work-evidence';
import { listVisitFiles } from './supervisory-visit-files';
import { buildAgenda, type AgendaItem } from './unified-agenda';
import './unified-agenda.css';

type Props = { tasks: Task[]; plans: Plan[]; navigate: (section: string, planId?: string, activityId?: string) => void };
export default function UnifiedAgenda({ tasks, plans, navigate }: Props) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [workKeys, setWorkKeys] = useState<Set<string> | null>(null);
  const [visitKeys, setVisitKeys] = useState<Set<string> | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  useEffect(() => { evidenceCounts().then(setCounts).catch(() => setEvidenceError(true)); listWorkEvidence().then(files => setWorkKeys(new Set(files.map(f => f.ownerType + ':' + f.ownerId)))).catch(() => setEvidenceError(true)); listVisitFiles().then(files => setVisitKeys(new Set(files.map(f => 'visit:' + f.recordId)))).catch(() => setEvidenceError(true)); }, []);
  let visits: ReturnType<typeof readSupervisoryVisits> = [];
  let programs: ReturnType<typeof readProfessionalPrograms> = [];
  const errors: string[] = [];
  try { visits = readSupervisoryVisits(); } catch { errors.push('الزيارات الإشرافية'); }
  try { programs = readProfessionalPrograms(); } catch { errors.push('برامج الإنماء المهني'); }
  const today = localDateKey(new Date());
  if (visits.some(visit => visit.status === 'completed' && visit.date > today)) errors.push('زيارات منفذة بتاريخ مستقبلي؛ راجع تاريخها');
  const agenda = buildAgenda({ today, tasks, plans, visits, topics: readTechnicalTopics(), programs });
  const evidenceReady = counts !== null && workKeys !== null && visitKeys !== null;
  const withoutEvidence = evidenceReady ? agenda.completed.filter(item => item.activityId ? !counts[item.activityId] : item.id.startsWith('visit:') ? !visitKeys.has(item.id) : !workKeys.has(item.id)) : [];
  const sections: Array<{title: string; detail: string; items: AgendaItem[]}> = [
    {title: 'اليوم', detail: 'المستحق اليوم', items: agenda.today},
    {title: 'الأيام الستة القادمة', detail: 'حتى نهاية الأيام السبعة بدءًا من اليوم', items: agenda.week},
    {title: 'متأخر', detail: 'بنود مفتوحة تجاوزت موعدها', items: agenda.overdue},
    {title: 'دون موعد', detail: 'أعمال مفتوحة لم يحدد لها تاريخ صالح', items: agenda.undated},
    {title: 'المنجز', detail: 'الأعمال المسجلة مكتملة؛ قد لا يتوفر تاريخ إنجاز لبعضها', items: agenda.completed},
    {title: 'أعمال مكتملة دون شاهد مرفق', detail: 'المهام والأنشطة والزيارات والمتابعة الفنية', items: withoutEvidence},
  ];
  return <section className="card unified-agenda" aria-label="متابعة الأعمال الموحدة">
    <div className="unified-heading"><div><span className="executive-eyebrow">أعمالك ومتابعة المعلمين</span><h2>متابعة اليوم والأسبوع</h2><p>عرض من السجلات الموجودة؛ افتح البند لتحديثه في قسمه.</p></div></div>
    {errors.length > 0 && <p role="alert">تعذرت قراءة: {errors.join('، ')}. راجع القسم؛ لم تُغيّر البيانات.</p>}
    {evidenceError && <p role="alert">تعذّر قراءة الشواهد؛ لا يمكن تحديد الأعمال دون شاهد.</p>}
    <div className="unified-sections">{sections.map(({title, detail, items}, index) => <details key={title} open={index === 0 || (index === 2 && items.length > 0)} className="unified-group">
      <summary><strong>{title}</strong><span>{index === 5 && evidenceError ? 'تعذر التحقق' : index === 5 && !evidenceReady ? 'جارٍ التحقق' : items.length}</span></summary><p>{detail}</p>
      {items.length ? <ul>{items.map(item => <li key={item.id}><button type="button" onClick={() => navigate(item.section, item.planId, item.activityId)}><span><strong>{item.title}</strong><small>{item.detail}</small><small>{index === 4 ? (item.completionDate ? 'تاريخ الإنجاز المسجل: ' + item.completionDate.slice(0, 10) : 'تاريخ الإنجاز غير مسجل') : item.date ? 'الموعد: ' + item.date : 'دون موعد'}</small></span><span aria-hidden="true">←</span></button></li>)}</ul> : <p className="unified-empty">{index === 5 && !evidenceReady ? 'لم يكتمل التحقق من الشواهد.' : 'لا توجد بنود مسجلة هنا.'}</p>}
    </details>)}</div>
    <p className="unified-note">الزيارات المرتبطة بخطة تظهر كسجل زيارة ونشاط خطة مستقلين. البرامج المعروضة مواعيد وليست إثباتًا للتنفيذ. بقية ملخصات الأقسام أدناه.</p>
  </section>;
}
