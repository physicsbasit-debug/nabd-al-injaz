import type { Task } from './task-model';
import { validDate, type Plan } from './plan-model';
import type { SupervisoryVisit } from './supervisory-visits-model';
import type { TechnicalTopic } from './technical-followup-model';
import type { ProfessionalProgram } from './professional-development-model';
import type { AssessmentRecord } from './assessment-tracking';
import type { ReviewRecord } from './short-test-model';
import type { CoverStore } from './cover-planning';

export type AgendaItem = { id: string; title: string; detail: string; date: string; completionDate: string | null; section: string; planId?: string; activityId?: string };
type Input = { today: string; tasks: Task[]; plans: Plan[]; visits: SupervisoryVisit[]; topics: TechnicalTopic[]; programs: ProfessionalProgram[]; assessments?: AssessmentRecord[]; reviews?: ReviewRecord[]; cover?: CoverStore };
export function buildAgenda({ today, tasks, plans, visits, topics, programs, assessments = [], reviews = [], cover }: Input) {
  const result: Record<'today' | 'week' | 'later' | 'overdue' | 'undated' | 'completed', AgendaItem[]> = { today: [], week: [], later: [], overdue: [], undated: [], completed: [] };
  const end = new Date(today + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const add = (item: AgendaItem, completed: boolean) => {
    if (completed) result.completed.push(item);
    else if (!validDate(item.date)) result.undated.push(item);
    else if (item.date < today) result.overdue.push(item);
    else if (item.date === today) result.today.push(item);
    else if (item.date <= weekEnd) result.week.push(item);
    else result.later.push(item);
  };
  for (const task of tasks) add({ id: 'task:' + task.id, title: task.title, detail: 'مهمة · ' + (task.assignedTo ? 'المسؤول: ' + task.assignedTo : task.category), date: task.dueDate, completionDate: task.completedAt ?? null, section: 'الخطط والمهام' }, task.done);
  for (const plan of plans) for (const a of plan.activities) {
    if (plan.archived && a.progress !== 'completed') continue;
    add({ id: 'activity:' + plan.id + ':' + a.id, title: a.title, detail: 'نشاط خطة: ' + plan.title + (a.assignee ? ' · المسؤول: ' + a.assignee : ''), date: a.dueDate, completionDate: a.completedAt, section: 'مكتبة الخطط', planId: plan.id, activityId: a.id }, a.progress === 'completed');
  }
  for (const v of visits.filter(visit => visit.status !== 'completed' || visit.date <= today)) add({ id: 'visit:' + v.id, title: 'زيارة ' + v.teacher, detail: 'زيارة إشرافية للمتابعة والتوثيق' + (v.activityId ? ' · مرتبطة بنشاط خطة' : ''), date: v.date, completionDate: v.status === 'completed' ? v.date : null, section: 'الزيارات الإشرافية' }, v.status === 'completed' && v.date <= today);
  for (const t of topics) add({ id: 'topic:' + t.id, title: t.title, detail: 'متابعة فنية · ' + t.teacher + ' · ' + t.taughtLessons + '/' + t.plannedLessons + ' حصص', date: t.targetDate, completionDate: null, section: 'المتابعة الفنية' }, t.taughtLessons >= t.plannedLessons);
  // A program date is a scheduled event, not proof of completion.
  for (const p of programs) if (!p.completed) add({ id: 'program:' + p.id, title: p.title, detail: 'برنامج إنماء مهني · لم يؤكد التنفيذ', date: p.date, completionDate: null, section: 'الإنماء المهني' }, false);
  for (const a of assessments) if (!(a.reviewed === true && a.submitted && a.analyzed)) add({ id: 'assessment:' + a.id, title: a.title, detail: 'اختبار · ' + a.teacher + ' · متابعة المراجعة والتسليم والتحليل', date: '', completionDate: null, section: 'الاختبارات والتحصيل' }, false);
  for (const r of reviews) if (r.status !== 'تمت المراجعة') add({ id: 'review:' + r.id, title: r.title, detail: 'مراجعة سابقة · ' + r.teacher + ' · ' + r.status, date: '', completionDate: null, section: 'الاختبارات والتحصيل' }, false);
  for (const [day, record] of Object.entries(cover?.days ?? {})) if (!record.processedAt && (record.absent.length || record.assignments.length)) add({ id: 'cover:' + day, title: 'مسودة احتياط ' + day, detail: 'مسودة لم تحفظ كمعالجة', date: day, completionDate: null, section: 'الجداول والاحتياط' }, false);
  for (const list of Object.values(result)) list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title, 'ar'));
  return result;
}
