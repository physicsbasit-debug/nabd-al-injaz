import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Printer, Search, UserRound } from 'lucide-react';
import type { Plan } from './plan-model';
import { localDateKey } from './dashboard-metrics';
import { readSchedule } from './schedule-model';
import { readSupervisoryVisits } from './supervisory-visits-model';
import { readProfessionalPrograms } from './professional-development-model';
import { readTechnicalTopics } from './technical-followup-model';
import { readAssessments } from './assessment-tracking';
import { readShortTests } from './short-test-model';
import { readCoverStore } from './cover-planning';
import { semesterOf } from './duty-routine';
import {
  CHECK_KINDS,
  buildTeacherProfiles,
  emptyTeacherStore,
  readTeacherStore,
  recordCheck,
  removeCheck,
  setTeacherNote,
  writeTeacherStore,
  type CheckKind,
  type TeacherProfile,
} from './teacher-profile-model';
import './teacher-profiles.css';

type Props = { plans: Plan[]; onNavigate: (section: string) => void };

function safe<T>(read: () => T, fallback: T, label: string, errors: string[]): T {
  try {
    return read();
  } catch {
    errors.push(label);
    return fallback;
  }
}

const formatDay = (day: string) =>
  new Intl.DateTimeFormat('ar-OM', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));

export default function TeacherProfiles({ plans, onNavigate }: Props) {
  const today = localDateKey(new Date());
  const errors: string[] = [];
  const [store, setStore] = useState(() => {
    try {
      return readTeacherStore();
    } catch {
      return emptyTeacherStore();
    }
  });
  const [storeBroken] = useState(() => {
    try {
      readTeacherStore();
      return false;
    } catch {
      return true;
    }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const save = (next: typeof store) => {
    if (storeBroken) return;
    setStore(next);
    writeTeacherStore(next);
  };

  const profiles = buildTeacherProfiles({
    today,
    store,
    plans,
    scheduleTeachers: safe(() => readSchedule().teachers, [], 'الجداول', errors),
    visits: safe(readSupervisoryVisits, [], 'الزيارات الإشرافية', errors),
    programs: safe(readProfessionalPrograms, [], 'برامج الإنماء المهني', errors),
    topics: safe(readTechnicalTopics, [], 'المتابعة الفنية', errors),
    assessments: safe(readAssessments, [], 'سجلات الاختبارات', errors),
    reviews: safe(readShortTests, [], 'مراجعة الاختبارات القصيرة', errors),
    cover: safe(readCoverStore, undefined, 'سجلات الاحتياط', errors),
  });
  const profile = profiles.find((p) => p.name === selected) ?? null;
  const q = query.trim();
  const visible = useMemo(() => profiles.filter((p) => !q || p.name.includes(q)), [profiles, q]);
  const needAttention = profiles.filter((p) => p.alerts.length).length;
  const semester = semesterOf(today);

  const errorBox = (
    <>
      {errors.length > 0 && <p role="alert">تعذرت قراءة: {[...new Set(errors)].join('، ')}. عُرض الباقي دون تغيير البيانات.</p>}
      {storeBroken && <p role="alert">بيانات ملفات المعلمين تالفة؛ عُطّل الحفظ حتى لا تُستبدل. استعد نسخة احتياطية.</p>}
    </>
  );

  if (profile) return <ProfileDetail profile={profile} today={today} semesterLabel={semester.label} errorBox={errorBox} onBack={() => setSelected(null)} onNavigate={onNavigate}
    readOnly={storeBroken}
    noteDraft={notes[profile.name] ?? profile.note}
    onNoteChange={(value) => setNotes((old) => ({ ...old, [profile.name]: value }))}
    onNoteSave={() => notes[profile.name] !== undefined && save(setTeacherNote(store, profile.name, notes[profile.name]))}
    onCheck={(kind, ok, note) => save(recordCheck(store, profile.name, kind, ok, note, today))}
    onRemoveCheck={(id) => save(removeCheck(store, id))} />;

  return (
    <section className="card teacher-profiles" aria-label="ملفات المعلمين">
      <h2>معلمو القسم</h2>
      <p className="teacher-lead">
        ملف لكل معلم يجمع زياراته وأولويات تطويره وحضوره للإنماء ومنهجه واختباراته من الأقسام، مع فحوص الشهر.
        {profiles.length > 0 && <> يحتاج <b>{needAttention}</b> من {profiles.length} معلمين إلى متابعة.</>}
      </p>
      {errorBox}
      {profiles.length === 0 ? (
        <div className="teacher-empty">
          <UserRound size={28} aria-hidden="true" />
          <p>لا يوجد معلمون بعد. تُنشأ الملفات تلقائيًا من الجداول أو الزيارات أو برامج الإنماء.</p>
          <button type="button" className="brief-secondary" onClick={() => onNavigate('الجداول والاحتياط')}>استيراد الجداول</button>
        </div>
      ) : (
        <>
          <label className="teacher-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="بحث عن معلم" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المعلم" />
          </label>
          <ul className="teacher-grid">
            {visible.map((p) => (
              <li key={p.name}>
                <button type="button" className={'teacher-card' + (p.alerts.length ? ' teacher-card-alert' : '')} onClick={() => setSelected(p.name)} aria-label={`فتح ملف ${p.name}`}>
                  <span className="teacher-card-name"><strong>{p.name}</strong>{p.alerts.length > 0 && <span className="teacher-badge">{p.alerts.length} تنبيه</span>}</span>
                  <span className="teacher-card-stats">
                    <span>زيارات الفصل <b>{p.visits.semesterCount}</b></span>
                    <span>آخر زيارة <b>{p.visits.daysSince === null ? '—' : p.visits.daysSince === 0 ? 'اليوم' : `قبل ${p.visits.daysSince} يومًا`}</b></span>
                    <span>المنهج <b>{p.curriculum.planned ? Math.round((p.curriculum.taught / p.curriculum.planned) * 100) + '٪' : '—'}</b></span>
                  </span>
                  <span className="teacher-card-checks" aria-label="فحوص هذا الشهر">
                    {CHECK_KINDS.map(({ kind, short, label }) => {
                      const c = p.checks[kind];
                      return <span key={kind} className={c ? (c.ok ? 'chk ok' : 'chk warn') : 'chk'} title={label}>{short} {c ? (c.ok ? '✓' : '!') : '·'}</span>;
                    })}
                  </span>
                  {p.alerts[0] && <span className="teacher-card-alertline"><AlertTriangle size={14} aria-hidden="true" /> {p.alerts[0]}</span>}
                </button>
              </li>
            ))}
          </ul>
          {!visible.length && <p className="brief-empty">لا يوجد معلم بهذا الاسم.</p>}
        </>
      )}
    </section>
  );
}

type DetailProps = {
  profile: TeacherProfile;
  today: string;
  semesterLabel: string;
  errorBox: React.ReactNode;
  readOnly: boolean;
  noteDraft: string;
  onBack: () => void;
  onNavigate: (section: string) => void;
  onNoteChange: (value: string) => void;
  onNoteSave: () => void;
  onCheck: (kind: CheckKind, ok: boolean, note: string) => void;
  onRemoveCheck: (id: string) => void;
};

function ProfileDetail({ profile: p, today, semesterLabel, errorBox, readOnly, noteDraft, onBack, onNavigate, onNoteChange, onNoteSave, onCheck, onRemoveCheck }: DetailProps) {
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  const tiles = [
    { label: `زيارات ${semesterLabel}`, value: p.visits.semesterCount },
    { label: 'زيارات مخططة', value: p.visits.planned.length },
    { label: 'حضور الإنماء', value: `${p.development.attended.length}/${p.development.attended.length + p.development.absent.length}` },
    { label: 'تقدم المنهج', value: p.curriculum.planned ? Math.round((p.curriculum.taught / p.curriculum.planned) * 100) + '٪' : '—' },
    { label: 'حصص احتياط غطاها', value: p.cover.given },
    { label: 'أيام غياب', value: p.cover.absences },
  ];
  return (
    <section className="card teacher-profiles teacher-detail" aria-label={`ملف ${p.name}`}>
      <div className="teacher-detail-bar no-print">
        <button type="button" className="brief-secondary" onClick={onBack}><ArrowRight size={16} aria-hidden="true" /> كل المعلمين</button>
        <button type="button" className="brief-secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> طباعة الملف</button>
      </div>
      <h2>{p.name}</h2>
      <p className="teacher-lead">ملف متابعة حتى {formatDay(today)}{p.inSchedule ? '' : ' · غير مسجل في الجداول'}. يصلح أساسًا لتقرير تقويم الأداء الوظيفي (الواجب 28).</p>
      {errorBox}
      <div className="teacher-tiles">{tiles.map((t) => <div key={t.label}><b>{t.value}</b><span>{t.label}</span></div>)}</div>

      <h3>ما يحتاج متابعة</h3>
      {p.alerts.length ? <ul className="teacher-alerts">{p.alerts.map((a) => <li key={a}><AlertTriangle size={16} aria-hidden="true" /> {a}</li>)}</ul> : <p className="teacher-ok"><CheckCircle2 size={16} aria-hidden="true" /> لا توجد تنبيهات.</p>}

      <h3>فحوص هذا الشهر</h3>
      <p className="teacher-hint no-print">كل فحص يُحتسب في روتين الواجبات تلقائيًا: السجلات (30)، الدرجات (24)، التحضير (5).</p>
      <ul className="teacher-checks">
        {CHECK_KINDS.map(({ kind, label, duty }) => {
          const c = p.checks[kind];
          return (
            <li key={kind} className={c ? (c.ok ? 'ok' : 'warn') : ''}>
              <div>
                <strong>{label}</strong>
                <small>{c ? `${c.ok ? 'مكتمل' : 'يحتاج استكمالًا'} · ${formatDay(c.date)}${c.note ? ' · ' + c.note : ''}` : `لم يُفحص هذا الشهر · الواجب ${duty}`}</small>
              </div>
              {!readOnly && (
                <div className="teacher-check-actions no-print">
                  <input aria-label={`ملاحظة ${label}`} placeholder="ملاحظة اختيارية" maxLength={300} value={checkNotes[kind] ?? ''} onChange={(e) => setCheckNotes((o) => ({ ...o, [kind]: e.target.value }))} />
                  <button type="button" className="brief-primary" onClick={() => onCheck(kind, true, checkNotes[kind] ?? c?.note ?? '')}>مكتمل</button>
                  <button type="button" className="brief-secondary" onClick={() => onCheck(kind, false, checkNotes[kind] ?? c?.note ?? '')}>يحتاج استكمالًا</button>
                  {c && <button type="button" className="teacher-link" onClick={() => onRemoveCheck(c.id)}>إلغاء</button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h3>الزيارات وأولويات التطوير</h3>
      {p.visits.done.length ? (
        <ol className="teacher-timeline">
          {p.visits.done.map((v) => (
            <li key={v.id}>
              <strong>{formatDay(v.date)} · {[v.subject, v.grade && 'الصف ' + v.grade, v.lesson].filter(Boolean).join(' · ')}</strong>
              {v.strengths && <p><b>القوة:</b> {v.strengths}</p>}
              {v.improvements && <p><b>أولويات التطوير:</b> {v.improvements}</p>}
              {v.recommendations && <p><b>التوصيات:</b> {v.recommendations}</p>}
              {v.followUp && <p><b>المتابعة:</b> {v.followUp}</p>}
            </li>
          ))}
        </ol>
      ) : <p className="brief-empty">لا توجد زيارات منفذة بعد.</p>}
      {p.visits.planned.length > 0 && <p className="teacher-hint">مخطط: {p.visits.planned.map((v) => (v.date ? formatDay(v.date) : 'دون موعد')).join('، ')}</p>}
      <button type="button" className="brief-secondary no-print" onClick={() => onNavigate('الزيارات الإشرافية')}>فتح الزيارات الإشرافية</button>

      <h3>الإنماء المهني والتعاون</h3>
      <p>حضر: {p.development.attended.length ? p.development.attended.join('، ') : '—'}</p>
      {p.development.absent.length > 0 && <p>غاب عن: {p.development.absent.join('، ')}</p>}
      <p>زيارات متبادلة منفذة: {p.mutualVisits}</p>

      <h3>المنهج والاختبارات</h3>
      <p>الحصص المنفذة: {p.curriculum.taught} من {p.curriculum.planned}{p.curriculum.behind.length ? ` · متأخر في: ${p.curriculum.behind.map((t) => t.title).join('، ')}` : ''}</p>
      <p>مراجعة الاختبارات القصيرة: {p.reviews.done} تمت، {p.reviews.needsEdit} تحتاج تعديلًا، {p.reviews.pending} بانتظار المراجعة</p>
      <p>الاختبارات والتحصيل: {p.assessments.total} سجلًا، {p.assessments.pendingSubmission} لم تُسلَّم، {p.assessments.pendingAnalysis} لم تُحلَّل</p>

      <h3>ملاحظات المعلم الأول</h3>
      <textarea className="teacher-note" aria-label={`ملاحظات عن ${p.name}`} rows={4} maxLength={2000} readOnly={readOnly} value={noteDraft} onChange={(e) => onNoteChange(e.target.value)} onBlur={onNoteSave} placeholder="نقاط تدعم تقرير الأداء: مبادرات، تحسن ملحوظ، احتياجات تدريبية…" />

      {p.history.length > 0 && (
        <details className="teacher-history">
          <summary>سجل الفحوص السابقة ({p.history.length})</summary>
          <ul>{p.history.map((c) => <li key={c.id}>{formatDay(c.date)} · {CHECK_KINDS.find((k) => k.kind === c.kind)?.label} · {c.ok ? 'مكتمل' : 'يحتاج استكمالًا'}{c.note ? ' · ' + c.note : ''}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
