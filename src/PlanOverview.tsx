import { ArrowLeft, ClipboardList, Plus, AlertTriangle } from 'lucide-react';
import type { Plan } from './plan-model';
import { planStats } from './plan-model';
import { localDateKey } from './dashboard-metrics';

type Props = {
  plans: Plan[];
  onOpen: (id: string) => void;
  onAdd: () => void;
};

export default function PlanOverview({ plans, onOpen, onAdd }: Props) {
  const active = plans.filter((plan) => !plan.archived);
  const today = localDateKey(new Date());

  return (
    <section className="plans-overview" aria-label="متابعة تنفيذ الخطط">
      <div className="plans-overview-heading">
        <div>
          <span className="executive-eyebrow">مؤشرات مستقلة لكل خطة</span>
          <h2>متابعة تنفيذ الخطط</h2>
          <p>نسبة كل خطة تُحسب من أنشطتها المعتمدة، لا من عدد الملفات المرفوعة.</p>
        </div>
        <button type="button" className="primary-action plans-add-button" onClick={onAdd}>
          <Plus size={17} aria-hidden="true" />
          إضافة خطة
        </button>
      </div>
      {active.length === 0 ? (
        <div className="plans-empty">
          <ClipboardList size={31} aria-hidden="true" />
          <strong>لا توجد خطط مضافة بعد</strong>
          <p>أنشئ خطة المادة أو الزيارات أو أي خطة أخرى لتظهر نسبة إنجازها هنا.</p>
          <button type="button" className="executive-text-link" onClick={onAdd}>
            إنشاء أول خطة <ArrowLeft size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="plan-indicator-grid">
          {active.map((plan) => {
            const stats = planStats(plan, today);
            return (
              <button
                key={plan.id}
                type="button"
                className="plan-indicator-card"
                onClick={() => onOpen(plan.id)}
                aria-label={'فتح خطة: ' + plan.title}
              >
                <div className="plan-indicator-top">
                  <span>{plan.kind}</span>
                  <ArrowLeft size={17} aria-hidden="true" />
                </div>
                <strong className="plan-indicator-title">{plan.title}</strong>
                <div className="plan-indicator-result">
                  {stats.percent === null ? (
                    <span className="plan-no-activities">لا توجد أنشطة معتمدة</span>
                  ) : (
                    <span className="plan-indicator-percent">{stats.percent}%</span>
                  )}
                  <span className="plan-indicator-count">
                    {stats.completed} من {stats.total} مكتملة
                  </span>
                </div>
                <div
                  className="plan-indicator-track"
                  role="img"
                  aria-label={
                    stats.percent === null
                      ? 'لا توجد أنشطة معتمدة'
                      : 'إنجاز ' + plan.title + ': ' + stats.percent + '%'
                  }
                >
                  <span style={{ width: (stats.percent ?? 0) + '%' }} />
                </div>
                <div className="plan-indicator-bottom">
                  <span>{stats.inProgress} قيد التنفيذ</span>
                  {stats.overdue > 0 && (
                    <span className="plan-indicator-late">
                      <AlertTriangle size={13} aria-hidden="true" /> {stats.overdue} متأخرة
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
