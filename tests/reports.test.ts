import { describe, it, expect } from 'vitest';
import { buildReport, filterReport } from '../src/report-model';
import type { Task } from '../src/task-model';
const task:Task={id:'t',title:'مهمة',dueDate:'2026-11-18',priority:'عادية',done:false,createdAt:'2026-11-01T00:00:00Z',category:'أخرى',assignedTo:'أحمد',progress:'لم تبدأ',notes:''};
describe('تقارير العمل',()=>{
 it('includes open and completed work without substituting due dates for unknown completion dates',()=>{
 const records=buildReport({tasks:[task,{...task,id:'d',title:'قديم',done:true,progress:'مكتملة'}],plans:[],visits:[],topics:[],programs:[],assessments:[],reviews:[],cover:{version:1,days:{}},today:'2026-11-17'});
 expect(records.map(r=>r.id).sort()).toEqual(['task:d','task:t']);
 expect(records.find(r=>r.id==='task:d')?.date).toBeNull();
 expect(records.find(r=>r.id==='task:t')?.date).toBe('2026-11-18');
 expect(filterReport(records,{section:'الكل',person:'',from:'2026-11-01',to:'2026-11-30',status:'الكل'}).map(r=>r.id)).toEqual(['task:t']);
 });
});
