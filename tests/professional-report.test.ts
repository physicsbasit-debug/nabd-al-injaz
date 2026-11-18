import {describe,it,expect} from 'vitest';
import {filterProfessionalReport,professionalReportStatus} from '../src/professional-report-model';
import type {ProfessionalProgram} from '../src/professional-development-model';
const p:ProfessionalProgram={id:'p',title:'مشغل',kind:'مشغل',date:'2026-11-18',period:'2',presenter:'أحمد',notes:'متابعة',attendance:{سالم:'حاضر',خالد:'لم يُرصد'},completed:true};
describe('تقرير الإنماء المهني',()=>{
 it('يرشح حسب المعلم المقدم أو المستهدف والتاريخ والحالة',()=>{expect(filterProfessionalReport([p],{teacher:'سالم',status:'done',from:'2026-11-01',to:'2026-11-30'})).toHaveLength(1);expect(filterProfessionalReport([p],{teacher:'ناصر',status:'all',from:'',to:''})).toHaveLength(0)});
 it('لا يفترض تنفيذ البرامج التي لم يؤكد تنفيذها ويحذر من التاريخ المستقبلي',()=>{expect(professionalReportStatus({...p,completed:undefined},'2026-11-18')).toBe('لم يؤكد التنفيذ');expect(professionalReportStatus({...p,date:'2027-01-01'},'2026-11-18')).toContain('تحقق من التاريخ')});
});
