import './visit-plan-import.test';
import { describe, expect, it } from 'vitest';
import { activitiesForDestination, proposePlanDestination } from '../src/plan-routing';
describe('plan destination suggestions', () => {
  it('suggests a destination for explicit teacher training and supervision activities', () => {
    expect(proposePlanDestination('مشغل تدريب المعلمين على التقويم')).toBe('الإنماء المهني');
    expect(proposePlanDestination('زيارة إشرافية لمعلم العلوم')).toBe('الزيارات الإشرافية');
    expect(proposePlanDestination('الزيارات المتبادلة بين المعلمين')).toBe('الزيارات المتبادلة');
  });
  it('leaves ambiguous and unknown activities for human review', () => {
    expect(proposePlanDestination('متابعة الأعمال')).toBeNull();
    expect(proposePlanDestination('اجتماع دوري ومشغل للمعلمين')).toBeNull();
    expect(proposePlanDestination('زيارة صفية متبادلة لمعلم العلوم')).toBeNull();
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

it('shows only matching activities from active plans without copying them', () => {
  const activities = approvedActivities([
    {key:'1',source:'1',title:'مشغل للمعلمين',assignee:'',dueDate:'',details:'',destination:'الإنماء المهني'},
    {key:'2',source:'2',title:'نشاط آخر',assignee:'',dueDate:'',details:''},
  ]);
  const plan = {id:'p',title:'خطة',kind:'خطة أخرى' as const,owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:'',activities};
  const view = activitiesForDestination([plan, {...plan,id:'archived',archived:true}], 'الإنماء المهني');
  expect(view).toHaveLength(1);
  expect(view[0].activity).toBe(activities[0]);
  expect(plan.activities).toHaveLength(2);
  expect(activitiesForDestination([plan], 'الزيارات المتبادلة')).toEqual([]);
});
