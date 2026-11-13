import { describe, expect, it, vi } from 'vitest';
import { checkShortTest, isReviewRecord, readShortTests } from '../src/short-test-model';

describe('short test specifications', () => {
  it('checks grade 8 and 9 against their published numeric specifications', () => {
    expect(checkShortTest({ grade: '8', items: 9, total: 15, knowledge: 6, application: 6, reasoning: 3, multipleChoice: 3, longAnswer: 0, lessons: 2 })).toEqual([]);
    expect(checkShortTest({ grade: '9', items: 12, total: 15, knowledge: 6, application: 6, reasoning: 3, multipleChoice: 3, longAnswer: 1, lessons: 5 })).toEqual([]);
    expect(checkShortTest({ grade: '9', items: 8, total: 15, knowledge: 6, application: 6, reasoning: 3, multipleChoice: 3, longAnswer: 0, lessons: 1 })).toContain('عدد المفردات يجب أن يكون من 9 إلى 12.');
  });
  it('checks grade 10 independently and reports inconsistency', () => {
    expect(checkShortTest({ grade: '10', items: 5, total: 10, knowledge: 4, application: 4, reasoning: 2, multipleChoice: 2, longAnswer: 1, lessons: 3 })).toEqual([]);
    const issues = checkShortTest({ grade: '10', items: 5, total: 15, knowledge: 4, application: 4, reasoning: 2, multipleChoice: 2, longAnswer: 1, lessons: 3 });
    expect(issues).toContain('الدرجة الكلية المطلوبة هي 10.');
    expect(issues).toContain('مجموع درجات أهداف التقويم لا يساوي الدرجة الكلية المدخلة.');
  });
  it('rejects invalid records when checking backup data', () => {
    expect(isReviewRecord({ id: 'x', title: 'x' })).toBe(false);
  });
  it('refuses to silently discard malformed saved reviews', () => {
    vi.stubGlobal('localStorage', { getItem: () => '[{"id":"incomplete"}]' });
    expect(() => readShortTests()).toThrow();
    vi.unstubAllGlobals();
  });
});
