import {describe,it,expect} from 'vitest';
import {buildAssessmentReport,filterAssessmentReport} from '../src/assessment-report-model';
import type {AssessmentRecord} from '../src/assessment-tracking';
import type {Plan} from '../src/plan-model';
const a:AssessmentRecord={id:'a',title:'اختبار',teacher:'أحمد',subject:'فيزياء',grade:'10',reviewed:true,submitted:false,analyzed:false,notes:''};
const p:Plan={id:'p',title:'خطة',kind:'خطة رفع المستوى التحصيلي',owner:'',periodStart:'',periodEnd:'',archived:false,createdAt:'',activities:[{id:'x',title:'دعم تحصيلي',assignee:'سالم',details:'',progress:'completed',dueDate:'2026-11-20',completedAt:null,createdAt:'',destination:'رفع المستوى التحصيلي'}]};
describe('تقرير الاختبارات والتحصيل',()=>{it('يعرض المراحل وتاريخ نشاط التحصيل دون اختلاق تاريخ للاختبار',()=>{const rows=buildAssessmentReport([a],[],[p]);expect(rows[0].date).toBeNull();expect(rows[0].detail).toContain('لم يتم التسليم');expect(rows[1].date).toBe('2026-11-20');});it('تستبعد التصفية الزمنية السجلات غير المؤرخة',()=>{const rows=buildAssessmentReport([a],[],[p]);expect(filterAssessmentReport(rows,{teacher:'',status:'all',from:'2026-11-01',to:''}).map(r=>r.title)).toEqual(['دعم تحصيلي']);});});
