import { useState } from 'react';
import { localDateKey } from './dashboard-metrics';
import {
  ACTIVITY_KINDS,
  ITEM_CONDITIONS,
  emptyActivitiesStore,
  readActivitiesStore,
  recordInventoryCheck,
  removeActivity,
  removeItem,
  saveActivity,
  saveItem,
  writeActivitiesStore,
  type ActivitiesInventoryStore,
  type ActivityEntry,
  type ActivityKind,
  type InventoryItem,
  type ItemCondition,
} from './activities-inventory-model';
import './activities-inventory.css';

const blankActivity = (today: string): Omit<ActivityEntry, 'id' | 'createdAt'> => ({ kind: ACTIVITY_KINDS[0].kind, title: '', date: today, owner: '', participants: '', notes: '' });
const blankItem = (): Omit<InventoryItem, 'id'> => ({ name: '', location: '', quantity: 1, condition: 'صالح', notes: '' });

export default function ActivitiesInventory() {
  const today = localDateKey(new Date());
  const [broken] = useState(() => {
    try {
      readActivitiesStore();
      return false;
    } catch {
      return true;
    }
  });
  const [store, setStore] = useState<ActivitiesInventoryStore>(() => {
    try {
      return readActivitiesStore();
    } catch {
      return emptyActivitiesStore();
    }
  });
  const [activity, setActivity] = useState(() => blankActivity(today));
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [item, setItem] = useState(blankItem);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ActivityKind | ''>('');
  const [checkNote, setCheckNote] = useState('');
  const [message, setMessage] = useState('');

  const apply = (fn: () => ActivitiesInventoryStore, ok: string) => {
    if (broken) return false;
    try {
      const next = fn();
      writeActivitiesStore(next);
      setStore(next);
      setMessage(ok);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر الحفظ.');
      return false;
    }
  };

  const activities = store.activities.filter((a) => !kindFilter || a.kind === kindFilter).sort((a, b) => b.date.localeCompare(a.date));
  const issues = store.inventory.filter((i) => i.condition !== 'صالح');
  const lastCheck = store.checks[0];
  const kindHint = ACTIVITY_KINDS.find((k) => k.kind === activity.kind);

  return (
    <section className="card activities-inventory" aria-label="الأنشطة والجرد">
      <h2>الأنشطة والمسابقات والجرد</h2>
      <p className="ai-lead">سجل خفيف لما لا يغطيه قسم آخر. كل تسجيل يُحتسب لواجبه في موجز اليوم والتقرير الفصلي: الأنشطة (13)، والجماعات (19)، والمسابقات (20)، والبيت والمجتمع (34)، والجرد (9).</p>
      {broken && <p role="alert">بيانات الأنشطة والجرد تالفة؛ عُطّل الحفظ حتى لا تُستبدل. استعد نسخة احتياطية.</p>}
      {message && <p role="status">{message}</p>}

      <h3>سجل الأنشطة والمسابقات</h3>
      <fieldset className="ai-form" disabled={broken}>
        <legend>{editingActivity ? 'تعديل النشاط' : 'إضافة نشاط'}</legend>
        <label>
          نوع النشاط
          <select value={activity.kind} onChange={(e) => setActivity({ ...activity, kind: e.target.value as ActivityKind })}>
            {ACTIVITY_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>{k.kind} (الواجب {k.duty})</option>
            ))}
          </select>
          <small>{kindHint?.hint}</small>
        </label>
        <label>
          عنوان النشاط
          <input value={activity.title} maxLength={300} onChange={(e) => setActivity({ ...activity, title: e.target.value })} />
        </label>
        <label>
          تاريخ النشاط
          <input type="date" value={activity.date} onChange={(e) => setActivity({ ...activity, date: e.target.value })} />
        </label>
        <label>
          المسؤول
          <input value={activity.owner} maxLength={300} onChange={(e) => setActivity({ ...activity, owner: e.target.value })} />
        </label>
        <label>
          المشاركون
          <input value={activity.participants} maxLength={1000} onChange={(e) => setActivity({ ...activity, participants: e.target.value })} placeholder="مثال: 12 طالبًا من الصف التاسع" />
        </label>
        <label className="ai-wide">
          النتائج والملاحظات
          <textarea rows={2} value={activity.notes} maxLength={2000} onChange={(e) => setActivity({ ...activity, notes: e.target.value })} />
        </label>
        <div className="ai-actions">
          <button
            type="button"
            onClick={() => {
              if (apply(() => saveActivity(store, activity, editingActivity ?? undefined), editingActivity ? 'حُدّث النشاط.' : 'حُفظ النشاط.')) {
                setActivity(blankActivity(today));
                setEditingActivity(null);
              }
            }}
          >
            {editingActivity ? 'حفظ التعديل' : 'حفظ النشاط'}
          </button>
          {editingActivity && (
            <button type="button" onClick={() => { setEditingActivity(null); setActivity(blankActivity(today)); }}>
              إلغاء التعديل
            </button>
          )}
        </div>
      </fieldset>
      <div className="ai-list-head">
        <strong>الأنشطة المسجلة ({activities.length})</strong>
        <label>
          تصفية حسب النوع
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ActivityKind | '')}>
            <option value="">كل الأنواع</option>
            {ACTIVITY_KINDS.map((k) => <option key={k.kind}>{k.kind}</option>)}
          </select>
        </label>
      </div>
      {activities.length ? (
        <ul className="ai-list">
          {activities.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <small>{a.kind} · {a.date}{a.owner ? ' · ' + a.owner : ''}{a.participants ? ' · ' + a.participants : ''}</small>
                {a.notes && <p>{a.notes}</p>}
              </div>
              {!broken && (
                <div className="ai-row-actions">
                  <button type="button" onClick={() => { setEditingActivity(a.id); setActivity({ kind: a.kind, title: a.title, date: a.date, owner: a.owner, participants: a.participants, notes: a.notes }); }}>تعديل</button>
                  <button type="button" onClick={() => window.confirm('حذف هذا النشاط؟') && apply(() => removeActivity(store, a.id), 'حُذف النشاط.')}>حذف</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ai-empty">لا توجد أنشطة مسجلة{kindFilter ? ' من هذا النوع' : ''}.</p>
      )}

      <h3>جرد الوسائل والتقنيات</h3>
      <div className="ai-inventory-summary">
        <span>الأصناف <b>{store.inventory.length}</b></span>
        <span>تحتاج إجراء <b>{issues.length}</b></span>
        <span>آخر جرد معتمد <b>{lastCheck ? lastCheck.date : '—'}</b></span>
      </div>
      <fieldset className="ai-form" disabled={broken}>
        <legend>{editingItem ? 'تعديل الصنف' : 'إضافة صنف'}</legend>
        <label>
          اسم الوسيلة أو الجهاز
          <input value={item.name} maxLength={300} onChange={(e) => setItem({ ...item, name: e.target.value })} />
        </label>
        <label>
          الموقع
          <input value={item.location} maxLength={200} onChange={(e) => setItem({ ...item, location: e.target.value })} placeholder="مثال: مختبر الفيزياء" />
        </label>
        <label>
          العدد
          <input type="number" min={0} value={item.quantity} onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) })} />
        </label>
        <label>
          الحالة
          <select value={item.condition} onChange={(e) => setItem({ ...item, condition: e.target.value as ItemCondition })}>
            {ITEM_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="ai-wide">
          ملاحظات الصنف
          <input value={item.notes} maxLength={1000} onChange={(e) => setItem({ ...item, notes: e.target.value })} />
        </label>
        <div className="ai-actions">
          <button
            type="button"
            onClick={() => {
              if (apply(() => saveItem(store, item, editingItem ?? undefined), editingItem ? 'حُدّث الصنف.' : 'أُضيف الصنف.')) {
                setItem(blankItem());
                setEditingItem(null);
              }
            }}
          >
            {editingItem ? 'حفظ الصنف' : 'إضافة الصنف'}
          </button>
          {editingItem && <button type="button" onClick={() => { setEditingItem(null); setItem(blankItem()); }}>إلغاء التعديل</button>}
        </div>
      </fieldset>
      {store.inventory.length > 0 && (
        <div className="report-table-wrap">
          <table className="ai-table">
            <thead>
              <tr><th>الصنف</th><th>الموقع</th><th>العدد</th><th>الحالة</th><th>ملاحظات</th>{!broken && <th>إجراء</th>}</tr>
            </thead>
            <tbody>
              {store.inventory.map((i) => (
                <tr key={i.id} className={i.condition === 'صالح' ? '' : 'ai-issue'}>
                  <td>{i.name}</td><td>{i.location || '—'}</td><td>{i.quantity}</td><td>{i.condition}</td><td>{i.notes || '—'}</td>
                  {!broken && (
                    <td className="ai-row-actions">
                      <button type="button" aria-label={'تعديل ' + i.name} onClick={() => { setEditingItem(i.id); setItem({ name: i.name, location: i.location, quantity: i.quantity, condition: i.condition, notes: i.notes }); }}>تعديل</button>
                      <button type="button" aria-label={'حذف ' + i.name} onClick={() => window.confirm('حذف هذا الصنف من الجرد؟') && apply(() => removeItem(store, i.id), 'حُذف الصنف.')}>حذف</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {issues.length > 0 && (
        <p className="ai-issues">
          نواقص ترفع للإدارة: {issues.map((i) => `${i.name} (${i.condition})`).join('، ')}.
        </p>
      )}
      <div className="ai-check">
        <label>
          ملاحظة الجرد
          <input value={checkNote} maxLength={1000} disabled={broken} onChange={(e) => setCheckNote(e.target.value)} placeholder="مثال: جرد بداية الفصل بحضور فني المختبر" />
        </label>
        <button type="button" disabled={broken || !store.inventory.length} onClick={() => apply(() => recordInventoryCheck(store, today, checkNote), 'اعتُمد جرد اليوم.') && setCheckNote('')}>
          اعتماد جرد اليوم (الواجب 9)
        </button>
      </div>
      {store.checks.length > 0 && (
        <details className="ai-history">
          <summary>سجل الجرد ({store.checks.length})</summary>
          <ul>{store.checks.map((c) => <li key={c.id}>{c.date} · {c.items} صنفًا · {c.issues} تحتاج إجراء{c.note ? ' · ' + c.note : ''}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
