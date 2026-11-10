import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  RotateCcw,
  Users,
} from 'lucide-react';
import { previewScheduleExcel, type SchedulePreview } from './schedule-import';
import {
  addLesson,
  DAYS,
  EMPTY_SCHEDULE,
  freeTeachers,
  verifiedFreeTeachers,
  isDayVerified,
  setDayVerification,
  mergeScheduleBatch,
  removeLesson,
  normalizeTeacher,
  readSchedule,
  SCHEDULE_STORAGE_KEY,
  type Day,
  type Schedule,
} from './schedule-model';
import './schedule-manager.css';
import CoverDraftPanel from './CoverDraftPanel';

function currentSchoolDay(): Day {
  const weekday = new Date().getDay();
  return weekday <= 4 ? DAYS[weekday] : 'الأحد';
}

const PERIOD_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];

function lessonTone(description: string): number {
  let hash = 0;
  for (const character of description) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 6) + 1;
}

function lessonDisplay(description: string): {
  subject: string;
  className: string;
  classCode: string;
} {
  const subjectMatch = description.match(
    /(العلوم العامة|الفيزياء|الكيمياء|الأحياء|العلوم|علوم عامة|فيزياء|كيمياء|أحياء|علوم)/u,
  );
  const cleaned = (subjectMatch ? description.replace(subjectMatch[0], '') : description)
    .replace(/^[\s\-–—|:،/]+|[\s\-–—|:،/]+$/g, '')
    .replace(/\s+/g, ' ');
  const gradeMatch = cleaned.match(
    /(الثامن|التاسع|العاشر|10|9|8)\s*(?:أساسي)?\s*[/ -]\s*([0-9٠-٩]+)/u,
  );
  const gradeCode = gradeMatch
    ? ({ الثامن: '8', التاسع: '9', العاشر: '10' }[gradeMatch[1]] ?? gradeMatch[1])
    : '';
  return {
    subject: subjectMatch?.[0] ?? '',
    className: cleaned || 'غير محدد',
    classCode: gradeMatch ? `${gradeCode}-${gradeMatch[2]}` : '',
  };
}

