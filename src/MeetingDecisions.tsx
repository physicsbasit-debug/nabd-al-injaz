import { useEffect, useState } from 'react';
import {
  addDecision,
  emptyDecisionStore,
  openDecisions,
  readDecisionStore,
  removeDecision,
  setDecisionDone,
  writeDecisionStore,
  DECISIONS_CHANGED,
  MEETING_DECISIONS_KEY,
  type MeetingDecisionStore,
} from './meeting-decisions-model';
import { localDateKey } from './dashboard-metrics';

type Meeting = { planId: string; meetingId: string; meetingTitle: string };

function useDecisions() {
  const [broken] = useState(() => {
    try {
      readDecisionStore();
      return false;
    } catch {
      return true;
    }
  });
  const [store, setStore] = useState<MeetingDecisionStore>(() => {
    try {
      return readDecisionStore();
    } catch {
      return emptyDecisionStore();
    }
  });
  useEffect(() => {
    if (broken) return;
    const refresh = () => {
      try {
        setStore(readDecisionStore());
      } catch {
        /* تبقى آخر نسخة سليمة معروضة */
      }
    };
    const onStorage = (event: StorageEvent) => event.key === MEETING_DECISIONS_KEY && refresh();
    window.addEventListener(DECISIONS_CHANGED, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(DECISIONS_CHANGED, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [broken]);
  const save = (next: MeetingDecisionStore) => {
    if (broken) return;
    setStore(next);
    writeDecisionStore(next);
  };
  return { store, save, broken };
}

const label = (due: string, today: string) => (!due ? 'دون موعد' : due < today ? `متأخر · ${due}` : due === today ? 'اليوم' : due);

/** قرارات اجتماع واحد: الإضافة والمتابعة حتى التنفيذ. */
export function MeetingDecisionList({ meeting }: { meeting: Meeting }) {
  const { store, save, broken } = useDecisions();
  const today = localDateKey(new Date());
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const mine = store.decisions.filter((d) => d.planId === meeting.planId && d.meetingId === meeting.meetingId);
  const done = mine.filter((d) => d.doneAt).length;
  const add = () => {
    try {
      save(addDecision(store, { ...meeting, text, owner, dueDate: due }));
      setText('');
      setOwner('');
      setDue('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ القرار.');
    }
  };
  return (
    <details className="meeting-decisions" open={mine.length > 0 && done < mine.length}>
      <summary>
        القرارات والتوصيات <span>{mine.length ? `${done}/${mine.length} منفذ` : 'لا توجد'}</span>
      </summary>
      {broken && <p role="alert">بيانات القرارات تالفة؛ عُطّل الحفظ حتى لا تُستبدل.</p>}
      {mine.length > 0 && (
        <ul>
          {mine.map((d) => (
            <li key={d.id} className={d.doneAt ? 'done' : d.dueDate && d.dueDate < today ? 'late' : ''}>
              <label>
                <input type="checkbox" checked={!!d.doneAt} disabled={broken} onChange={(e) => save(setDecisionDone(store, d.id, e.target.checked))} />
                <span>
                  <strong>{d.text}</strong>
                  <small>
                    {d.owner || 'دون مسؤول'} · {d.doneAt ? 'نُفّذ ' + d.doneAt.slice(0, 10) : label(d.dueDate, today)}
                  </small>
                </span>
              </label>
              {!broken && (
                <button type="button" className="teacher-link" aria-label={'حذف القرار: ' + d.text} onClick={() => window.confirm('حذف هذا القرار؟') && save(removeDecision(store, d.id))}>
                  حذف
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!broken && (
        <div className="meeting-decision-form">
          <label>
            نص القرار
            <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="مثال: تبادل زيارتين بين معلمي الصف التاسع" />
          </label>
          <label>
            مسؤول التنفيذ
            <input value={owner} maxLength={300} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label>
            موعد التنفيذ
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <button type="button" onClick={add}>
            إضافة القرار
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </details>
  );
}

/** متابعة قرارات الاجتماعات السابقة غير المنفذة قبل الاجتماع القادم. */
export function OpenDecisionsSummary() {
  const { store, save, broken } = useDecisions();
  const today = localDateKey(new Date());
  const open = openDecisions(store);
  if (!open.length) return null;
  const late = open.filter((d) => d.dueDate && d.dueDate < today).length;
  return (
    <section className="meeting-open" aria-label="قرارات لم تُنفّذ بعد">
      <h3>قرارات لم تُنفّذ بعد ({open.length})</h3>
      <p>{late ? `${late} منها تجاوزت موعدها. ` : ''}راجعها في بداية الاجتماع القادم.</p>
      <ul>
        {open.map((d) => (
          <li key={d.id} className={d.dueDate && d.dueDate < today ? 'late' : ''}>
            <label>
              <input type="checkbox" checked={false} disabled={broken} onChange={() => save(setDecisionDone(store, d.id, true))} aria-label={'تم تنفيذ: ' + d.text} />
              <span>
                <strong>{d.text}</strong>
                <small>
                  {d.meetingTitle} · {d.owner || 'دون مسؤول'} · {label(d.dueDate, today)}
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
