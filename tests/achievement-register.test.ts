import { describe, expect, it } from 'vitest';
import { buildAchievements, filterAchievements } from '../src/achievement-register';
import { readTasks, STORAGE_KEY, setTaskProgress, type Task } from '../src/task-model';
import type { Plan } from '../src/plan-model';
const task: Task = { id:'t', title:'مهمة', dueDate:'2026-11-01', done:false, createdAt:'2026-11-01T00:00:00Z', priority:'عادية', category:'أخرى', assignedTo:'', progress:'لم تبدأ', notes:'' };
const plan: Plan = { id:'p', title:'خطة', kind:'خطة أخرى', owner:'', periodStart:'', periodEnd:'', archived:true, createdAt:'', activities:[{id:'a',title:'نشاط',assignee:'أحمد',details:'',dueDate:'2026-11-02',progress:'completed',completedAt:'2026-11-04T09:00:00Z',createdAt:''}] };
describe('سجل الإنجاز', () => {
  it('includes completed records from original sources without inventing old task dates', () => {
    const rows = buildAchievements({ tasks:[{...task,done:true,progress:'مكتملة'}], plans:[plan], visits:[], topics:[], today:'2026-11-17' });
    expect(rows.map(r=>r.id).sort()).toEqual(['activity:p:a','task:t']);
    expect(rows.find(r=>r.id==='task:t')?.date).toBeNull();
    expect(rows.find(r=>r.id==='activity:p:a')?.person).toBe('أحمد');
  });
  it('filters by recorded completion date and responsible person, excluding unknown dates from a date range', () => {
    const rows = buildAchievements({tasks:[{...task,done:true,progress:'مكتملة'}],plans:[plan],visits:[],topics:[],today:'2026-11-17'});
    expect(filterAchievements(rows,{from:'2026-11-01',to:'2026-11-10',section:'الكل',person:'أحمد'}).map(r=>r.id)).toEqual(['activity:p:a']);
    expect(filterAchievements(rows,{from:'2026-11-01',to:'',section:'الكل',person:''}).length).toBe(1);
  });
  it('preserves a recorded completion date when reading saved tasks', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:(key:string)=>key===STORAGE_KEY?JSON.stringify([{...task,done:true,progress:'مكتملة',completedAt:'2026-11-17T09:00:00Z'}]):null} });
    expect(readTasks()[0].completedAt).toBe('2026-11-17T09:00:00Z');
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:original });
  });
  it('records completion on transition, preserves legacy missing dates, and removes date on reopening', () => {
    const done = setTaskProgress(task, 'مكتملة', '2026-11-17T09:00:00.000Z');
    expect(done.completedAt).toBe('2026-11-17T09:00:00.000Z');
    expect(setTaskProgress({...task,done:true,progress:'مكتملة'},'مكتملة','2026-11-17T09:00:00.000Z').completedAt).toBeUndefined();
    expect(setTaskProgress(done,'قيد التنفيذ').completedAt).toBeUndefined();
  });
});
