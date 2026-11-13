export const ASSESSMENT_KEY = 'nabd-al-injaz:assessment-tracking:v1';
export const SUBJECTS = ['علوم عامة', 'فيزياء', 'كيمياء', 'أحياء'] as const;
export type AssessmentRecord = { id:string; teacher:string; subject:string; title:string; grade:string; submitted:boolean; analyzed:boolean; notes:string };
export function isAssessmentRecord(x: unknown): x is AssessmentRecord {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return ['id', 'teacher', 'title'].every(k => typeof r[k] === 'string' && !!String(r[k]).trim()) &&
    typeof r.notes === 'string' && SUBJECTS.includes(r.subject as typeof SUBJECTS[number]) &&
    ['8','9','10'].includes(String(r.grade)) && typeof r.submitted === 'boolean' && typeof r.analyzed === 'boolean';
}
export function summarizeAssessments(records: AssessmentRecord[]) {
  const submitted = records.filter(r=>r.submitted).length, analyzed = records.filter(r=>r.analyzed).length;
  return {total:records.length, submitted, analyzed, pendingSubmission:records.length-submitted, pendingAnalysis:records.length-analyzed};
}
export function readAssessments(): AssessmentRecord[] {
  const stored = localStorage.getItem(ASSESSMENT_KEY);
  if (!stored) return [];
  const value: unknown = JSON.parse(stored);
  if (!Array.isArray(value) || !value.every(isAssessmentRecord)) throw new Error('تعذر قراءة سجلات متابعة الاختبارات؛ لم تُغيّر البيانات.');
  return value;
}
