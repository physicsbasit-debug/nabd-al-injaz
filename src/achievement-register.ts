import { localDateKey } from './dashboard-metrics';
import { validDate, type Plan } from './plan-model';
import type { Task } from './task-model';
import type { SupervisoryVisit } from './supervisory-visits-model';
import type { TechnicalTopic } from './technical-followup-model';

export type Achievement = { id:string; title:string; section:string; person:string; date:string|null; source:'task'|'activity'|'visit'|'topic'; sourceId:string; planId?:string; activityId?:string; detail:string };
type Input = { tasks:Task[]; plans:Plan[]; visits:SupervisoryVisit[]; topics:TechnicalTopic[]; today:string };
function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (validDate(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}
export function buildAchievements({tasks,plans,visits,topics,today}:Input):Achievement[] {
  const rows:Achievement[] = [];
  for (const t of tasks) if (t.done) rows.push({id:'task:'+t.id,title:t.title,section:'الخطط والمهام',person:t.assignedTo,date:dateKey(t.completedAt),source:'task',sourceId:t.id,detail:t.category});
  for (const p of plans) for (const a of p.activities) if (a.progress==='completed') rows.push({id:'activity:'+p.id+':'+a.id,title:a.title,section:a.destination || 'مكتبة الخطط',person:a.assignee,date:dateKey(a.completedAt),source:'activity',sourceId:a.id,planId:p.id,activityId:a.id,detail:p.title+(p.archived?' · خطة مؤرشفة':'')});
  for (const v of visits) if (v.status==='completed' && validDate(v.date) && v.date<=today) rows.push({id:'visit:'+v.id,title:'زيارة '+v.teacher,section:'الزيارات الإشرافية',person:v.teacher,date:v.date,source:'visit',sourceId:v.id,detail:'زيارة متابعة وتوثيق'+(v.activityId?' · مرتبطة بنشاط خطة':'')});
  for (const t of topics) if(t.taughtLessons>=t.plannedLessons) rows.push({id:'topic:'+t.id,title:t.title,section:'المتابعة الفنية',person:t.teacher,date:null,source:'topic',sourceId:t.id,detail:'اكتملت الحصص المسجلة'});
  return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.title.localeCompare(b.title,'ar'));
}
export type AchievementFilter = {from:string;to:string;section:string;person:string};
export function filterAchievements(rows:Achievement[], filters:AchievementFilter):Achievement[] {
  const person=filters.person.trim().toLocaleLowerCase('ar');
  return rows.filter(r=>(filters.section==='الكل'||r.section===filters.section)&&(!person||r.person.toLocaleLowerCase('ar').includes(person))&&(!filters.from||(r.date!==null&&r.date>=filters.from))&&(!filters.to||(r.date!==null&&r.date<=filters.to)));
}
