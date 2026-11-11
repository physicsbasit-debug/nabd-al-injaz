import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { readSchedule } from './schedule-model';
import {
  adjustTaughtLessons,
  readTechnicalTopics,
  removeTechnicalTopic,
  saveTechnicalTopic,
  TECHNICAL_FOLLOWUP_STORAGE_KEY,
  technicalTopicStatus,
  technicalTopicSummary,
  type TechnicalGrade,
  type TechnicalSubject,
  type TechnicalTopic,
} from './technical-followup-model';
import './technical-followup.css';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const subjectOptions: TechnicalSubject[] = ['فيزياء', 'كيمياء', 'أحياء'];
const statusLabels = {
  complete: 'مكتمل',
  overdue: 'متأخر',
  today: 'موعده اليوم',
  upcoming: 'قادم',
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ar-OM', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

type Draft = {
  teacher: string;
  grade: TechnicalGrade;
  subject: TechnicalSubject;
  title: string;
  plannedLessons: string;
  targetDate: string;
};
const blankDraft = (): Draft => ({
  teacher: '',
  grade: '9',
  subject: 'فيزياء',
  title: '',
  plannedLessons: '1',
  targetDate: localToday(),
});

export default function TechnicalFollowup() {
  const [topics, setTopics] = useState<TechnicalTopic[]>(readTechnicalTopics);
  const [teachers] = useState(() => readSchedule().teachers);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const today = localToday();

  useEffect(() => {
    localStorage.setItem(TECHNICAL_FOLLOWUP_STORAGE_KEY, JSON.stringify(topics));
  }, [topics]);

  const summary = useMemo(() => technicalTopicSummary(topics, today), [topics, today]);
  const orderedTopics = useMemo(
    () =>
      [...topics].sort(
        (a, b) => a.targetDate.localeCompare(b.targetDate) || a.title.localeCompare(b.title, 'ar'),
      ),
    [topics],
  );

  const updateDraft = (key: keyof Draft, value: string) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'grade')
        next.subject =
          value === '8'
            ? 'علوم عامة'
            : current.subject === 'علوم عامة'
              ? 'فيزياء'
              : current.subject;
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const next = saveTechnicalTopic(
        topics,
        {
          teacher: draft.teacher,
          grade: draft.grade,
          subject: draft.subject,
          title: draft.title,
          plannedLessons: Number(draft.plannedLessons),
          targetDate: draft.targetDate,
        },
        editingId,
      );
      setTopics(next);
      setDraft(blankDraft());
      setEditingId(undefined);
      setMessage(editingId ? 'تم تحديث المتابعة.' : 'تمت إضافة الموضوع إلى المتابعة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر حفظ البيانات.');
    }
  };

  const editTopic = (topic: TechnicalTopic) => {
    setEditingId(topic.id);
    setDraft({
      teacher: topic.teacher,
      grade: topic.grade,
      subject: topic.subject,
      title: topic.title,
      plannedLessons: String(topic.plannedLessons),
      targetDate: topic.targetDate,
    });
    setMessage('عدّل البيانات ثم احفظ.');
  };

  return (
    <section className="technical-followup" aria-label="المتابعة الفنية للمنهج">
      <div className="technical-heading">
        <div>
          <span className="technical-eyebrow">متابعة المنهج حسب النشرة الفعلية</span>
          <h2>المتابعة الفنية</h2>
          <p>سجّل الموضوع والحصص المخططة وموعد إنجازه، ثم حدّث المنفذ بعد كل درس.</p>
        </div>
      </div>
      <div className="technical-summary" aria-label="ملخص المتابعة الفنية">
        <article>
          <span>مكتمل</span>
          <strong>{summary.complete}</strong>
        </article>
        <article className={summary.overdue ? 'technical-late' : ''}>
          <span>متأخر</span>
          <strong>{summary.overdue}</strong>
        </article>
        <article>
          <span>موعده اليوم</span>
          <strong>{summary.today}</strong>
        </article>
        <article>
          <span>قادم</span>
          <strong>{summary.upcoming}</strong>
        </article>
      </div>

      <form className="technical-form" onSubmit={submit}>
        <div className="technical-form-title">
          <h3>{editingId ? 'تعديل موضوع' : 'إضافة موضوع من النشرة'}</h3>
          <small>لا تُضاف موضوعات تلقائيًا؛ أدخل البيانات كما وردت في نشرتك.</small>
        </div>
        <label>
          المعلم
          <select
            required
            value={draft.teacher}
            onChange={(e) => updateDraft('teacher', e.target.value)}
          >
            <option value="">اختر المعلم</option>
            {teachers.map((teacher) => (
              <option key={teacher} value={teacher}>
                {teacher}
              </option>
            ))}
          </select>
        </label>
        <label>
          الصف
          <select
            value={draft.grade}
            onChange={(e) => updateDraft('grade', e.target.value as TechnicalGrade)}
          >
            <option value="8">الثامن</option>
            <option value="9">التاسع</option>
            <option value="10">العاشر</option>
          </select>
        </label>
        <label>
          المادة
          <select
            value={draft.subject}
            onChange={(e) => updateDraft('subject', e.target.value as TechnicalSubject)}
          >
            {(draft.grade === '8' ? ['علوم عامة'] : subjectOptions).map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </label>
        <label className="technical-topic-field">
          الموضوع / الوحدة
          <input
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => updateDraft('title', e.target.value)}
            placeholder="اكتب الاسم كما ورد في النشرة"
          />
        </label>
        <label>
          الحصص المخططة
          <input
            required
            type="number"
            inputMode="numeric"
            min="1"
            max="60"
            step="1"
            value={draft.plannedLessons}
            onChange={(e) => updateDraft('plannedLessons', e.target.value)}
          />
        </label>
        <label>
          موعد الإنجاز المستهدف
          <input
            required
            type="date"
            value={draft.targetDate}
            onChange={(e) => updateDraft('targetDate', e.target.value)}
          />
        </label>
        <div className="technical-form-actions">
          <button className="primary-action" type="submit">
            {editingId ? <Check size={17} /> : <Plus size={17} />}
            {editingId ? 'حفظ التعديل' : 'إضافة للمتابعة'}
          </button>
          {editingId && (
            <button
              type="button"
              className="technical-cancel"
              onClick={() => {
                setEditingId(undefined);
                setDraft(blankDraft());
                setMessage('');
              }}
            >
              إلغاء التعديل
            </button>
          )}
        </div>
        {message && (
          <p className="technical-message" role="status">
            {message}
          </p>
        )}
      </form>

      <section className="technical-list-section" aria-label="الموضوعات المسجلة">
        <div className="technical-list-heading">
          <div>
            <h3>متابعة الموضوعات</h3>
            <p>{topics.length} موضوع مسجل</p>
          </div>
        </div>
        {teachers.length === 0 ? (
          <div className="technical-empty">
            <BookOpenCheck size={28} />
            <strong>ارفع جدول المعلمين أولًا</strong>
            <p>ستظهر أسماء المعلمين هنا للاختيار، ولن نضيف أسماء غير موجودة في جدولك.</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="technical-empty">
            <BookOpenCheck size={28} />
            <strong>لا توجد موضوعات مسجلة</strong>
            <p>ابدأ بإضافة بيانات النشرة التوجيهية الفعلية أعلاه.</p>
          </div>
        ) : (
          <div className="technical-topic-list">
            {orderedTopics.map((topic) => {
              const status = technicalTopicStatus(topic, today);
              const remaining = topic.plannedLessons - topic.taughtLessons;
              return (
                <article className={`technical-topic-card status-${status}`} key={topic.id}>
                  <div className="technical-topic-main">
                    <div className="technical-topic-title">
                      <span className="technical-status">{statusLabels[status]}</span>
                      <h4>{topic.title}</h4>
                      <p>
                        {topic.teacher} · {topic.grade}/{topic.subject}
                      </p>
                    </div>
                    <div className="technical-topic-date">
                      <CalendarClock size={16} />
                      <span>{formatDate(topic.targetDate)}</span>
                    </div>
                  </div>
                  <div className="technical-progress">
                    <div>
                      <strong>
                        {topic.taughtLessons} من {topic.plannedLessons} حصص
                      </strong>
                      <span>{remaining ? `متبقي ${remaining}` : 'اكتمل التنفيذ'}</span>
                    </div>
                    <div
                      className="technical-progress-track"
                      role="progressbar"
                      aria-label={`إنجاز ${topic.title}`}
                      aria-valuemin={0}
                      aria-valuemax={topic.plannedLessons}
                      aria-valuenow={topic.taughtLessons}
                    >
                      <span
                        style={{
                          width: `${Math.round((100 * topic.taughtLessons) / topic.plannedLessons)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="technical-topic-actions">
                    <button
                      type="button"
                      className="technical-counter technical-decrement"
                      disabled={topic.taughtLessons === 0}
                      aria-label={`التراجع عن حصة منفذة في ${topic.title}`}
                      onClick={() =>
                        setTopics((current) => adjustTaughtLessons(current, topic.id, -1))
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="technical-counter"
                      disabled={!remaining}
                      onClick={() =>
                        setTopics((current) => adjustTaughtLessons(current, topic.id, 1))
                      }
                    >
                      تسجيل حصة منفذة
                    </button>
                    <button
                      type="button"
                      className="technical-icon-action"
                      aria-label={`تعديل ${topic.title}`}
                      onClick={() => editTopic(topic)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      className="technical-icon-action is-delete"
                      aria-label={`حذف ${topic.title}`}
                      onClick={() => {
                        if (window.confirm(`حذف متابعة «${topic.title}»؟`)) {
                          setTopics((current) => removeTechnicalTopic(current, topic.id));
                          if (editingId === topic.id) {
                            setEditingId(undefined);
                            setDraft(blankDraft());
                          }
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="technical-storage-note">
        <AlertTriangle size={15} /> تُحفظ البيانات على هذا الجهاز والمتصفح حاليًا.
      </p>
    </section>
  );
}
