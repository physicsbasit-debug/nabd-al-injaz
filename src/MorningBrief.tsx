import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Paperclip, Sunrise } from 'lucide-react';
import type { Task } from './task-model';
import type { Plan } from './plan-model';
import { useAgendaData } from './UnifiedAgenda';
import type { AgendaItem } from './unified-agenda';
import { dutyById, SECTION_DUTY, TASK_CATEGORY_DUTY, type Duty } from './duties';
import { AUTO_CLOSING_DUTIES } from './duty-records';
import { buildRoutine, markRoutine, readRoutineStore, unmarkRoutine, writeRoutineStore, type RoutineItem } from './duty-routine';
import './morning-brief.css';

type Props = { tasks: Task[]; plans: Plan[]; navigate: (section: string, planId?: string, activityId?: string) => void };
type View = 'today' | 'overdue' | 'done' | 'evidence' | 'routine';
type BriefItem = { id: string; title: string; meta: string; section?: string; planId?: string; activityId?: string; duty?: Duty; routine?: RoutineItem; tone?: 'late' | 'urgent' };

const formatDay = (today: string) =>
  new Intl.DateTimeFormat('ar-OM', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(today + 'T00:00:00Z'));
const greeting = () => (new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير');

function dutyForAgenda(item: AgendaItem, tasks: Task[]): Duty | undefined {
  if (item.id.startsWith('task:')) {
    const task = tasks.find((t) => 'task:' + t.id === item.id);
    return task ? dutyById(TASK_CATEGORY_DUTY[task.category] ?? 44) : undefined;
  }
  const id = SECTION_DUTY[item.section];
  return id ? dutyById(id) : undefined;
}

function routineMeta(item: RoutineItem): string {
  if (!item.done && item.auto.length) {
    const more = item.auto.length > 1 ? ` و${item.auto.length - 1} غيره` : '';
    return `واجب ${item.frequency} · أُنجز من السجلات: ${item.auto[0].title}${more}`;
  }
  if (item.done) return `واجب ${item.frequency} · أُنجز ${item.periodLabel}${item.done.note ? ' · ' + item.done.note : ''}`;
  if (item.frequency === 'يومي') return 'واجب يومي';
  if (item.daysLeft <= 0) return `واجب ${item.frequency} · آخر يوم في فترته`;
  return `واجب ${item.frequency} · متبقٍ ${item.daysLeft} ${item.daysLeft <= 10 ? 'أيام' : 'يومًا'} على نهاية ${item.periodLabel}`;
}

export default function MorningBrief({ tasks, plans, navigate }: Props) {
  const { today, agenda, errors, evidenceError, evidenceReady, withoutEvidence, dutyRecords } = useAgendaData(tasks, plans);
  const [store, setStore] = useState(readRoutineStore);
  const [view, setView] = useState<View>('today');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const routine = buildRoutine(today, store, dutyRecords);
  const save = (next: typeof store) => { setStore(next); writeRoutineStore(next); };

  const fromAgenda = (item: AgendaItem, tone?: BriefItem['tone']): BriefItem => ({
    id: item.id, title: item.title, section: item.section, planId: item.planId, activityId: item.activityId, duty: dutyForAgenda(item, tasks), tone,
    meta: item.detail + (item.date ? ' · الموعد: ' + item.date : ''),
  });
  const fromRoutine = (item: RoutineItem): BriefItem => ({
    id: 'routine:' + item.duty.id, title: item.duty.short, meta: routineMeta(item), section: item.duty.section, duty: item.duty, routine: item,
    tone: item.urgent ? 'urgent' : undefined,
  });

  const openRoutine = routine.filter((r) => !r.complete);
  const todayItems = [...agenda.today.map((i) => fromAgenda(i)), ...openRoutine.filter((r) => r.frequency === 'يومي').map(fromRoutine)];
  const weekItems = openRoutine.filter((r) => r.frequency === 'أسبوعي').map(fromRoutine);
  const soonItems = openRoutine.filter((r) => r.urgent && r.frequency !== 'أسبوعي').sort((a, b) => a.daysLeft - b.daysLeft).map(fromRoutine);
  const overdueItems = agenda.overdue.map((i) => fromAgenda(i, 'late'));
  const doneToday = agenda.completed.filter((i) => i.completionDate?.slice(0, 10) === today);
  const routineDone = routine.filter((r) => r.complete);
  const doneItems = [...doneToday.map((i) => fromAgenda(i)), ...routineDone.map(fromRoutine)];
  const evidenceItems = withoutEvidence.map((i) => ({ ...fromAgenda(i), meta: i.detail + ' · أرفق الشاهد من قسمه' }));
  const pulse = routine.length ? Math.round((routineDone.length / routine.length) * 100) : 0;

  const priorities: BriefItem[] = [
    ...overdueItems,
    ...agenda.today.map((i) => fromAgenda(i)),
    ...openRoutine.filter((r) => r.urgent).map(fromRoutine),
    ...openRoutine.filter((r) => r.frequency === 'يومي').map(fromRoutine),
  ].slice(0, 3);

  const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
  const tips: string[] = [];
  if (evidenceReady && withoutEvidence.length) tips.push(`وثّق أولًا بأول: ${withoutEvidence.length} من الأعمال المكتملة بلا شاهد. خمس دقائق الآن توفر ساعات قبل التقرير الفصلي.`);
  if (weekday === 0) tips.push('بداية الأسبوع الدراسي: ثبّت مواعيد زيارات هذا الأسبوع ومتابعة التحضير قبل أن تزدحم الأيام.');
  if (weekday === 4) tips.push('الخميس نهاية الأسبوع الدراسي: أغلق واجبات الأسبوع المفتوحة أو انقلها بموعد جديد.');
  if (overdueItems.length >= 3) tips.push('المتأخرات تتراكم: أنجز ما يمكن اليوم، وحدّث موعد الباقي بدل تركه متأخرًا.');
  const monthlyLeft = openRoutine.filter((r) => r.frequency === 'شهري' && r.urgent).length;
  if (monthlyLeft) tips.push(`اقترب نهاية الشهر: ${monthlyLeft} من الواجبات الشهرية لم تُنجز بعد.`);
  const unlinked = tasks.filter((t) => !t.done && !t.dutyId).length;
  if (unlinked >= 3) tips.push(`اربط مهامك المفتوحة (${unlinked}) بأرقام الواجبات من «الخطط والمهام»؛ عند إكمالها تُحتسب في روتينك تلقائيًا.`);
  if (!tips.length) tips.push('اجمع الأعمال المتشابهة في وقت واحد: مثل فحص التحضير لجميع المعلمين في جلسة واحدة.');

  const views: Array<{ id: View; label: string; count: number | string; icon: typeof Sunrise; items: BriefItem[]; empty: string }> = [
    { id: 'today', label: 'لازم اليوم', count: todayItems.length, icon: ClipboardList, items: todayItems, empty: 'لا يوجد ما يستحق اليوم. استثمر الوقت في واجبات الشهر.' },
    { id: 'overdue', label: 'متأخرة', count: overdueItems.length, icon: AlertTriangle, items: overdueItems, empty: 'لا توجد أعمال متأخرة.' },
    { id: 'done', label: 'منجزة', count: doneItems.length, icon: CheckCircle2, items: doneItems, empty: 'لم يُسجل إنجاز اليوم بعد.' },
    { id: 'evidence', label: 'تحتاج توثيقًا', count: evidenceError ? '؟' : evidenceReady ? evidenceItems.length : '…', icon: Paperclip, items: evidenceItems, empty: evidenceError ? 'تعذّر التحقق من الشواهد.' : 'كل الأعمال المكتملة موثقة.' },
  ];
  const active = views.find((v) => v.id === view);
  const routineGroups = (['يومي', 'أسبوعي', 'شهري', 'فصلي'] as const).map((f) => ({ f, items: routine.filter((r) => r.frequency === f) })).filter((g) => g.items.length);

  const renderItem = (item: BriefItem) => (
    <li key={item.id} className={'brief-item' + (item.tone ? ' brief-' + item.tone : '') + (item.routine?.complete ? ' brief-checked' : '')}>
      <div className="brief-item-head">
        <span className="brief-item-text"><strong>{item.title}</strong><small>{item.meta}</small></span>
        <span className="brief-actions">
          {item.routine && !item.routine.done && item.routine.auto.length > 0 && <span className="brief-auto">من السجلات</span>}
          {item.routine && (item.routine.auto.length > 0 && !item.routine.done ? null : item.routine.done ? (
            <button type="button" className="brief-secondary" onClick={() => save(unmarkRoutine(store, item.routine!))}>تراجع</button>
          ) : (
            <button type="button" className="brief-primary" onClick={() => { save(markRoutine(store, item.routine!, notes[item.id] ?? '')); setNotes((n) => ({ ...n, [item.id]: '' })); }}>تم</button>
          ))}
          {item.section && <button type="button" className="brief-secondary" onClick={() => navigate(item.section!, item.planId, item.activityId)}>فتح القسم</button>}
        </span>
      </div>
      {item.duty && (
        <details className="brief-howto">
          <summary>طريقة الإنجاز · الواجب {item.duty.id}</summary>
          <ol>{item.duty.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p><b>الشاهد المطلوب:</b> {item.duty.evidence}</p>
          {item.routine && AUTO_CLOSING_DUTIES.has(item.duty.id) && item.duty.section && (
            <p className="brief-auto-hint">يُحتسب تلقائيًا عند تسجيله في قسم «{item.duty.section}»، فلا حاجة للضغط على «تم».</p>
          )}
          {item.routine && item.routine.auto.length > 1 && (
            <ul className="brief-auto-list">{item.routine.auto.map((r) => <li key={r.title + r.date}>{r.title} · {r.date}</li>)}</ul>
          )}
          {item.routine && !item.routine.complete && (
            <label className="brief-note">ملاحظة إنجاز اختيارية
              <input value={notes[item.id] ?? ''} maxLength={300} onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))} placeholder="مثال: زيارة المعلم أحمد – الصف التاسع" />
            </label>
          )}
        </details>
      )}
    </li>
  );

  return (
    <section className="card morning-brief" aria-label="موجز اليوم">
      <div className="brief-top">
        <div>
          <span className="brief-eyebrow"><Sunrise size={16} aria-hidden="true" /> {greeting()} · {formatDay(today)}</span>
          <h2>موجز اليوم</h2>
          <p className="brief-summary">
            عليك اليوم <b>{todayItems.length}</b> {todayItems.length === 1 ? 'عمل' : 'أعمال'}
            {weekItems.length > 0 && <>، و<b>{weekItems.length}</b> من واجبات الأسبوع</>}
            {overdueItems.length > 0 && <>، و<b>{overdueItems.length}</b> متأخرة</>}
            {evidenceReady && withoutEvidence.length > 0 && <>، و<b>{withoutEvidence.length}</b> تحتاج توثيقًا</>}.
          </p>
        </div>
        <div className="brief-ring" role="img" aria-label={`نبض الإنجاز للفترة الحالية ${pulse}٪`} style={{ ['--pulse' as string]: pulse * 3.6 + 'deg' }}>
          <span><b>{pulse}٪</b><small>نبض الفترة</small></span>
        </div>
      </div>
      {errors.length > 0 && <p role="alert">تعذرت قراءة: {errors.join('، ')}.</p>}

      <div className="brief-columns">
        <div className="brief-panel">
          <h3>ابدأ بهذه أولًا</h3>
          {priorities.length ? (
            <ol className="brief-priorities">{priorities.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => (p.section ? navigate(p.section, p.planId, p.activityId) : setView('today'))}>
                  <strong>{p.title}</strong><small>{p.tone === 'late' ? 'متأخر · ' : p.tone === 'urgent' ? 'تنتهي فترته قريبًا · ' : ''}{p.meta}</small>
                </button>
              </li>
            ))}</ol>
          ) : <p className="brief-empty">لا توجد أولويات عاجلة. يومك مرتب.</p>}
        </div>
        <div className="brief-panel brief-tips">
          <h3>أفكار توفر جهدك</h3>
          <ul>{tips.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>

      <div className="brief-tabs" role="group" aria-label="تصفية موجز اليوم">
        {views.map(({ id, label, count, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={view === id} className={'brief-tab brief-tab-' + id} onClick={() => setView(id)}>
            <Icon size={18} aria-hidden="true" /><span>{label}</span><b>{count}</b>
          </button>
        ))}
        <button type="button" aria-pressed={view === 'routine'} className="brief-tab brief-tab-routine" onClick={() => setView('routine')}>
          <CheckCircle2 size={18} aria-hidden="true" /><span>روتين الواجبات</span><b>{routineDone.length}/{routine.length}</b>
        </button>
      </div>

      {view === 'today' ? (
        <div className="brief-routine">
          {todayItems.length ? <ul className="brief-list brief-today-list">{todayItems.map(renderItem)}</ul> : <p className="brief-empty">{views[0].empty}</p>}
          {weekItems.length > 0 && (
            <details open={new Date(today + 'T00:00:00Z').getUTCDay() >= 3 && new Date(today + 'T00:00:00Z').getUTCDay() <= 4}>
              <summary><strong>واجبات هذا الأسبوع · حتى الخميس</strong><span>{weekItems.length}</span></summary>
              <ul className="brief-list">{weekItems.map(renderItem)}</ul>
            </details>
          )}
          {soonItems.length > 0 && (
            <details>
              <summary><strong>تنتهي فترتها قريبًا · واجبات شهرية وفصلية</strong><span>{soonItems.length}</span></summary>
              <ul className="brief-list">{soonItems.map(renderItem)}</ul>
            </details>
          )}
        </div>
      ) : active ? (
        active.items.length ? <ul className="brief-list">{active.items.map(renderItem)}</ul> : <p className="brief-empty">{active.empty}</p>
      ) : (
        <div className="brief-routine">
          {routineGroups.map(({ f, items }) => (
            <details key={f} open={f === 'يومي' || f === 'أسبوعي'}>
              <summary><strong>{items[0].periodLabel} · واجبات {f === 'يومي' ? 'يومية' : f === 'أسبوعي' ? 'أسبوعية' : f === 'شهري' ? 'شهرية' : 'فصلية'}</strong><span>{items.filter((i) => i.complete).length}/{items.length}</span></summary>
              <ul className="brief-list">{items.map((i) => renderItem(fromRoutine(i)))}</ul>
            </details>
          ))}
          <p className="brief-footnote">التكرار مقترح من بطاقة الوصف الوظيفي ويمكن تعديله من «دليل الواجبات».</p>
        </div>
      )}
    </section>
  );
}
