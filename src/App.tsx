import { useEffect, useState } from 'react';
import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  Users,
  GraduationCap,
  Medal,
  FileText,
} from 'lucide-react';
import TaskManager, { readTasks, STORAGE_KEY, type Task } from './TaskManager';
import { toggleTaskCompletion } from './task-model';
import ExecutiveDashboard from './ExecutiveDashboard';
import PlanOverview from './PlanOverview';
import PlanLibrary from './PlanLibrary';
import { PLAN_STORAGE_KEY, readPlans, type Plan } from './plan-model';
const sections = [
  ['الرئيسية', Activity],
  ['الخطط والمهام', ClipboardCheck],
  ['مكتبة الخطط', ClipboardList],
  ['الجداول والاحتياط', CalendarDays],
  ['المتابعة الفنية', Users],
  ['الاختبارات والتحصيل', FileText],
  ['الإنماء المهني', GraduationCap],
  ['الإنجازات والشواهد', Medal],
  ['التقارير', FileText],
] as const;
export default function App() {
  const [tab, setTab] = useState<string>('الرئيسية');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(readTasks);
  const [plans, setPlans] = useState<Plan[]>(readPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planCreateOpen, setPlanCreateOpen] = useState(false);
  const [planStorageError, setPlanStorageError] = useState(false);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
      setPlanStorageError(false);
    } catch {
      setPlanStorageError(true);
    }
  }, [plans]);
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
        {planStorageError && (
          <p role="alert" className="plan-notice">
            تعذر حفظ بيانات الخطط في هذا المتصفح. لا تغلق الصفحة قبل معالجة مساحة التخزين أو إعدادات
            المتصفح.
          </p>
        )}
        {tab === 'الرئيسية' ? (
          <>
            <PlanOverview
              plans={plans}
              onAdd={() => {
                setSelectedPlanId(null);
                setPlanCreateOpen(true);
                setTab('مكتبة الخطط');
                setMobileMenuOpen(false);
              }}
              onOpen={(id) => {
                setSelectedPlanId(id);
                setPlanCreateOpen(false);
                setTab('مكتبة الخطط');
                setMobileMenuOpen(false);
              }}
            />
            <ExecutiveDashboard
              tasks={tasks}
              completedCount={done}
              onNavigate={() => {
                setTab('الخطط والمهام');
                setMobileMenuOpen(false);
              }}
              onToggleTask={(id) =>
                setTasks((old) => old.map((x) => (x.id === id ? toggleTaskCompletion(x) : x)))
              }
            />
          </>
        ) : tab === 'مكتبة الخطط' ? (
          <PlanLibrary
            plans={plans}
            setPlans={setPlans}
            selectedId={selectedPlanId}
            setSelectedId={setSelectedPlanId}
            createOpen={planCreateOpen}
            setCreateOpen={setPlanCreateOpen}
          />
        ) : tab === 'الخطط والمهام' ? (
          <TaskManager tasks={tasks} setTasks={setTasks} />
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
