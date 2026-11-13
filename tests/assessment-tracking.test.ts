import { describe, expect, it } from 'vitest';
import { isAssessmentRecord, summarizeAssessments } from '../src/assessment-tracking';
describe('assessment follow-up', () => {
  const records = [
    {id:'a', teacher:'معلم 1', subject:'فيزياء', title:'اختبار 1', grade:'9', submitted:false, analyzed:true, notes:''},
    {id:'b', teacher:'معلم 2', subject:'كيمياء', title:'اختبار 2', grade:'10', submitted:true, analyzed:false, notes:''},
  ];
  it('separates test hand-in from analysis and filters by specialization', () => {
    expect(summarizeAssessments(records)).toEqual({ total:2, submitted:1, analyzed:1, pendingSubmission:1, pendingAnalysis:1 });
    expect(summarizeAssessments(records.filter(r => r.subject === 'فيزياء')).submitted).toBe(0);
  });
  it('rejects unknown specialization or non-boolean status', () => {
    expect(isAssessmentRecord({...records[0], subject:'غير معروفة'})).toBe(false);
    expect(isAssessmentRecord({...records[0], submitted:'نعم'})).toBe(false);
  });
});
