import { useEffect, useState } from 'react';
import {
  Activity,
  ClipboardCheck,
  CalendarDays,
  Users,
  GraduationCap,
  Medal,
  FileText,
} from 'lucide-react';
import TaskManager, { readTasks, STORAGE_KEY, type Task } from './TaskManager';
import { toggleTaskCompletion } from './task-model';
import ExecutiveDashboard from './ExecutiveDashboard';
import DailySectionBoard from './DailySectionBoard';
import UnifiedAgenda from './UnifiedAgenda';
import AchievementRegister from './AchievementRegister';
import Reports from './Reports';
import PlanOverview from './PlanOverview';
import PlanLibrary from './PlanLibrary';
import ScheduleManager from './ScheduleManager';
import TechnicalFollowup from './TechnicalFollowup';
import AssessmentTracking from './AssessmentTracking';
import ProfessionalDevelopment from './ProfessionalDevelopment';
import AppBackupTools from './AppBackupTools';
import PlanSectionActivities from './PlanSectionActivities';
import SupervisoryVisits from './SupervisoryVisits';
import { emptySupervisoryVisitForm, hasUnsavedVisitChanges, type SupervisoryVisit, type SupervisoryVisitForm } from './supervisory-visits-model';
import { PLAN_DESTINATIONS, type PlanDestination } from './plan-routing';
import { PLAN_STORAGE_KEY, readPlans, type Plan } from './plan-model';
const sections = [
  ['الرئيسية', Activity],
  ['الخطط والمهام', ClipboardCheck],
  ['مكتبة الخطط', ClipboardCheck],
  ['الجداول والاحتياط', CalendarDays],
  ['المتابعة الفنية', Users],
  ['الاختبارات والتحصيل', FileText],
  ['الإنماء المهني', GraduationCap],
  ['الزيارات الإشرافية', Users],
  ['الزيارات المتبادلة', Users],
  ['الاجتماعات الدورية', Users],
  ['رفع المستوى التحصيلي', GraduationCap],
  ['الإنجازات والشواهد', Medal],
  ['التقارير', FileText],
] as const;
export default function App() {
  const [tab, setTab] = useState<string>('الرئيسية');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(readTasks);
  const [plans, setPlans] = useState<Plan[]>(readPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [focusedActivityId, setFocusedActivityId] = useState<string | null>(null);
  const [visitLink, setVisitLink] = useState<{ planId: string; activityId: string } | null>(null);
  const [visitForm, setVisitForm] = useState<SupervisoryVisitForm>(emptySupervisoryVisitForm);
  const [visitEditing, setVisitEditing] = useState<SupervisoryVisit | null>(null);
  const visitDraftChanged = hasUnsavedVisitChanges(visitForm, visitEditing);
  const [planCreateRequested, setPlanCreateRequested] = useState(false);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);
  useEffect(() => {
    if (!visitDraftChanged) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [visitDraftChanged]);
  useEffect(() => {
    const syncPlans = (event: StorageEvent) => {
      if (event.key !== PLAN_STORAGE_KEY) return;
      if (event.newValue === null) { setPlans([]); return; }
      try {
        if (Array.isArray(JSON.parse(event.newValue))) setPlans(readPlans());
      } catch { /* Keep the current view if another tab writes invalid data. */ }
    };
    window.addEventListener('storage', syncPlans);
    return () => window.removeEventListener('storage', syncPlans);
  }, []);
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="layout">
      <aside>
        <h2>
          <Activity /> نبض الإنجاز
        </h2>
        <p>منظومة المعلم الأول</p>
        <nav className="desktop-navigation" aria-label="الأقسام الرئيسية">
          {sections.map(([s, Icon]) => (
            <button
              className={tab === s ? 'active' : ''}
              aria-current={tab === s ? 'page' : undefined}
              key={s}
              onClick={() => setTab(s)}
            >
              <Icon size={18} />
              {s}
            </button>
          ))}
        </nav>
        <div className="mobile-navigation">
          <button
            className="mobile-menu-trigger"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-sections"
            onClick={() => setMobileMenuOpen((v) => !v)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMobileMenuOpen(false);
            }}
          >
            <span className="mobile-current-section">{tab}</span>
            <span className="mobile-menu-label">
              {mobileMenuOpen ? 'إغلاق الأقسام' : 'عرض الأقسام'}{' '}
              <span aria-hidden="true">{mobileMenuOpen ? '⌃' : '⌄'}</span>
            </span>
          </button>
          {mobileMenuOpen && (
            <nav id="mobile-sections" className="mobile-section-list" aria-label="أقسام الهاتف">
              {sections.map(([s, Icon]) => (
                <button
                  key={s}
                  type="button"
                  className={tab === s ? 'active' : ''}
                  aria-current={tab === s ? 'page' : undefined}
                  onClick={() => {
                    setTab(s);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon size={18} />
                  {s}
                </button>
              ))}
            </nav>
          )}
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>مركز القيادة التربوية</small>
            <h1>{tab}</h1>
            <p>متابعة دقيقة، وإنجاز موثّق</p>
          </div>
          <span className="tag">نسخة محلية تجريبية</span>
        </header>
        {tab === 'الرئيسية' ? (
          <>
            <UnifiedAgenda tasks={tasks} plans={plans} navigate={(section, planId, activityId) => {
              if (planId) { setSelectedPlanId(planId); setFocusedActivityId(activityId ?? null); setPlanCreateRequested(false); }
              setTab(section); setMobileMenuOpen(false);
            }} />
            <DailySectionBoard
              tasks={tasks}
              plans={plans}
              onNavigate={(section) => {
                setTab(section);
                setMobileMenuOpen(false);
              }}
            />
            <PlanOverview
              plans={plans}
              onOpen={(id) => {
                setSelectedPlanId(id);
                setPlanCreateRequested(false);
                setTab('مكتبة الخطط');
              }}
              onAdd={() => {
                setSelectedPlanId(null);
                setPlanCreateRequested(true);
                setTab('مكتبة الخطط');
              }}
            />
            <details className="home-extra"><summary>مؤشرات المهام وتفاصيلها</summary><ExecutiveDashboard
              tasks={tasks}
              completedCount={done}
              plans={plans}
              onOpenPlan={(id) => {
                setSelectedPlanId(id);
                setPlanCreateRequested(false);
                setTab('مكتبة الخطط');
              }}
              onNavigate={() => {
                setTab('الخطط والمهام');
                setMobileMenuOpen(false);
              }}
              onToggleTask={(id) =>
                setTasks((old) => old.map((x) => (x.id === id ? toggleTaskCompletion(x) : x)))
              }
            /></details>
            <AppBackupTools plans={plans} setPlans={setPlans} setTasks={setTasks} />
          </>
        ) : tab === 'التقارير' ? (
          <Reports tasks={tasks} plans={plans} />
        ) : tab === 'الإنجازات والشواهد' ? (
          <AchievementRegister tasks={tasks} plans={plans} navigate={(section, planId, activityId) => {
            if (planId) { setSelectedPlanId(planId); setFocusedActivityId(activityId ?? null); setPlanCreateRequested(false); }
            setTab(section); setMobileMenuOpen(false);
          }} />
        ) : tab === 'مكتبة الخطط' ? (
          <PlanLibrary
            plans={plans}
            setPlans={setPlans}
            selectedId={selectedPlanId}
            onSelect={setSelectedPlanId}
            createRequested={planCreateRequested}
            onCreateHandled={() => setPlanCreateRequested(false)}
            focusedActivityId={focusedActivityId}
            onFocusHandled={() => setFocusedActivityId(null)}
          />
        ) : tab === 'الخطط والمهام' ? (
          <TaskManager tasks={tasks} setTasks={setTasks} />
        ) : tab === 'الجداول والاحتياط' ? (
          <ScheduleManager />
        ) : tab === 'المتابعة الفنية' ? (
          <TechnicalFollowup />
        ) : tab === 'الاختبارات والتحصيل' ? (
          <AssessmentTracking />
        ) : tab === 'الإنماء المهني' ? (
          <>
            <PlanSectionActivities plans={plans} destination="الإنماء المهني" onOpenPlan={(id, activityId) => {
              setSelectedPlanId(id);
              setFocusedActivityId(activityId);
              setPlanCreateRequested(false);
              setTab('مكتبة الخطط');
            }} />
            <ProfessionalDevelopment />
          </>
        ) : tab === 'الزيارات الإشرافية' ? (
          <>
            <PlanSectionActivities plans={plans} destination="الزيارات الإشرافية" onOpenPlan={(id, activityId) => {
              setSelectedPlanId(id);
              setFocusedActivityId(activityId);
              setPlanCreateRequested(false);
              setTab('مكتبة الخطط');
            }} onLinkVisit={(planId, activityId) => setVisitLink({ planId, activityId })} />
            <SupervisoryVisits plans={plans} requestedLink={visitLink} form={visitForm} setForm={setVisitForm} editing={visitEditing} setEditing={setVisitEditing} onLinkHandled={() => setVisitLink(null)} onOpenPlan={(id, activityId) => {
              setSelectedPlanId(id);
              setFocusedActivityId(activityId);
              setPlanCreateRequested(false);
              setTab('مكتبة الخطط');
            }} />
          </>
        ) : PLAN_DESTINATIONS.includes(tab as PlanDestination) ? (
          <PlanSectionActivities plans={plans} destination={tab as PlanDestination} onOpenPlan={(id, activityId) => {
            setSelectedPlanId(id);
            setFocusedActivityId(activityId);
            setPlanCreateRequested(false);
            setTab('مكتبة الخطط');
          }} />
        ) : (
          <section className="card">
            <h2>{tab}</h2>
            <p>هذا القسم معتمد ضمن نطاق المشروع، ولم تُنفذ وظائفه بعد.</p>
          </section>
        )}
        <footer>نبض الإنجاز © مستقل عن مسار</footer>
      </main>
    </div>
  );
}
