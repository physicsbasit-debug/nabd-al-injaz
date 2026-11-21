import { describe, expect, it } from 'vitest';
import { suggestEvidence } from '../src/evidence-suggestions';
describe('اقتراح الشواهد', () => {
  it('يقترح شواهد اجتماع بناء على عنوان العمل', () => {
    expect(suggestEvidence('task', 'اجتماع مع المعلمين')).toContain('محضر الاجتماع أو القرارات');
  });
  it('يقترح للزيارة توثيق المتابعة دون تقييم المعلم', () => {
    const suggestions = suggestEvidence('visit', 'زيارة صفية');
    expect(suggestions).toContain('سجل الزيارة أو مذكرة المتابعة');
    expect(suggestions.join(' ')).not.toContain('تقييم المعلم');
  });
  it('يميز توثيق الاحتياط من مهام الاختبارات', () => {
    expect(suggestEvidence('cover', '')).toContain('جدول الاحتياط والتكليفات المنفذة');
    expect(suggestEvidence('assessment', '')).toContain('سجل مراجعة الاختبار أو التسليم');
  });
  it('يقدم خيارات عامة حين لا يتعرف على عنوان العمل', () => {
    expect(suggestEvidence('activity', 'عمل آخر').length).toBeGreaterThan(0);
  });
});
