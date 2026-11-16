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

import { approvedActivities } from '../src/plan-import';
import { readPlans } from '../src/plan-model';
import { vi } from 'vitest';
it('preserves the selected destination through approval and reload', () => {
  const items = approvedActivities([{key:'1',source:'صف 1',title:'مشغل للمعلمين',assignee:'',dueDate:'',details:'',destination:'الإنماء المهني'}]);
  expect(items[0].destination).toBe('الإنماء المهني');
  const record = {id:'p',title:'خطة',kind:'خطة الإنماء المهني',owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:'',activities:items};
  vi.stubGlobal('localStorage', {getItem: () => JSON.stringify([record])});
  try { expect(readPlans()[0].activities[0].destination).toBe('الإنماء المهني'); } finally { vi.unstubAllGlobals(); }
});
