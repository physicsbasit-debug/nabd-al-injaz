import { useEffect, useState } from 'react';
import { evidenceCounts } from './evidence-store';
import { ArrowLeft, ClipboardList, Plus, AlertTriangle } from 'lucide-react';
import { localDateKey } from './dashboard-metrics';
import { planStats, type Plan } from './plan-model';
type Props = { plans: Plan[]; onOpen: (id: string) => void; onAdd: () => void };
export default function PlanOverview({ plans, onOpen, onAdd }: Props) {
  const active = plans.filter((p) => !p.archived);
  const today = localDateKey(new Date());
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  useEffect(() => {
    let active = true;
    evidenceCounts()
      .then((data) => {
        if (active) {
          setCounts(data);
          setEvidenceError(false);
        }
      })
      .catch(() => {
        if (active) {
          setCounts(null);
          setEvidenceError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [plans]);
  return (
    <section className="plans-overview" aria-label="متابعة تنفيذ الخطط">
      <div className="plans-overview-heading">
        <div>
          <span className="executive-eyebrow">مؤشرات مستقلة لكل خطة</span>
          <h2>متابعة تنفيذ الخطط</h2>
          <p>نسبة كل خطة تُحسب من أنشطتها المسجلة، لا من عدد الملفات.</p>
        </div>
        <button type="button" className="primary-action" onClick={onAdd}>
          <Plus size={17} /> إضافة خطة
        </button>
      </div>
      {active.length === 0 ? (
        <div className="plans-empty">
          <ClipboardList size={30} />
          <strong>لا توجد خطط مضافة بعد</strong>
          <p>أضف خطة المادة أو الزيارات أو أي خطة أخرى لتظهر نسبة إنجازها هنا.</p>
          <button type="button" className="executive-text-link" onClick={onAdd}>
            إنشاء أول خطة <ArrowLeft size={16} />
          </button>
        </div>
      ) : (
        <div className="plan-indicator-grid">
          {active.map((plan) => {
            const m = planStats(plan, today);
            const documented =
              counts === null
                ? 0
                : plan.activities.filter(
                    (activity) =>
                      activity.progress === 'completed' && (counts[activity.id] ?? 0) > 0,
                  ).length;
            const undocumented = m.completed - documented;
            const documentationPercent =
              m.total === 0 ? null : Math.round((100 * documented) / m.total);
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
                  <ArrowLeft size={17} />
                </div>
                <strong className="plan-indicator-title">{plan.title}</strong>
                <div className="plan-indicator-result">
                  <span
                    className={m.percent === null ? 'plan-no-activities' : 'plan-indicator-percent'}
                  >
                    {m.percent === null ? 'لا توجد أنشطة معتمدة' : m.percent + '%'}
                  </span>
                  <span className="plan-indicator-count">
                    {m.completed} من {m.total} مكتملة
                  </span>
                </div>
                <div
                  className="plan-indicator-track"
                  role="img"
                  aria-label={
                    m.percent === null
                      ? 'لا توجد أنشطة معتمدة'
                      : 'إنجاز ' + plan.title + ': ' + m.percent + '%'
                  }
                >
                  <span style={{ width: (m.percent ?? 0) + '%' }} />
                </div>
                <div className="plan-documentation" aria-label={'توثيق خطة ' + plan.title}>
                  <div className="plan-documentation-row">
                    <span>التوثيق</span>
                    <strong>
                      {evidenceError
                        ? 'تعذّر التحقق'
                        : counts === null
                          ? 'جارٍ الفحص…'
                          : documentationPercent === null
                            ? '—'
                            : documentationPercent + '%'}
                    </strong>
                  </div>
                  <div
                    className="plan-documentation-track"
                    role="img"
                    aria-label={
                      'توثيق ' +
                      plan.title +
                      ': ' +
                      (counts === null ? 'جارٍ الفحص' : documented + ' من ' + m.total)
                    }
                  >
                    <span
                      style={{ width: counts === null ? '0%' : (documentationPercent ?? 0) + '%' }}
                    />
                  </div>
                  {!evidenceError && counts !== null && (
                    <small>
                      {documented} من {m.total} أنشطة مكتملة وموثقة
                    </small>
                  )}
                  {!evidenceError && counts !== null && undocumented > 0 && (
                    <small className="plan-documentation-warning">
                      <AlertTriangle size={13} /> {undocumented} مكتملة دون شواهد
                    </small>
                  )}
                </div>
                <div className="plan-indicator-bottom">
                  <span>{m.inProgress} قيد التنفيذ</span>
                  {m.overdue > 0 && (
                    <span className="plan-indicator-late">
                      <AlertTriangle size={13} /> {m.overdue} متأخرة
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
