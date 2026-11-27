import { checkTeacherName } from './teacher-names';

/** تنبيه صغير تحت حقل اسم المعلم: يقترح الاسم كما في الجداول أو ينبه إلى أنه جديد. */
export default function TeacherNameHint({ name, roster, onPick }: { name: string; roster: string[]; onPick: (name: string) => void }) {
  const check = checkTeacherName(name, roster);
  if (check.status === 'suggest')
    return (
      <small className="teacher-name-hint">
        هل تقصد <button type="button" className="teacher-link" onClick={() => onPick(check.suggestion)}>{check.suggestion}</button>؟ توحيد الاسم يجمع سجلاته في ملف واحد.
      </small>
    );
  if (check.status === 'unknown') return <small className="teacher-name-hint">الاسم غير موجود في الجداول؛ سيظهر له ملف مستقل.</small>;
  return null;
}
