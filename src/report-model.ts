import { buildAchievements, type Achievement } from './achievement-register';
import { validDate, type Plan } from './plan-model';
import type { Task } from './task-model';
import type { SupervisoryVisit } from './supervisory-visits-model';
import type { TechnicalTopic } from './technical-followup-model';
import type { ProfessionalProgram } from './professional-development-model';
import type { AssessmentRecord } from './assessment-tracking';
import type { ReviewRecord } from './short-test-model';
import type { CoverStore } from './cover-planning';
export type ReportRow = Achievement & {status:'منجز'|'قيد المتابعة'};
type Input={tasks:Task[];plans:Plan[];visits:SupervisoryVisit[];topics:TechnicalTopic[];programs:ProfessionalProgram[];assessments:AssessmentRecord[];reviews:ReviewRecord[];cover:CoverStore;today:string};
export function buildReport(input:Input):ReportRow[]{
 const {tasks,plans,visits,topics,programs,assessments,reviews,cover}=input;
 const rows:ReportRow[]=buildAchievements(input).map(row=>({...row,status:'منجز'}));
 const add=(row:Achievement)=>rows.push({...row,status:'قيد المتابعة'});
 for(const t of tasks)if(!t.done)add({id:'task:'+t.id,title:t.title,section:'الخطط والمهام',person:t.assignedTo,date:validDate(t.dueDate)?t.dueDate:null,source:'task',sourceId:t.id,detail:t.category});
 for(const p of plans)for(const a of p.activities)if(a.progress!=='completed')add({id:'activity:'+p.id+':'+a.id,title:a.title,section:a.destination||'مكتبة الخطط',person:a.assignee,date:validDate(a.dueDate)?a.dueDate:null,source:'activity',sourceId:a.id,planId:p.id,activityId:a.id,detail:p.title+(p.archived?' · خطة مؤرشفة':'')});
 for(const v of visits)if(v.status==='planned')add({id:'visit:'+v.id,title:'زيارة '+v.teacher,section:'الزيارات الإشرافية',person:v.teacher,date:validDate(v.date)?v.date:null,source:'visit',sourceId:v.id,detail:'زيارة للمتابعة والتوثيق'});
 for(const t of topics)if(t.taughtLessons<t.plannedLessons)add({id:'topic:'+t.id,title:t.title,section:'المتابعة الفنية',person:t.teacher,date:validDate(t.targetDate)?t.targetDate:null,source:'topic',sourceId:t.id,detail:`${t.taughtLessons} من ${t.plannedLessons} حصص`});
 for(const p of programs)if(!p.completed)add({id:'program:'+p.id,title:p.title,section:'الإنماء المهني',person:p.presenter,date:validDate(p.date)?p.date:null,source:'program',sourceId:p.id,detail:'لم يؤكد التنفيذ'});
 for(const a of assessments)if(!(a.reviewed===true&&a.submitted&&a.analyzed))add({id:'assessment:'+a.id,title:a.title,section:'الاختبارات والتحصيل',person:a.teacher,date:null,source:'assessment',sourceId:a.id,detail:`المراجعة: ${a.reviewed?'تمت':'غير مكتملة'} · التسليم: ${a.submitted?'تم':'لم يتم'} · التحليل: ${a.analyzed?'تم':'لم يتم'}`});
 for(const r of reviews)if(r.status!=='تمت المراجعة')add({id:'review:'+r.id,title:r.title,section:'الاختبارات والتحصيل',person:r.teacher,date:null,source:'review',sourceId:r.id,detail:r.status});
 for(const [day,r] of Object.entries(cover.days))if(!r.processedAt&&(r.absent.length||r.assignments.length))add({id:'cover:'+day,title:'مسودة احتياط '+day,section:'الجداول والاحتياط',person:'',date:day,source:'cover',sourceId:day,detail:'مسودة غير محفوظة كمعالجة'});
 return rows.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'ar'));
}
export function filterReport(rows:ReportRow[],filter:{section:string;person:string;from:string;to:string;status:string}){const person=filter.person.trim().toLocaleLowerCase('ar');return rows.filter(r=>(filter.section==='الكل'||r.section===filter.section)&&(filter.status==='الكل'||r.status===filter.status)&&(!person||r.person.toLocaleLowerCase('ar').includes(person))&&(!filter.from||(r.date!==null&&r.date>=filter.from))&&(!filter.to||(r.date!==null&&r.date<=filter.to)));}
