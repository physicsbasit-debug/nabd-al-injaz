import { describe, expect, it } from 'vitest';
import { proposePlanDestination } from '../src/plan-routing';
describe('plan destination suggestions', () => {
  it('suggests a destination for explicit teacher training and supervision activities', () => {
    expect(proposePlanDestination('مشغل تدريب المعلمين على التقويم')).toBe('الإنماء المهني');
    expect(proposePlanDestination('زيارة إشرافية لمعلم العلوم')).toBe('الزيارات الإشرافية');
    expect(proposePlanDestination('الزيارات المتبادلة بين المعلمين')).toBe('الزيارات المتبادلة');
  });
  it('leaves ambiguous and unknown activities for human review', () => {
    expect(proposePlanDestination('متابعة الأعمال')).toBeNull();
    expect(proposePlanDestination('اجتماع دوري ومشغل للمعلمين')).toBeNull();
  });
});
