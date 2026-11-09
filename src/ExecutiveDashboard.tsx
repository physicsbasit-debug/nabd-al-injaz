import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListTodo,
} from 'lucide-react';
import type { Task } from './task-model';
import { formatDueDate } from './task-model';
import { dashboardMetrics, isTaskOverdue, localDateKey, priorityTasks } from './dashboard-metrics';

type Props = {
  tasks: Task[];
  completedCount: number;
  onNavigate: () => void;
  onToggleTask: (id: string) => void;
};

export default function ExecutiveDashboard({
  tasks,
  completedCount,
  onNavigate,
  onToggleTask,
}: Props) {
  const today = localDateKey(new Date());
  const metrics = dashboardMetrics(tasks, today);
  const attention = priorityTasks(tasks, today);

  return (
    <div className="executive-dashboard">
      <section className="executive-intro" aria-label="ملخص المتابعة">
        <div>
          <span className="executive-eyebrow">نظرة تنفيذية</span>
          <h2>أولويات العمل والمتابعة</h2>
          <p>مؤشرات محسوبة من مهامك المحفوظة فعليًا، دون بيانات افتراضية.</p>
        </div>
        <button className="executive-open-tasks" type="button" onClick={onNavigate}>
          إدارة المهام <ArrowLeft size={17} aria-hidden="true" />
        </button>
      </section>

      <section className="executive-stats" aria-label="مؤشرات المهام">
        <article>
          <div className="executive-stat-top">
            <span>إجمالي المهام</span>
            <ListTodo size={21} aria-hidden="true" />
          </div>
          <strong>{metrics.total}</strong>
          <small>المسجلة في المنظومة</small>
        </article>
        <article>
          <div className="executive-stat-top">
            <span>المكتملة</span>
            <CheckCircle2 size={21} aria-hidden="true" />
          </div>
          <strong>{completedCount}</strong>
          <small>من إجمالي المهام</small>
        </article>
        <article>
          <div className="executive-stat-top">
            <span>قيد التنفيذ</span>
            <Clock3 size={21} aria-hidden="true" />
          </div>
          <strong>{metrics.inProgress}</strong>
          <small>مهام لم تكتمل بعد</small>
        </article>
        <article className={metrics.overdue > 0 ? 'executive-stat-warning' : ''}>
          <div className="executive-stat-top">
            <span>المتأخرة</span>
            <AlertTriangle size={21} aria-hidden="true" />
          </div>
          <strong>{metrics.overdue}</strong>
          <small>تجاوزت تاريخ الاستحقاق</small>
        </article>
      </section>

      <div className="executive-columns">
        <section className="card executive-attention">
          <div className="executive-section-heading">
            <div>
              <span className="executive-eyebrow">للمتابعة الآن</span>
              <h2>المهام ذات الأولوية</h2>
              <p>المتأخرة أولًا، ثم العاجلة، ثم الأقرب استحقاقًا.</p>
            </div>
            <button type="button" className="executive-text-link" onClick={onNavigate}>
              عرض جميع المهام <ArrowLeft size={16} aria-hidden="true" />
            </button>
          </div>
          {attention.length === 0 ? (
            <div className="executive-empty">
              <CheckCircle2 size={30} aria-hidden="true" />
              <strong>{tasks.length ? 'لا توجد مهام مفتوحة حاليًا' : 'لا توجد مهام مسجلة بعد'}</strong>
              <p>{tasks.length ? 'جميع المهام المسجلة مكتملة.' : 'ابدأ بإضافة مهمة من قسم الخطط والمهام.'}</p>
              <button type="button" className="executive-text-link" onClick={onNavigate}>
                الانتقال إلى الخطط والمهام <ArrowLeft size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <ul className="executive-task-list">
              {attention.map((task) => (
                <li
                  key={task.id}
                  className={isTaskOverdue(task, today) ? 'executive-task-overdue' : ''}
                >
                  <button
                    className="executive-task-check"
                    type="button"
                    aria-label={'إكمال المهمة: ' + task.title}
                    onClick={() => onToggleTask(task.id)}
                  >
                    <span aria-hidden="true">○</span>
                  </button>
                  <div className="executive-task-content">
                    <strong>{task.title}</strong>
                    <div className="executive-task-details">
                      <span>{task.category}</span>
                      {task.assignedTo && <span>المسؤول: {task.assignedTo}</span>}
                      {task.dueDate && <span>الاستحقاق: {formatDueDate(task.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="executive-task-badges">
                    {isTaskOverdue(task, today) && (
                      <span className="executive-chip overdue">متأخرة</span>
                    )}
                    {task.priority === 'عاجلة' && (
                      <span className="executive-chip urgent">عاجلة</span>
                    )}
                    {task.progress === 'قيد التنفيذ' && (
                      <span className="executive-chip working">قيد التنفيذ</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card center executive-progress">
          <span className="executive-eyebrow">مؤشر الإنجاز</span>
          <h2>نسبة إنجاز المهام</h2>
          <div
            className="ring"
            role="img"
            aria-label={'نسبة الإنجاز ' + metrics.percent + '%'}
            style={{
              background:
                'conic-gradient(#0d9488 ' + metrics.percent + '%, #e8efec 0)',
            }}
          >
            <div>{metrics.percent}%</div>
          </div>
          <p>{metrics.completed} من {metrics.total} مكتملة</p>
          <div className="executive-progress-note">
            {metrics.urgentOpen > 0
              ? 'لديك ' + metrics.urgentOpen + ' مهام عاجلة لم تكتمل بعد.'
              : 'لا توجد مهام عاجلة مفتوحة حاليًا.'}
          </div>
        </section>
      </div>
      <p className="executive-data-note">
        البيانات محفوظة محليًا في هذا المتصفح فقط، ولا تتزامن بين الأجهزة.
      </p>
    </div>
  );
}
