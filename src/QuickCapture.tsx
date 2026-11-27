import { useState } from 'react';
import { readSchedule } from './schedule-model';
import { withAssessmentLock } from './assessment-lock';
import { compactVisit, isSupervisoryVisit, readSupervisoryVisits, SUPERVISORY_VISITS_KEY, VISIT_METHODS, type SupervisoryVisit, type VisitMethod } from './supervisory-visits-model';
import { CHECK_KINDS, emptyTeacherStore, readTeacherStore, recordCheck, writeTeacherStore, type CheckKind } from './teacher-profile-model';
import { ACTIVITY_KINDS, readActivitiesStore, saveActivity, writeActivitiesStore, type ActivityKind } from './activities-inventory-model';
import { DUTIES, DUTY_GROUPS } from './duties';
import TeacherNameHint from './TeacherNameHint';
import type { Task } from './task-model';

type Kind = 'visit' | 'check' | 'activity' | 'duty';
const KINDS: Array<[Kind, string]> = [
  ['visit', 'زيارة منفذة'],
  ['check', 'فحص لمعلم'],
  ['activity', 'نشاط أو مسابقة'],
  ['duty', 'إنجاز لواجب آخر'],
];

type Props = { today: string; onAddTask: (task: Task) => void; onSaved: (message: string) => void; onClose: () => void };

/** تسجيل سريع من الموجز: أقل الحقول اللازمة، ويُحتسب الإنجاز لواجبه فورًا. */
export default function QuickCapture({ today, onAddTask, onSaved, onClose }: Props) {
  const [roster] = useState(() => {
    try {
      return readSchedule().teachers;
    } catch {
      return [] as string[];
    }
  });
  const [kind, setKind] = useState<Kind>('visit');
  const [teacher, setTeacher] = useState('');
  const [method, setMethod] = useState<VisitMethod | ''>('');
  const [check, setCheck] = useState<CheckKind>('سجلات');
  const [ok, setOk] = useState(true);
  const [activityKind, setActivityKind] = useState<ActivityKind>(ACTIVITY_KINDS[0].kind);
  const [dutyId, setDutyId] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const needsTeacher = kind === 'visit' || kind === 'check';
  const textLabel = kind === 'activity' ? 'عنوان النشاط' : kind === 'duty' ? 'ماذا أنجزت؟' : 'ملاحظة مختصرة';

  async function save() {
    setError('');
    if (needsTeacher && !teacher.trim()) return setError('اختر المعلم.');
    if ((kind === 'activity' || kind === 'duty') && !text.trim()) return setError('اكتب وصفًا قصيرًا.');
    if (kind === 'duty' && !dutyId) return setError('اختر الواجب.');
    setBusy(true);
    try {
      if (kind === 'visit') {
        const record: SupervisoryVisit = compactVisit({
          id: crypto.randomUUID(), teacher: teacher.trim(), date: today, status: 'completed', subject: '', grade: '', section: '', period: '', lesson: '',
          strengths: '', improvements: '', recommendations: '', followUp: '', documentation: text.trim().slice(0, 4000), planId: '', activityId: '',
          createdAt: new Date().toISOString(), ...(method ? { method } : {}),
        });
        if (!isSupervisoryVisit(record)) throw new Error('تعذر حفظ الزيارة؛ راجع البيانات.');
        await withAssessmentLock(async () => {
          const current = readSupervisoryVisits();
          localStorage.setItem(SUPERVISORY_VISITS_KEY, JSON.stringify([...current, record]));
        });
        onSaved(`سُجلت زيارة ${record.teacher}. أكمل تفاصيلها من قسم الزيارات عند الحاجة.`);
      } else if (kind === 'check') {
        let store;
        try {
          store = readTeacherStore();
        } catch {
          throw new Error('بيانات ملفات المعلمين تالفة؛ لم يُحفظ الفحص.');
        }
        writeTeacherStore(recordCheck(store ?? emptyTeacherStore(), teacher, check, ok, text, today));
        onSaved(`سُجل ${CHECK_KINDS.find((c) => c.kind === check)!.label} للمعلم ${teacher.trim()}.`);
      } else if (kind === 'activity') {
        let store;
        try {
          store = readActivitiesStore();
        } catch {
          throw new Error('بيانات الأنشطة تالفة؛ لم يُحفظ النشاط.');
        }
        writeActivitiesStore(saveActivity(store, { kind: activityKind, title: text, date: today, owner: '', participants: '', notes: '' }));
        onSaved(`سُجل النشاط «${text.trim()}».`);
      } else {
        const now = new Date().toISOString();
        onAddTask({
          id: crypto.randomUUID(), title: text.trim().slice(0, 200), dueDate: today, priority: 'عادية', done: true, completedAt: now, createdAt: today,
          category: 'أخرى', assignedTo: '', progress: 'مكتملة', notes: '', dutyId: Number(dutyId),
        });
        onSaved(`سُجل الإنجاز للواجب ${dutyId}.`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quick-capture" role="dialog" aria-label="سجّل إنجازًا">
      <div className="quick-kinds" role="group" aria-label="نوع الإنجاز">
        {KINDS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
        ))}
      </div>
      <div className="quick-fields">
        {needsTeacher && (
          <label>
            المعلم
            <input aria-label="المعلم" list="quick-teachers" value={teacher} maxLength={300} onChange={(e) => setTeacher(e.target.value)} autoFocus />
            <datalist id="quick-teachers">{roster.map((n) => <option key={n} value={n} />)}</datalist>
            <TeacherNameHint name={teacher} roster={roster} onPick={setTeacher} />
          </label>
        )}
        {kind === 'visit' && (
          <label>
            الأسلوب
            <select value={method} onChange={(e) => setMethod(e.target.value as VisitMethod | '')}>
              <option value="">غير محدد</option>
              {VISIT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        )}
        {kind === 'check' && (
          <>
            <label>
              الفحص
              <select value={check} onChange={(e) => setCheck(e.target.value as CheckKind)}>
                {CHECK_KINDS.map((c) => <option key={c.kind} value={c.kind}>{c.label}</option>)}
              </select>
            </label>
            <label>
              النتيجة
              <select value={ok ? 'ok' : 'warn'} onChange={(e) => setOk(e.target.value === 'ok')}>
                <option value="ok">مكتمل</option>
                <option value="warn">يحتاج استكمالًا</option>
              </select>
            </label>
          </>
        )}
        {kind === 'activity' && (
          <label>
            نوع النشاط
            <select value={activityKind} onChange={(e) => setActivityKind(e.target.value as ActivityKind)}>
              {ACTIVITY_KINDS.map((k) => <option key={k.kind}>{k.kind}</option>)}
            </select>
          </label>
        )}
        {kind === 'duty' && (
          <label>
            الواجب
            <select value={dutyId} onChange={(e) => setDutyId(e.target.value)}>
              <option value="">اختر الواجب</option>
              {DUTY_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {DUTIES.filter((d) => d.group === g).map((d) => <option key={d.id} value={d.id}>{d.id}. {d.short}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <label className="quick-wide">
          {textLabel}
          <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="brief-actions">
        <button type="button" className="brief-primary" disabled={busy} onClick={() => void save()}>حفظ</button>
        <button type="button" className="brief-secondary" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}
