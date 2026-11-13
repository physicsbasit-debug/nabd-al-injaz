export const SHORT_TEST_KEY = 'nabd-al-injaz:short-tests:v1';
export type Grade = '8' | '9' | '10';
export type ShortTestNumbers = { grade: Grade; items: number; total: number; knowledge: number; application: number; reasoning: number; multipleChoice: number; longAnswer: number; lessons: number };
export type ReviewRecord = ShortTestNumbers & { id: string; teacher: string; subject: string; title: string; status: 'بانتظار المراجعة' | 'يحتاج تعديلًا' | 'تمت المراجعة'; notes: string };
export function checkShortTest(v: ShortTestNumbers): string[] {
  const issues: string[] = [];
  const tenth = v.grade === '10';
  if (v.items < (tenth ? 5 : 9) || v.items > (tenth ? 7 : 12)) issues.push(tenth ? 'عدد المفردات يجب أن يكون من 5 إلى 7.' : 'عدد المفردات يجب أن يكون من 9 إلى 12.');
  if (v.total !== (tenth ? 10 : 15)) issues.push('الدرجة الكلية المطلوبة هي ' + (tenth ? 10 : 15) + '.');
  if (v.knowledge !== (tenth ? 4 : 6) || v.application !== (tenth ? 4 : 6) || v.reasoning !== (tenth ? 2 : 3)) issues.push(tenth ? 'درجات المعرفة والتطبيق والاستدلال المطلوبة: 4، 4، 2.' : 'درجات المعرفة والتطبيق والاستدلال المطلوبة: 6، 6، 3.');
  if (v.knowledge + v.application + v.reasoning !== v.total) issues.push('مجموع درجات أهداف التقويم لا يساوي الدرجة الكلية المدخلة.');
  if (v.multipleChoice !== (tenth ? 2 : 3)) issues.push('عدد مفردات الاختيار من متعدد المطلوب: ' + (tenth ? 2 : 3) + '.');
  if (v.grade === '8' && v.longAnswer !== 0) issues.push('مفردات الصف الثامن بعد الاختيار من متعدد تكون قصيرة الإجابة.');
  if ((v.grade === '9' || tenth) && v.longAnswer !== 1) issues.push('المطلوب مفردة واحدة ذات إجابة طويلة.');
  if (v.multipleChoice + v.longAnswer > v.items) issues.push('عدد المفردات حسب النوع أكبر من العدد الكلي.');
  if (v.lessons < 2 || v.lessons > 5) issues.push('يغطي الاختبار من درسين إلى خمسة دروس.');
  return issues;
}
export function isReviewRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== 'object') return false;
  const x = value as Record<string, unknown>;
  return ['id', 'teacher', 'subject', 'title', 'notes'].every((k) => typeof x[k] === 'string') &&
    ['8', '9', '10'].includes(String(x.grade)) &&
    ['بانتظار المراجعة', 'يحتاج تعديلًا', 'تمت المراجعة'].includes(String(x.status)) &&
    ['items', 'total', 'knowledge', 'application', 'reasoning', 'multipleChoice', 'longAnswer', 'lessons'].every((k) => Number.isInteger(x[k]) && Number(x[k]) >= 0 && Number(x[k]) <= 1000);
}
export function readShortTests(): ReviewRecord[] {
  const raw: unknown = JSON.parse(localStorage.getItem(SHORT_TEST_KEY) || '[]');
  if (!Array.isArray(raw) || !raw.every(isReviewRecord)) throw new Error('تعذر قراءة سجلات المراجعة؛ لم تُغيّر البيانات.');
  return raw;
}