export default function ScheduleManager() {
  const [schedule, setSchedule] = useState<Schedule>(readSchedule);
  const [teacherName, setTeacherName] = useState('');
  const [lessonTeacher, setLessonTeacher] = useState('');
  const [lessonDay, setLessonDay] = useState<Day>(currentSchoolDay);
  const [lessonPeriod, setLessonPeriod] = useState(1);
  const [availabilityPeriod, setAvailabilityPeriod] = useState(1);
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [wideConfirmed, setWideConfirmed] = useState(false);
  const [verificationTeacher, setVerificationTeacher] = useState('');
  const [lookupTeacher, setLookupTeacher] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState<Day>(currentSchoolDay);
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  }, [schedule]);

  const busyTeachers = schedule.lessons
    .filter((lesson) => lesson.day === availabilityDay && lesson.period === availabilityPeriod)
    .map((lesson) => lesson.teacher);
  const provisionalFree = freeTeachers(schedule, availabilityDay, availabilityPeriod);
  const confirmedFree = verifiedFreeTeachers(schedule, availabilityDay, availabilityPeriod);
  const unverifiedFree = provisionalFree.filter((name) => !confirmedFree.includes(name));
  const teacherLessons = schedule.lessons.filter((lesson) => lesson.teacher === lookupTeacher);
  const visiblePeriods = Array.from(
    { length: Math.max(7, ...teacherLessons.map((lesson) => lesson.period)) },
    (_, index) => index + 1,
  );

  const addTeacher = (event: FormEvent) => {
    event.preventDefault();
    const name = normalizeTeacher(teacherName);
    if (!name) {
      setMessage('أدخل اسم المعلم.');
      return;
    }
    if (schedule.teachers.includes(name)) {
      setMessage('المعلم موجود بالفعل.');
      return;
    }
    setSchedule((current) => ({ ...current, teachers: [...current.teachers, name] }));
    setLessonTeacher(name);
    setLookupTeacher(name);
    setTeacherName('');
    setMessage('تمت إضافة المعلم.');
  };

  const saveLesson = (event: FormEvent) => {
    event.preventDefault();
    try {
      const updated = addLesson(schedule, {
        teacher: lessonTeacher,
        day: lessonDay,
        period: lessonPeriod,
        description,
      });
      setSchedule(updated);
      setDescription('');
      setMessage('تم تسجيل الحصة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر حفظ الحصة.');
    }
  };

  const importFile = async (file?: File) => {
    setPreview(null);
    setWideConfirmed(false);
    setMessage('');
    setSelectedFileName(file?.name ?? '');
    if (!file) return;
    setBusy(true);
    try {
      const result = await previewScheduleExcel(file);
      setPreview(result);
      if (result.errors.length) setMessage('توجد صفوف غير صالحة؛ لن تُعتمد بيانات جزئية.');
      else setMessage('وصل الملف وقُرئ بنجاح. راجع المعاينة قبل الاعتماد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّرت قراءة الملف.');
    } finally {
      setBusy(false);
    }
  };

  const clearSchedule = () => {
    if (!schedule.teachers.length && !schedule.lessons.length) return;
    const confirmed = window.confirm(
      'سيُحذف جدول المعلمين الحالي بالكامل، بما فيه الحصص وتأكيدات اكتمال الأيام. ستبقى مسودات الاحتياط محفوظة، لكن ستُراجع صلاحيتها مقابل الجدول الجديد. هل تريد المتابعة؟',
    );
    if (!confirmed) return;
    setSchedule(EMPTY_SCHEDULE);
    setPreview(null);
    setWideConfirmed(false);
    setSelectedFileName('');
    setMessage('تم حذف الجدول الحالي. يمكنك الآن اختيار ملف الجدول الجديد.');
  };

  const approve = () => {
    if (
      !preview ||
      preview.errors.length ||
      (preview.format === 'wide' && !wideConfirmed) ||
      (!preview.rows.length && !preview.verifiedDays.length)
    )
      return;
    try {
      const updated = mergeScheduleBatch(schedule, preview);
      setSchedule(updated);
      setPreview(null);
      setSelectedFileName('');
      setMessage(
        'تم اعتماد ' +
          preview.rows.length +
          ' حصة و' +
          preview.verifiedDays.length +
          ' يومًا موثق الاكتمال، دون استبدال البيانات السابقة.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعارض مع جدول موجود؛ لم يُعتمد أي صف.');
    }
  };

  return (
    <section className="schedule-manager" aria-label="إدارة جداول المعلمين">
      <header className="schedule-dashboard-header">
        <div>
          <span className="schedule-eyebrow">تشغيل اليوم</span>
          <h2>الجداول والاحتياط</h2>
          <p>غياب، جدول المعلم، والمتفرغون؛ كل مهمة في مكانها.</p>
        </div>
        <div className="schedule-overview" aria-label="ملخص بيانات الجدول">
          <span>
            <Users size={17} aria-hidden="true" /> {schedule.teachers.length} معلم
          </span>
          <span>
            <CalendarDays size={17} aria-hidden="true" /> {schedule.lessons.length} حصة مسجلة
          </span>
        </div>
      </header>

      <CoverDraftPanel schedule={schedule} />

      <div className="schedule-quick-grid">
        <section className="card schedule-lookup" aria-label="عرض جدول المعلم">
          <div className="schedule-week-titlebar">
            <span>مدرسة الباسط للتعليم الأساسي (8–10)</span>
            <h3>{lookupTeacher || 'الجدول الأسبوعي للمعلم'}</h3>
          </div>
          <div className="schedule-query">
            <label>
              المعلم
              <select
                aria-label="معلم الجدول"
                value={lookupTeacher}
                onChange={(event) => setLookupTeacher(event.target.value)}
              >
                <option value="">اختر المعلم</option>
                {schedule.teachers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          {!lookupTeacher ? (
            <p className="schedule-empty-hint">اختر اسم المعلم لعرض جدوله الأسبوعي كاملًا.</p>
          ) : (
            <>
              <p className="schedule-grid-hint">الأحد إلى الخميس</p>
              <div className="schedule-table-wrap schedule-week-wrap">
                <table
                  className="schedule-week-grid"
                  aria-label={`الجدول الأسبوعي للمعلم ${lookupTeacher}`}
                >
                  <thead>
                    <tr>
                      <th className="schedule-week-day-heading" scope="col">
                        اليوم
                      </th>
                      {visiblePeriods.map((period) => (
                        <th key={period} scope="col" aria-label={`الحصة ${period}`}>
                          {PERIOD_NAMES[period - 1] ?? `الحصة ${period}`}
                          <small>الحصة {period}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day}>
                        <th scope="row" className="schedule-week-day">
                          {day}
                        </th>
                        {visiblePeriods.map((period) => {
                          const lesson = teacherLessons.find(
                            (item) => item.day === day && item.period === period,
                          );
                          if (!lesson) {
                            return (
                              <td
                                key={period}
                                className="schedule-week-empty"
                                aria-label={`${day}، الحصة ${period}، لا توجد حصة مسجلة`}
                              />
                            );
                          }
                          const display = lessonDisplay(lesson.description || 'غير محدد');
                          return (
                            <td
                              key={period}
                              className={`schedule-week-lesson schedule-tone-${lessonTone(lesson.description)}`}
                            >
                              <div className="schedule-week-lesson-content">
                                {display.subject && (
                                  <small className="schedule-week-subject">{display.subject}</small>
                                )}
                                {display.classCode && (
                                  <small className="schedule-week-class-code">
                                    {display.classCode}
                                  </small>
                                )}
                                <strong>{display.className}</strong>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="card schedule-availability" aria-label="المتفرغون حسب الحصة">
          <div className="schedule-card-heading">
            <div>
              <span className="schedule-eyebrow">بحث سريع</span>
              <h3>من المتفرغ في هذه الحصة؟</h3>
            </div>
            <Clock3 size={21} aria-hidden="true" />
          </div>
          <div className="schedule-query">
            <label>
              اليوم
              <select
                aria-label="يوم التوفر"
                value={availabilityDay}
                onChange={(event) => setAvailabilityDay(event.target.value as Day)}
              >
                {DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>
            <label>
              الحصة
              <input
                aria-label="حصة التوفر"
                type="number"
                min="1"
                max="12"
                value={availabilityPeriod}
                onChange={(event) => setAvailabilityPeriod(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="schedule-availability-summary">
            متفرغون مؤكّدون: {confirmedFree.length} من {schedule.teachers.length}
          </p>
          {confirmedFree.length > 0 ? (
            <div className="schedule-teacher-tags confirmed" aria-label="متفرغون مؤكدون">
              {confirmedFree.map((name) => (
                <span key={name}>
                  <CheckCircle2 size={14} />
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="schedule-empty-hint">لا يوجد متفرغ مؤكد في هذه الحصة.</p>
          )}
          {unverifiedFree.length > 0 && (
            <div className="schedule-unverified-note">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                لم يُتحقق من اكتمال جدول: {unverifiedFree.join('، ')}. لا يمكن تأكيد تفرغهم.
              </span>
            </div>
          )}
          {busyTeachers.length > 0 && (
            <p className="schedule-busy-note">على رأس حصة: {busyTeachers.join('، ')}.</p>
          )}
        </section>
      </div>

      <details className="schedule-settings">
        <summary>
          <span>إعداد وتعديل الجدول</span>
          <small>
            {schedule.teachers.length} معلم · {schedule.lessons.length} حصة
          </small>
        </summary>
        <div className="schedule-settings-content">
          <section className="card">
            <h3>قائمة المعلمين</h3>
            <form onSubmit={addTeacher} className="schedule-inline-form">
              <label>
                اسم المعلم
                <input
                  value={teacherName}
                  onChange={(event) => setTeacherName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <button type="submit">إضافة معلم</button>
            </form>
            {schedule.teachers.length > 0 && (
              <div className="schedule-teacher-tags">
                {schedule.teachers.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>استيراد جدول Excel</h3>
            <p>
              ارفع ملف XLSX من تطبيق «الملفات» أو iCloud Drive. نعرض المعاينة والأخطاء قبل اعتماد أي
              بيانات.
            </p>
            {schedule.teachers.length > 0 || schedule.lessons.length > 0 ? (
              <button
                type="button"
                className="schedule-reset-button"
                onClick={clearSchedule}
                disabled={busy}
              >
                <RotateCcw size={17} aria-hidden="true" />
                حذف الجدول الحالي لإتاحة استيراد جديد
              </button>
            ) : null}
            <label className="schedule-file-picker">
              <FileSpreadsheet size={20} aria-hidden="true" />
              <span>{busy ? 'جارٍ قراءة الملف…' : 'اختيار ملف Excel'}</span>
              <input
                aria-label="ملف جدول المعلمين"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void importFile(file);
                  event.target.value = '';
                }}
              />
            </label>
            {selectedFileName && (
              <p className="schedule-selected-file" role="status">
                الملف المحدد: <strong>{selectedFileName}</strong>
              </p>
            )}
            {preview && (
              <div className="schedule-preview">
                <h4>معاينة: {preview.sheet}</h4>
                <p>
                  نوع القالب: {preview.format === 'wide' ? 'جدول حصص أفقي' : 'قائمة حصص'}، صفوف
                  المعلمين: {preview.totalRows}، حصص صالحة: {preview.rows.length}، أيام قابلة
                  للتوثيق: {preview.verifiedDays.length}، أخطاء: {preview.errors.length}
                </p>
                {preview.errors.length > 0 && (
                  <ul>
                    {preview.errors.slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
                <div className="schedule-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>المعلم</th>
                        <th>اليوم</th>
                        <th>الحصة</th>
                        <th>المادة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 15).map((row, index) => (
                        <tr key={index}>
                          <td>{row.teacher}</td>
                          <td>{row.day}</td>
                          <td>{row.period}</td>
                          <td>{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.format === 'wide' && (
                  <label className="schedule-confirm">
                    <input
                      type="checkbox"
                      checked={wideConfirmed}
                      onChange={(event) => setWideConfirmed(event.target.checked)}
                    />
                    أؤكد أن صفوف الأيام كاملة، وأن خلايا الحصص الفارغة تعني فراغًا فعليًا، وليست
                    بيانات ناقصة.
                  </label>
                )}
                <button
                  type="button"
                  disabled={
                    !!preview.errors.length ||
                    (preview.format === 'wide' && !wideConfirmed) ||
                    (!preview.rows.length && !preview.verifiedDays.length)
                  }
                  onClick={approve}
                >
                  اعتماد الجدول ({preview.rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFileName('');
                  }}
                >
                  إلغاء المعاينة
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h3>إضافة حصة يدويًا</h3>
            <form onSubmit={saveLesson} className="schedule-fields">
              <label>
                المعلم
                <select
                  aria-label="معلم الحصة"
                  value={lessonTeacher}
                  onChange={(event) => setLessonTeacher(event.target.value)}
                  required
                >
                  <option value="">اختر المعلم</option>
                  {schedule.teachers.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                اليوم
                <select
                  aria-label="يوم الحصة"
                  value={lessonDay}
                  onChange={(event) => setLessonDay(event.target.value as Day)}
                >
                  {DAYS.map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label>
                رقم الحصة
                <input
                  aria-label="رقم الحصة"
                  type="number"
                  min="1"
                  max="12"
                  value={lessonPeriod}
                  onChange={(event) => setLessonPeriod(Number(event.target.value))}
                  required
                />
              </label>
              <label>
                المادة أو الصف
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={150}
                />
              </label>
              <button type="submit">حفظ الحصة</button>
            </form>
          </section>

          <section className="card">
            <h3>توثيق اكتمال يوم معلم</h3>
            <p>
              لا يُحتسب المعلم متفرغًا بشكل موثوق حتى تأكيد اكتمال حصص يومه. تعديل حصصه يلغي التوثيق
              تلقائيًا.
            </p>
            <div className="schedule-query">
              <label>
                المعلم
                <select
                  aria-label="معلم التحقق"
                  value={verificationTeacher}
                  onChange={(event) => setVerificationTeacher(event.target.value)}
                >
                  <option value="">اختر المعلم</option>
                  {schedule.teachers.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                اليوم
                <select
                  aria-label="يوم التحقق"
                  value={lessonDay}
                  onChange={(event) => setLessonDay(event.target.value as Day)}
                >
                  {DAYS.map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!verificationTeacher}
                onClick={() => {
                  if (!verificationTeacher) return;
                  const alreadyVerified = isDayVerified(schedule, verificationTeacher, lessonDay);
                  if (
                    !alreadyVerified &&
                    !window.confirm(
                      'هل تحققت من اكتمال حصص هذا المعلم لهذا اليوم، بما فيها حصص الفراغ؟',
                    )
                  )
                    return;
                  setSchedule((current) =>
                    setDayVerification(current, verificationTeacher, lessonDay, !alreadyVerified),
                  );
                  setMessage(
                    alreadyVerified ? 'أُلغي توثيق اكتمال اليوم.' : 'تم توثيق اكتمال يوم المعلم.',
                  );
                }}
              >
                {verificationTeacher && isDayVerified(schedule, verificationTeacher, lessonDay)
                  ? 'إلغاء التوثيق'
                  : 'تأكيد اكتمال اليوم'}
              </button>
            </div>
          </section>

          <section className="card">
            <h3>الحصص المسجلة ({schedule.lessons.length})</h3>
            {schedule.lessons.length === 0 ? (
              <p>لا توجد حصص مسجلة بعد. ارفع جدول Excel أو أضف الحصص يدويًا.</p>
            ) : (
              <div className="schedule-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>المعلم</th>
                      <th>اليوم</th>
                      <th>الحصة</th>
                      <th>المادة</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td>{lesson.teacher}</td>
                        <td>{lesson.day}</td>
                        <td>{lesson.period}</td>
                        <td>{lesson.description}</td>
                        <td>
                          <button
                            type="button"
                            aria-label={
                              'حذف حصة ' + lesson.teacher + ' ' + lesson.day + ' ' + lesson.period
                            }
                            onClick={() => {
                              if (window.confirm('حذف هذه الحصة من الجدول؟'))
                                setSchedule((current) => removeLesson(current, lesson.id));
                            }}
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </details>
      {message && (
        <p className="schedule-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
