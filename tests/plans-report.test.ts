import { describe,it,expect } from 'vitest';
import { buildPlansReport,filterPlansReport } from '../src/plans-report-model';
import type { Task } from '../src/task-model';
import type { Plan } from '../src/plan-model';
const task:Task={id:'t',title:'تقرير',dueDate:'2026-11-20',priority:'عاجلة',done:true,createdAt:'2026-11-01T00:00:00Z',category:'أخرى',assignedTo:'أحمد',progress:'مكتملة',notes:'تفصيل'};
const plan:Plan={id:'p',title:'الخطة',kind:'خطة المادة',owner:'وليد',periodStart:'',periodEnd:'',archived:false,createdAt:'',activities:[{id:'a',title:'نشاط',details:'متابعة',assignee:'سالم',dueDate:'2026-11-19',progress:'in_progress',completedAt:null,createdAt:''}]};
describe('تقرير الخطط والمهام',()=>{
 it('يحفظ تاريخ الاستحقاق منفصلا عن تاريخ الإنجاز غير المعروف',()=>{const rows=buildPlansReport([task],[plan]);expect(rows[0].dueDate).toBe('2026-11-20');expect(rows[0].completedDate).toBeNull();expect(rows[1].plan).toBe('الخطة');});
 it('يصفي حسب المسؤول والحالة وتاريخ الاستحقاق',()=>{const rows=buildPlansReport([task],[plan]);expect(filterPlansReport(rows,{person:'سالم',status:'open',from:'2026-11-01',to:'2026-11-30',kind:'all'}).map(x=>x.title)).toEqual(['نشاط']);});
});
