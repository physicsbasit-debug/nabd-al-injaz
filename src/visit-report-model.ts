import { isFutureCompletedVisit, type SupervisoryVisit } from './supervisory-visits-model';

export type VisitReportFilters = { teacher:string; status:'all'|'planned'|'completed'; from:string; to:string };
export function filterVisitReport(visits:SupervisoryVisit[], filters:VisitReportFilters):SupervisoryVisit[] {
 const name=filters.teacher.trim();
 return visits.filter(v => (!name || v.teacher===name) && (filters.status==='all' || v.status===filters.status) && (!(filters.from || filters.to) || (!!v.date && (!filters.from || v.date>=filters.from) && (!filters.to || v.date<=filters.to))))
  .sort((a,b)=>(b.date||'').localeCompare(a.date||'') || a.teacher.localeCompare(b.teacher,'ar'));
}
export function visitReportStatus(visit:SupervisoryVisit,today:string):string {
 return isFutureCompletedVisit(visit,today) ? 'منفذة بتاريخ مستقبلي — تحقق من التاريخ' : visit.status==='completed' ? 'منفذة' : 'مخططة';
}
