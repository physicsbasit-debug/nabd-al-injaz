import { describe, it, expect } from 'vitest';
import { filterVisitReport, visitReportStatus } from '../src/visit-report-model';
import type { SupervisoryVisit } from '../src/supervisory-visits-model';
const base: SupervisoryVisit = { id:'1', teacher:'أحمد', date:'2026-11-16', status:'completed', subject:'فيزياء', grade:'10', section:'2', period:'2', lesson:'القوى', strengths:'', improvements:'', recommendations:'', followUp:'متابعة', documentation:'توثيق', planId:'', activityId:'', createdAt:'2026-11-01T00:00:00Z' };
describe('تقرير الزيارات', () => {
 it('يصفي المعلم والحالة والفترة دون إدراج الزيارة غير المؤرخة', () => {
  const visits = [base, {...base,id:'2',teacher:'سالم',status:'planned' as const,date:''}, {...base,id:'3',status:'planned' as const,date:'2026-11-20'}];
  expect(filterVisitReport(visits,{teacher:'أحمد',status:'planned',from:'2026-11-01',to:'2026-11-30'}).map(v=>v.id)).toEqual(['3']);
  expect(filterVisitReport(visits,{teacher:'',status:'all',from:'',to:''})).toHaveLength(3);
 });
 it('يوضح تاريخًا مستقبليًا غير متسق مع الإنجاز',()=>{
  expect(visitReportStatus({...base,date:'2027-01-01'},'2026-11-17')).toBe('منفذة بتاريخ مستقبلي — تحقق من التاريخ');
  expect(visitReportStatus({...base,status:'planned'},'2026-11-17')).toBe('مخططة');
 });
});
