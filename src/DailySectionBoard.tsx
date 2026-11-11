import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Medal,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Task } from './task-model';
import { tasksDueToday, localDateKey, isTaskOverdue } from './dashboard-metrics';
import { validDate, type Plan } from './plan-model';
import { readSchedule } from './schedule-model';
import { getCoverDailySummary, getCoverDay, readCoverStore, weekdayForDate } from './cover-planning';
import { readTechnicalTopicSummary, readTechnicalTopics } from './technical-followup-model';
import './daily-section-board.css';

const today = () => localDateKey(new Date());

function completedToday(plan: Plan[], date: string): number {
  return plan.reduce(
    (count, item) =>
      count +
      item.activities.filter((activity) => {
        if (activity.progress !== 'completed' || !activity.completedAt) return false;
        const completedAt = new Date(activity.completedAt);
        return !Number.isNaN(completedAt.getTime()) && localDateKey(completedAt) === date;
      }).length,
    0,
  );
}

type Props = {
  tasks: Task[];
  plans: Plan[];
  onNavigate: (section: string) => void;
};

type DailyCard = {
  name: string;
  icon: LucideIcon;
  status: string;
  detail: string;
  alert?: boolean;
  pending?: boolean;
  onNavigateTo?: string;
};

export default function DailySectionBoard({ tasks, plans, onNavigate }: Props) {
  const date = today();
  const dueTasks = tasksDueToday(tasks, date);
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, date)).length;
  const activePlans = plans.filter((plan) => !plan.archived);
  const dueActivities = activePlans.flatMap((plan) =>
    plan.activities.filter(
      (activity) => activity.progress !== 'completed' && activity.dueDate === date,
    ),
  ).length;
  const overdueActivities = activePlans.flatMap((plan) =>
    plan.activities.filter(
      (activity) =>
        activity.progress !== 'completed' && validDate(activity.dueDate) && activity.dueDate < date,
    ),
  ).length;

  const schedule = readSchedule();
  const day = weekdayForDate(date);
  const lessonsToday = day ? schedule.lessons.filter((lesson) => lesson.day === day).length : 0;
  const coverStore = readCoverStore();
  const dayCover = getCoverDay(coverStore, date);
  const coverSummary = day ? getCoverDailySummary(schedule, coverStore, date) : null;
  const completedTodayCount = completedToday(plans, date);
  const technical = readTechnicalTopicSummary(date);
  const technicalCount = readTechnicalTopics().length;

  const cards: DailyCard[] = [
    {
      name: 'الخطط والمهام',
      icon: ClipboardCheck,
      status: dueTasks.length + overdueTasks > 0 ? 'متابعة مطلوبة' : 'لا يوجد استحقاق مسجل اليوم',
      detail: `${dueTasks.length} مستحق اليوم · ${overdueTasks} متأخر`,
      alert: dueTasks.length + overdueTasks > 0,
    },
    {
      name: 'مكتبة الخطط',
      icon: ClipboardList,
      status: `${activePlans.length} خطة نشطة`,
      detail: `${dueActivities} نشاط مستحق اليوم · ${overdueActivities} متأخر`,
      alert: dueActivities + overdueActivities > 0,
    },
    {
      name: 'الجداول والاحتياط',
      icon: CalendarDays,
      status: day ? `${lessonsToday} حصة مسجلة اليوم` : 'اليوم خارج أيام الدوام المسجلة',
      detail: dayCover.absent.length
        ? `${dayCover.absent.length} غياب مسجل · ${coverSummary?.assigned ?? 0} مغطاة · ${coverSummary?.uncovered ?? 0} دون بديل${coverSummary?.processedAt ? ' · محفوظة' : ' · مسودة'}`
        : schedule.teachers.length
          ? 'لم يُسجل غياب لهذا اليوم'
          : 'ارفع جدول المعلمين للبدء',
      alert: dayCover.absent.length > 0 || !schedule.teachers.length,
    },
    {
      name: 'المتابعة الفنية',
      icon: Users,
      status:
        technicalCount === 0
          ? 'لا توجد موضوعات مسجلة'
          : technical.overdue
            ? `${technical.overdue} موضوع متأخر`
            : `${technical.complete} موضوع مكتمل`,
      detail:
        technicalCount === 0
          ? 'أدخل موضوعات النشرة لمتابعتها'
          : `${technical.today} موعده اليوم · ${technical.upcoming} قادم`,
      alert: technical.overdue + technical.today > 0,
    },
    {
      name: 'الاختبارات والتحصيل',
      icon: FileText,
      status: 'القسم لم يُفعّل بعد',
      detail: 'لم تُسجل بيانات اختبارات أو تحصيل في المنظومة بعد',
      pending: true,
    },
    {
      name: 'الإنماء المهني',
      icon: GraduationCap,
      status: 'القسم لم يُفعّل بعد',
      detail: 'لم تُسجل أنشطة إنماء مهني في المنظومة بعد',
      pending: true,
    },
    {
      name: 'الإنجازات والشواهد',
      icon: Medal,
      status: `${completedTodayCount} نشاط مكتمل اليوم`,
      detail: 'إرفاق الشاهد متاح من داخل النشاط في مكتبة الخطط',
      onNavigateTo: 'مكتبة الخطط',
    },
    {
      name: 'التقارير',
      icon: FileText,
      status: 'القسم لم يُفعّل بعد',
      detail: 'ستظهر التقارير بعد تنفيذ وظائف القسم',
      pending: true,
    },
  ];

  return (
    <section className="daily-section-board" aria-label="ملخص الأقسام اليوم">
      <div className="daily-section-heading">
        <div>
          <span className="executive-eyebrow">
            {new Intl.DateTimeFormat('ar-OM', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </span>
          <h2>لوحة اليوم</h2>
          <p>نظرة سريعة على الأقسام وما يحتاج متابعة اليوم.</p>
        </div>
        <span className="daily-section-count">{cards.length} أقسام</span>
      </div>
      <div className="daily-section-grid">
        {cards.map((item) => {
          const Icon = item.icon;
          const target = item.onNavigateTo ?? item.name;
          return (
            <button
              className={`daily-section-card${item.alert ? ' is-attention' : ''}${item.pending ? ' is-pending' : ''}`}
              key={item.name}
              type="button"
              onClick={() => onNavigate(target)}
            >
              <span className="daily-section-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="daily-section-copy">
                <strong>{item.name}</strong>
                <span className="daily-section-status">{item.status}</span>
                <small>{item.detail}</small>
              </span>
              <ArrowLeft className="daily-section-arrow" size={17} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
