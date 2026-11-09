import EvidencePanel from './EvidencePanel';
import EvidenceStatus from './EvidenceStatus';
import { deleteActivityEvidence, deletePlanEvidence } from './evidence-store';
import PlanImport from './PlanImport';
import { useEffect, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { ArrowRight, Plus, Archive, RotateCcw } from 'lucide-react';
import {
  PLAN_KINDS,
  createPlan,
  createActivity,
  changeProgress,
  planStats,
  validDate,
  type Plan,
  type PlanKind,
  type PlanActivity,
  type Progress,
} from './plan-model';
import { localDateKey } from './dashboard-metrics';

type Props = {
  plans: Plan[];
  setPlans: Dispatch<SetStateAction<Plan[]>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  createRequested: boolean;
  onCreateHandled: () => void;
};
const emptyPlan = {
  title: '',
  kind: 'خطة المادة' as PlanKind,
  owner: '',
  periodStart: '',
  periodEnd: '',
};
const PAGE_SIZE = 8;
const emptyActivity = { title: '', details: '', assignee: '', dueDate: '' };
export default function PlanLibrary({
  plans,
  setPlans,
  selectedId,
  onSelect,
  createRequested,
  onCreateHandled,
}: Props) {
  const [form, setForm] = useState(emptyPlan);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [showCreate, setShowCreate] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [draft, setDraft] = useState(emptyActivity);
  const [error, setError] = useState('');
  const [evidenceActivity, setEvidenceActivity] = useState<string | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  useEffect(() => {
    if (createRequested) {
      setShowCreate(true);
      onCreateHandled();
    }
  }, [createRequested, onCreateHandled]);
  const selected = plans.find((p) => p.id === selectedId);
  const today = localDateKey(new Date());
  const pageCount = Math.max(1, Math.ceil((selected?.activities.length ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(activityPage, pageCount);
  const shownActivities =
    selected?.activities.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? [];
  const updatePlan = (id: string, fn: (p: Plan) => Plan) =>
    setPlans((old) => old.map((p) => (p.id === id ? fn(p) : p)));
  const validRange = (start: string, end: string) =>
    !((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end));
  const addPlan = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('أدخل اسم الخطة.');
      return;
    }
    if (!validRange(form.periodStart, form.periodEnd)) {
      setError('تحقق من تاريخ بداية الخطة ونهايتها.');
      return;
    }
    const plan = createPlan(form);
    setPlans((old) => [...old, plan]);
    onSelect(plan.id);
    setForm(emptyPlan);
    setShowCreate(false);
  };
  const addActivity = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selected || !activityForm.title.trim()) {
      setError('أدخل اسم النشاط.');
      return;
    }
    if (activityForm.dueDate && !validDate(activityForm.dueDate)) {
      setError('تاريخ النشاط غير صحيح.');
      return;
    }
    const activity = createActivity(activityForm);
    updatePlan(selected.id, (p) => ({ ...p, activities: [...p.activities, activity] }));
    setActivityForm(emptyActivity);
    setShowActivity(false);
  };
  const editActivity = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selected || !editing || !draft.title.trim()) {
      setError('أدخل اسم النشاط.');
      return;
    }
    if (draft.dueDate && !validDate(draft.dueDate)) {
      setError('تاريخ النشاط غير صحيح.');
      return;
    }
    updatePlan(selected.id, (p) => ({
      ...p,
      activities: p.activities.map((a) =>
        a.id === editing ? { ...a, ...draft, title: draft.title.trim() } : a,
      ),
    }));
    setEditing(null);
  };
  const changeStatus = (a: PlanActivity, progress: Progress) => {
    if (!selected) return;
    updatePlan(selected.id, (p) => ({
      ...p,
      activities: p.activities.map((x) =>
        x.id === a.id ? changeProgress(x, progress, new Date().toISOString()) : x,
      ),
    }));
  };
  const deletePlan = async (plan: Plan) => {
    if (
      !window.confirm('حذف الخطة وجميع أنشطتها وشواهدها نهائيًا من هذا المتصفح؟ لا يمكن التراجع.')
    )
      return;
    try {
      await deletePlanEvidence(plan.id);
      setPlans((old) => old.filter((p) => p.id !== plan.id));
      setEvidenceActivity(null);
      onSelect(null);
    } catch {
      setError('تعذّر حذف شواهد الخطة؛ لم تُحذف الخطة حفاظًا على البيانات.');
    }
  };
  const archive = (plan: Plan) => {
    updatePlan(plan.id, (p) => ({ ...p, archived: !p.archived }));
    onSelect(null);
  };
  const visible = plans.filter((p) => showArchived || !p.archived);
  return (
    <section className="plan-library">
      <div className="plan-library-heading">
        <div>
          <span className="executive-eyebrow">إدارة الخطط التربوية</span>
          <h2>خططك التربوية</h2>
          <p>أنشئ الخطط، وأضف أنشطتها، وتابع مستوى تنفيذها.</p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            onSelect(null);
            setShowCreate((v) => !v);
            setError('');
          }}
        >
          <Plus size={17} /> إضافة خطة
        </button>
      </div>
      {showCreate && (
        <form className="card plan-form" onSubmit={addPlan}>
          <h3>إنشاء خطة جديدة</h3>
          <label>
            اسم الخطة *
            <input
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
              required
            />
          </label>
          <label>
            نوع الخطة
            <select
              value={form.kind}
              onChange={(e) => setForm((v) => ({ ...v, kind: e.target.value as PlanKind }))}
            >
              {PLAN_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            المسؤول
            <input
              value={form.owner}
              maxLength={100}
              onChange={(e) => setForm((v) => ({ ...v, owner: e.target.value }))}
            />
          </label>
          <label>
            من تاريخ
            <input
              type="date"
              value={form.periodStart}
              onChange={(e) => setForm((v) => ({ ...v, periodStart: e.target.value }))}
            />
          </label>
          <label>
            إلى تاريخ
            <input
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm((v) => ({ ...v, periodEnd: e.target.value }))}
            />
          </label>
          <div className="plan-form-actions">
            <button type="submit" className="primary-action">
              حفظ الخطة
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setError('');
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
      <div className="plan-library-toolbar">
        <span>{plans.filter((p) => !p.archived).length} خطة فعالة</span>
        <label>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{' '}
          إظهار المؤرشفة
        </label>
      </div>
      {visible.length === 0 && !showCreate && (
        <div className="card plan-library-empty">
          <strong>لا توجد خطط بعد</strong>
          <p>ابدأ بإضافة خطة، ثم سجّل أنشطتها يدويًا.</p>
        </div>
      )}
      <div className="plan-library-grid">
        {visible.map((plan) => {
          const stats = planStats(plan, today);
          return (
            <button
              key={plan.id}
              type="button"
              className={'plan-list-card' + (selectedId === plan.id ? ' selected' : '')}
              onClick={() => {
                onSelect(plan.id);
                setShowCreate(false);
                setShowActivity(false);
                setEditing(null);
                setActivityPage(1);
                setError('');
              }}
            >
              <span className="plan-list-kind">
                {plan.kind}
                {plan.archived ? ' • مؤرشفة' : ''}
              </span>
              <strong>{plan.title}</strong>
              <span className="plan-list-stat">
                {stats.percent === null ? 'لا توجد أنشطة معتمدة' : stats.percent + '% إنجاز'}
              </span>
              <span className="plan-indicator-track">
                <span style={{ width: (stats.percent ?? 0) + '%' }} />
              </span>
              <small>
                {stats.total} نشاطًا معتمدًا • {stats.completed} مكتملة{' '}
                {stats.overdue > 0 ? '• ' + stats.overdue + ' متأخرة' : ''}
              </small>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="card plan-detail" aria-label={'تفاصيل خطة ' + selected.title}>
          <div className="plan-detail-heading">
            <div>
              <span className="executive-eyebrow">{selected.kind}</span>
              <h3>{selected.title}</h3>
              <p>
                {selected.owner ? 'المسؤول: ' + selected.owner : 'لم يُحدد مسؤول'}
                {selected.periodStart ? ' • من ' + selected.periodStart : ''}
                {selected.periodEnd ? ' إلى ' + selected.periodEnd : ''}
              </p>
            </div>
            <div className="plan-detail-actions">
              <button type="button" className="plan-secondary" onClick={() => archive(selected)}>
                {selected.archived ? <RotateCcw size={16} /> : <Archive size={16} />}{' '}
                {selected.archived ? 'إعادة تفعيل' : 'أرشفة الخطة'}
              </button>
              <button
                type="button"
                className="plan-delete"
                onClick={() => void deletePlan(selected)}
              >
                حذف الخطة وشواهدها
              </button>
            </div>
          </div>
          <div className="plan-detail-metrics">
            {(() => {
              const m = planStats(selected, today);
              return (
                <>
                  <div>
                    <strong>{m.percent === null ? '—' : m.percent + '%'}</strong>
                    <span>الإنجاز</span>
                  </div>
                  <div>
                    <strong>{m.total}</strong>
                    <span>الأنشطة</span>
                  </div>
                  <div>
                    <strong>{m.completed}</strong>
                    <span>مكتملة</span>
                  </div>
                  <div>
                    <strong>{m.overdue}</strong>
                    <span>متأخرة</span>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="plan-activity-heading">
            <h4>أنشطة الخطة</h4>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setShowActivity((v) => !v);
                setError('');
              }}
            >
              <Plus size={16} /> إضافة نشاط يدوي
            </button>
          </div>
          {showActivity && (
            <form className="plan-form plan-activity-form" onSubmit={addActivity}>
              <label>
                اسم النشاط *
                <input
                  required
                  maxLength={160}
                  value={activityForm.title}
                  onChange={(e) => setActivityForm((v) => ({ ...v, title: e.target.value }))}
                />
              </label>
              <label>
                المسؤول
                <input
                  maxLength={100}
                  value={activityForm.assignee}
                  onChange={(e) => setActivityForm((v) => ({ ...v, assignee: e.target.value }))}
                />
              </label>
              <label>
                تاريخ الاستحقاق
                <input
                  type="date"
                  value={activityForm.dueDate}
                  onChange={(e) => setActivityForm((v) => ({ ...v, dueDate: e.target.value }))}
                />
              </label>
              <label className="plan-wide">
                تفاصيل النشاط
                <textarea
                  value={activityForm.details}
                  maxLength={1000}
                  onChange={(e) => setActivityForm((v) => ({ ...v, details: e.target.value }))}
                />
              </label>
              <div className="plan-form-actions">
                <button className="primary-action" type="submit">
                  حفظ النشاط
                </button>
                <button type="button" onClick={() => setShowActivity(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          )}
          {selected.activities.length === 0 ? (
            <p className="plan-activity-empty">
              لا توجد أنشطة معتمدة لهذه الخطة. أضف نشاطًا لبدء المتابعة.
            </p>
          ) : (
            <ul className="plan-activity-list">
              {shownActivities.map((a) => (
                <li key={a.id}>
                  {editing === a.id ? (
                    <form className="plan-form plan-activity-form" onSubmit={editActivity}>
                      <label>
                        اسم النشاط
                        <input
                          required
                          value={draft.title}
                          maxLength={160}
                          onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))}
                        />
                      </label>
                      <label>
                        المسؤول
                        <input
                          value={draft.assignee}
                          maxLength={100}
                          onChange={(e) => setDraft((v) => ({ ...v, assignee: e.target.value }))}
                        />
                      </label>
                      <label>
                        تاريخ الاستحقاق
                        <input
                          type="date"
                          value={draft.dueDate}
                          onChange={(e) => setDraft((v) => ({ ...v, dueDate: e.target.value }))}
                        />
                      </label>
                      <label className="plan-wide">
                        تفاصيل النشاط
                        <textarea
                          value={draft.details}
                          maxLength={1000}
                          onChange={(e) => setDraft((v) => ({ ...v, details: e.target.value }))}
                        />
                      </label>
                      <div className="plan-form-actions">
                        <button type="submit" className="primary-action">
                          حفظ التعديل
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          إلغاء
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="plan-activity-text">
                        <strong>{a.title}</strong>
                        <small>
                          {a.assignee ? 'المسؤول: ' + a.assignee + ' • ' : ''}
                          {a.dueDate ? 'الاستحقاق: ' + a.dueDate : 'دون موعد'}
                        </small>
                        {a.details && <p>{a.details}</p>}
                        <EvidenceStatus
                          activityId={a.id}
                          completed={a.progress === 'completed'}
                          revision={evidenceRevision}
                        />
                      </div>
                      <label className="plan-progress-select">
                        الحالة
                        <select
                          aria-label={'حالة النشاط: ' + a.title}
                          value={a.progress}
                          onChange={(e) => changeStatus(a, e.target.value as Progress)}
                        >
                          <option value="not_started">لم يبدأ</option>
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="completed">مكتمل</option>
                        </select>
                      </label>
                      <div className="plan-activity-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setEvidenceActivity(evidenceActivity === a.id ? null : a.id)
                          }
                        >
                          الشواهد والتوثيق
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(a.id);
                            setDraft({
                              title: a.title,
                              details: a.details,
                              assignee: a.assignee,
                              dueDate: a.dueDate,
                            });
                          }}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="plan-delete"
                          onClick={async () => {
                            if (!window.confirm('حذف النشاط وشواهده نهائيًا من هذا المتصفح؟'))
                              return;
                            try {
                              await deleteActivityEvidence(a.id);
                              updatePlan(selected.id, (p) => ({
                                ...p,
                                activities: p.activities.filter((x) => x.id !== a.id),
                              }));
                              setEvidenceActivity(null);
                            } catch {
                              setError(
                                'تعذّر حذف شواهد النشاط؛ لم يُحذف النشاط حفاظًا على البيانات.',
                              );
                            }
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {evidenceActivity && selected.activities.some((a) => a.id === evidenceActivity) && (
            <div
              className="evidence-dialog-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setEvidenceActivity(null);
                  setEvidenceRevision((v) => v + 1);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="الشواهد والتوثيق"
                className="evidence-dialog"
              >
                <EvidencePanel
                  key={evidenceActivity}
                  planId={selected.id}
                  activityId={evidenceActivity}
                  activityTitle={
                    selected.activities.find((a) => a.id === evidenceActivity)?.title ?? ''
                  }
                  onClose={() => {
                    setEvidenceActivity(null);
                    setEvidenceRevision((v) => v + 1);
                  }}
                />
              </div>
            </div>
          )}
          {selected.activities.length > PAGE_SIZE && (
            <nav className="plan-activity-pagination" aria-label="صفحات أنشطة الخطة">
              <span>
                عرض {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, selected.activities.length)} من{' '}
                {selected.activities.length} نشاطًا
              </span>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setActivityPage((n) => Math.max(1, n - 1))}
              >
                السابق
              </button>
              <span>
                صفحة {currentPage} من {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setActivityPage((n) => Math.min(pageCount, n + 1))}
              >
                التالي
              </button>
            </nav>
          )}
          <PlanImport
            existingTitles={selected.activities.map((a) => a.title)}
            onApprove={(activities) => {
              updatePlan(selected.id, (p) => ({
                ...p,
                activities: [...p.activities, ...activities],
              }));
            }}
          />
          <p className="plan-storage-note">
            الخطط محفوظة محليًا، والشواهد في IndexedDB داخل هذا المتصفح فقط. لا يُحتسب رفع ملف
            كإنجاز. احفظ نسخًا من الملفات الأصلية خارج المتصفح.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      <button className="plan-back-link" type="button" onClick={() => onSelect(null)}>
        <ArrowRight size={16} /> إغلاق تفاصيل الخطة
      </button>
    </section>
  );
}
