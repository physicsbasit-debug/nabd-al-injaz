import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  ArrowRight,
  Archive,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { Plan, PlanActivity, PlanKind, PlanProgress } from './plan-model';
import {
  PLAN_KINDS,
  changeActivityProgress,
  newActivity,
  newPlan,
  planStats,
  validPlanDate,
} from './plan-model';
import { localDateKey } from './dashboard-metrics';

type Props = {
  plans: Plan[];
  setPlans: Dispatch<SetStateAction<Plan[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  createOpen: boolean;
  setCreateOpen: (value: boolean) => void;
};

type PlanForm = Pick<Plan, 'title' | 'kind' | 'owner' | 'periodStart' | 'periodEnd'>;
type ActivityForm = Pick<PlanActivity, 'title' | 'details' | 'assignee' | 'dueDate'>;

const emptyPlan = (): PlanForm => ({
  title: '',
  kind: 'خطة المادة',
  owner: '',
  periodStart: '',
  periodEnd: '',
});
const emptyActivity = (): ActivityForm => ({ title: '', details: '', assignee: '', dueDate: '' });

export default function PlanLibrary({
  plans,
  setPlans,
  selectedId,
  setSelectedId,
  createOpen,
  setCreateOpen,
}: Props) {
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlan);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivity);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [detailsForm, setDetailsForm] = useState<PlanForm>(emptyPlan);
  const [notice, setNotice] = useState('');

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;
  const today = localDateKey(new Date());

  useEffect(() => {
    setActivityOpen(false);
    setEditingActivityId(null);
    setActivityForm(emptyActivity());
    setEditingPlan(false);
    setNotice('');
  }, [selectedId]);

  function updatePlan(id: string, transform: (plan: Plan) => Plan) {
    setPlans((old) => old.map((plan) => (plan.id === id ? transform(plan) : plan)));
  }

  function saveNewPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planForm.title.trim()) return;
    if (
      (planForm.periodStart && !validPlanDate(planForm.periodStart)) ||
      (planForm.periodEnd && !validPlanDate(planForm.periodEnd)) ||
      (planForm.periodStart && planForm.periodEnd && planForm.periodEnd < planForm.periodStart)
    ) {
      setNotice('تحقق من تاريخ بداية الخطة ونهايتها.');
      return;
    }
    const plan = newPlan(planForm);
    setPlans((old) => [...old, plan]);
    setSelectedId(plan.id);
    setPlanForm(emptyPlan());
    setCreateOpen(false);
  }

  function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !activityForm.title.trim()) return;
    if (activityForm.dueDate && !validPlanDate(activityForm.dueDate)) {
      setNotice('تاريخ استحقاق النشاط غير صالح.');
      return;
    }
    const id = editingActivityId;
    updatePlan(selected.id, (plan) => ({
      ...plan,
      activities: id
        ? plan.activities.map((activity) =>
            activity.id === id
              ? { ...activity, ...activityForm, title: activityForm.title.trim() }
              : activity,
          )
        : [...plan.activities, newActivity(activityForm)],
    }));
    setEditingActivityId(null);
    setActivityForm(emptyActivity());
    setActivityOpen(false);
    setNotice('');
  }

  function startEditActivity(activity: PlanActivity) {
    setEditingActivityId(activity.id);
    setActivityForm({
      title: activity.title,
      details: activity.details,
      assignee: activity.assignee,
      dueDate: activity.dueDate,
    });
    setActivityOpen(true);
  }

  function savePlanDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !detailsForm.title.trim()) return;
    if (
      (detailsForm.periodStart && !validPlanDate(detailsForm.periodStart)) ||
      (detailsForm.periodEnd && !validPlanDate(detailsForm.periodEnd)) ||
      (detailsForm.periodStart &&
        detailsForm.periodEnd &&
        detailsForm.periodEnd < detailsForm.periodStart)
    ) {
      setNotice('تحقق من فترة الخطة.');
      return;
    }
    updatePlan(selected.id, (plan) => ({
      ...plan,
      ...detailsForm,
      title: detailsForm.title.trim(),
    }));
    setEditingPlan(false);
    setNotice('');
  }

  function archivePlan() {
    if (!selected) return;
    updatePlan(selected.id, (plan) => ({ ...plan, archived: !plan.archived }));
  }

  const stats = selected ? planStats(selected, today) : null;
  const visiblePlans = plans.filter((plan) => showArchived || !plan.archived);

  return (
    <div className="plan-library">
      <section className="plan-library-intro">
        <div>
          <span className="executive-eyebrow">متابعة مستقلة لكل خطة</span>
          <h2>مكتبة الخطط التربوية</h2>
          <p>أنشئ الخطط والأنشطة يدويًا، وتابع تنفيذها في الصفحة الرئيسية.</p>
        </div>
        <button
          type="button"
          className="primary-action plans-add-button"
          onClick={() => {
            setSelectedId(null);
            setCreateOpen(!createOpen);
            setNotice('');
          }}
        >
          <Plus size={17} aria-hidden="true" />
          {createOpen ? 'إغلاق نموذج الخطة' : 'إنشاء خطة'}
        </button>
      </section>

      {createOpen && (
        <section className="card plan-form-card" aria-label="إنشاء خطة جديدة">
          <h3>إنشاء خطة جديدة</h3>
          <form className="plan-form-grid" onSubmit={saveNewPlan}>
            <label>
              نوع الخطة
              <select
                value={planForm.kind}
                onChange={(event) => {
                  const kind = event.target.value as PlanKind;
                  setPlanForm((old) => ({
                    ...old,
                    kind,
                    title:
                      old.title === old.kind || !old.title
                        ? kind === 'خطة أخرى'
                          ? ''
                          : kind
                        : old.title,
                  }));
                }}
              >
                {PLAN_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اسم الخطة
              <input
                required
                maxLength={150}
                value={planForm.title}
                onChange={(event) => setPlanForm((old) => ({ ...old, title: event.target.value }))}
                placeholder="مثال: خطة المادة للفصل الأول"
              />
            </label>
            <label>
              المسؤول
              <input
                value={planForm.owner}
                maxLength={120}
                onChange={(event) => setPlanForm((old) => ({ ...old, owner: event.target.value }))}
                placeholder="اختياري"
              />
            </label>
            <label>
              من تاريخ
              <input
                type="date"
                value={planForm.periodStart}
                onChange={(event) =>
                  setPlanForm((old) => ({ ...old, periodStart: event.target.value }))
                }
              />
            </label>
            <label>
              إلى تاريخ
              <input
                type="date"
                value={planForm.periodEnd}
                onChange={(event) =>
                  setPlanForm((old) => ({ ...old, periodEnd: event.target.value }))
                }
              />
            </label>
            <button type="submit" className="primary-action">
              حفظ الخطة
            </button>
          </form>
          <p className="plan-hint">
            استخراج الأنشطة من ملفات Word وExcel وPDF سيُضاف في مرحلة الاستيراد بعد اختبار الصيغ. لا
            تُستورد ملفات الآن.
          </p>
        </section>
      )}

      {notice && (
        <p className="plan-notice" role="alert">
          {notice}
        </p>
      )}

      {selected ? (
        <section className="card plan-detail" aria-label="تفاصيل الخطة">
          <div className="plan-detail-heading">
            <button
              type="button"
              className="plan-back"
              onClick={() => {
                setSelectedId(null);
                setCreateOpen(false);
              }}
            >
              <ArrowRight size={17} aria-hidden="true" /> جميع الخطط
            </button>
            <span className="plan-kind-chip">{selected.kind}</span>
          </div>
          <div className="plan-detail-title">
            <div>
              <h2>{selected.title}</h2>
              <p>{selected.owner ? 'المسؤول: ' + selected.owner : 'لم يحدد مسؤول'}</p>
            </div>
            <div className="plan-detail-actions">
              <button
                type="button"
                className="plan-outline-button"
                onClick={() => {
                  setDetailsForm({
                    title: selected.title,
                    kind: selected.kind,
                    owner: selected.owner,
                    periodStart: selected.periodStart,
                    periodEnd: selected.periodEnd,
                  });
                  setEditingPlan((open) => !open);
                }}
              >
                <Pencil size={16} aria-hidden="true" /> تعديل الخطة
              </button>
              <button type="button" className="plan-outline-button" onClick={archivePlan}>
                {selected.archived ? (
                  <RotateCcw size={16} aria-hidden="true" />
                ) : (
                  <Archive size={16} aria-hidden="true" />
                )}
                {selected.archived ? 'استعادة الخطة' : 'أرشفة الخطة'}
              </button>
            </div>
          </div>

          {editingPlan && (
            <form
              className="plan-form-grid plan-inline-form"
              onSubmit={savePlanDetails}
              aria-label="تعديل بيانات الخطة"
            >
              <label>
                نوع الخطة
                <select
                  value={detailsForm.kind}
                  onChange={(event) =>
                    setDetailsForm((old) => ({ ...old, kind: event.target.value as PlanKind }))
                  }
                >
                  {PLAN_KINDS.map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label>
                اسم الخطة
                <input
                  required
                  maxLength={150}
                  value={detailsForm.title}
                  onChange={(event) =>
                    setDetailsForm((old) => ({ ...old, title: event.target.value }))
                  }
                />
              </label>
              <label>
                المسؤول
                <input
                  maxLength={120}
                  value={detailsForm.owner}
                  onChange={(event) =>
                    setDetailsForm((old) => ({ ...old, owner: event.target.value }))
                  }
                />
              </label>
              <label>
                من تاريخ
                <input
                  type="date"
                  value={detailsForm.periodStart}
                  onChange={(event) =>
                    setDetailsForm((old) => ({ ...old, periodStart: event.target.value }))
                  }
                />
              </label>
              <label>
                إلى تاريخ
                <input
                  type="date"
                  value={detailsForm.periodEnd}
                  onChange={(event) =>
                    setDetailsForm((old) => ({ ...old, periodEnd: event.target.value }))
                  }
                />
              </label>
              <button type="submit" className="primary-action">
                حفظ بيانات الخطة
              </button>
            </form>
          )}

          {selected.archived && (
            <p className="plan-archived-note">
              هذه الخطة مؤرشفة ولا تظهر في مؤشرات الصفحة الرئيسية. يمكن استعادتها في أي وقت.
            </p>
          )}
          <div className="plan-detail-stats" aria-label="مؤشرات الخطة المحددة">
            <div>
              <span>نسبة الإنجاز</span>
              <strong>{stats?.percent === null ? 'لا توجد أنشطة' : stats?.percent + '%'}</strong>
            </div>
            <div>
              <span>الأنشطة المعتمدة</span>
              <strong>{stats?.total}</strong>
            </div>
            <div>
              <span>المكتملة</span>
              <strong>{stats?.completed}</strong>
            </div>
            <div>
              <span>المتأخرة</span>
              <strong>{stats?.overdue}</strong>
            </div>
          </div>
          <div className="plan-activities-heading">
            <div>
              <h3>أنشطة الخطة</h3>
              <p>غيّر حالة النشاط حسب التنفيذ الفعلي. الشواهد ستُفعّل في مرحلة مستقلة.</p>
            </div>
            <button
              type="button"
              className="primary-action plans-add-button"
              onClick={() => {
                setEditingActivityId(null);
                setActivityForm(emptyActivity());
                setActivityOpen((open) => !open);
              }}
            >
              <Plus size={17} aria-hidden="true" /> إضافة نشاط
            </button>
          </div>

          {activityOpen && (
            <form
              className="plan-form-grid plan-inline-form"
              aria-label={editingActivityId ? 'تعديل نشاط' : 'إضافة نشاط'}
              onSubmit={saveActivity}
            >
              <label>
                عنوان النشاط
                <input
                  required
                  maxLength={180}
                  value={activityForm.title}
                  onChange={(event) =>
                    setActivityForm((old) => ({ ...old, title: event.target.value }))
                  }
                />
              </label>
              <label>
                المكلف بالتنفيذ
                <input
                  maxLength={120}
                  value={activityForm.assignee}
                  onChange={(event) =>
                    setActivityForm((old) => ({ ...old, assignee: event.target.value }))
                  }
                />
              </label>
              <label>
                تاريخ الاستحقاق
                <input
                  type="date"
                  value={activityForm.dueDate}
                  onChange={(event) =>
                    setActivityForm((old) => ({ ...old, dueDate: event.target.value }))
                  }
                />
              </label>
              <label className="plan-wide-field">
                وصف النشاط
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={activityForm.details}
                  onChange={(event) =>
                    setActivityForm((old) => ({ ...old, details: event.target.value }))
                  }
                />
              </label>
              <button type="submit" className="primary-action">
                {editingActivityId ? 'حفظ تعديل النشاط' : 'حفظ النشاط'}
              </button>
              <button
                type="button"
                className="plan-outline-button"
                onClick={() => {
                  setActivityOpen(false);
                  setEditingActivityId(null);
                }}
              >
                إلغاء
              </button>
            </form>
          )}

          {selected.activities.length === 0 ? (
            <div className="plans-empty plan-activities-empty">
              <ClipboardList size={28} aria-hidden="true" />
              <strong>لا توجد أنشطة معتمدة بعد</strong>
              <p>أضف النشاط الأول، ولن تُعرض نسبة إنجاز قبل ذلك.</p>
            </div>
          ) : (
            <ul className="plan-activity-list">
              {selected.activities.map((activity) => (
                <li key={activity.id}>
                  <div className="plan-activity-description">
                    <strong>{activity.title}</strong>
                    {activity.details && <p>{activity.details}</p>}
                    <div className="plan-activity-meta">
                      {activity.assignee && <span>المكلف: {activity.assignee}</span>}
                      {activity.dueDate && <span>الاستحقاق: {activity.dueDate}</span>}
                      {activity.progress === 'completed' && (
                        <span>
                          <CheckCircle2 size={13} aria-hidden="true" /> مكتمل، ينتظر التوثيق
                        </span>
                      )}
                      {activity.progress !== 'completed' &&
                        activity.dueDate &&
                        validPlanDate(activity.dueDate) &&
                        activity.dueDate < today && (
                          <span className="plan-indicator-late">متأخر</span>
                        )}
                    </div>
                  </div>
                  <div className="plan-activity-controls">
                    <label>
                      حالة النشاط
                      <select
                        aria-label={'حالة النشاط: ' + activity.title}
                        value={activity.progress}
                        onChange={(event) => {
                          const progress = event.target.value as PlanProgress;
                          updatePlan(selected.id, (plan) => ({
                            ...plan,
                            activities: plan.activities.map((item) =>
                              item.id === activity.id
                                ? changeActivityProgress(item, progress, new Date().toISOString())
                                : item,
                            ),
                          }));
                        }}
                      >
                        <option value="not_started">لم يبدأ</option>
                        <option value="in_progress">قيد التنفيذ</option>
                        <option value="completed">مكتمل</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="plan-icon-button"
                      aria-label={'تعديل النشاط: ' + activity.title}
                      onClick={() => startEditActivity(activity)}
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="plan-icon-button plan-delete-button"
                      aria-label={'حذف النشاط: ' + activity.title}
                      onClick={() => {
                        if (!window.confirm('حذف هذا النشاط من الخطة؟ لا يمكن التراجع.')) return;
                        updatePlan(selected.id, (plan) => ({
                          ...plan,
                          activities: plan.activities.filter((item) => item.id !== activity.id),
                        }));
                        if (editingActivityId === activity.id) {
                          setEditingActivityId(null);
                          setActivityOpen(false);
                        }
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="card plan-library-list">
          <div className="plan-list-heading">
            <h3>الخطط المسجلة ({visiblePlans.length})</h3>
            <label>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />{' '}
              إظهار المؤرشفة
            </label>
          </div>
          {visiblePlans.length === 0 ? (
            <div className="plans-empty">
              <ClipboardList size={29} aria-hidden="true" />
              <strong>لا توجد خطط في القائمة</strong>
              <p>أنشئ خطة جديدة، أو أظهر الخطط المؤرشفة.</p>
            </div>
          ) : (
            <div className="plan-library-cards">
              {visiblePlans.map((plan) => {
                const value = planStats(plan, today);
                return (
                  <button
                    type="button"
                    key={plan.id}
                    className="plan-library-item"
                    onClick={() => setSelectedId(plan.id)}
                  >
                    <span className="plan-kind-chip">
                      {plan.kind}
                      {plan.archived ? ' · مؤرشفة' : ''}
                    </span>
                    <strong>{plan.title}</strong>
                    <span>
                      {value.percent === null ? 'لا توجد أنشطة معتمدة' : value.percent + '% إنجاز'}
                    </span>
                    <span>
                      {value.completed} من {value.total} مكتملة
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
      <p className="plan-storage-note">
        تُحفظ الخطط والأنشطة محليًا في هذا المتصفح. لا تتزامن بين الأجهزة، ولا يُنصح بالاعتماد عليها
        وحدها كنسخة احتياطية دائمة.
      </p>
    </div>
  );
}
