import type { Task } from './task-model';
import { validDate, type Plan } from './plan-model';
import type { SupervisoryVisit } from './supervisory-visits-model';
import type { TechnicalTopic } from './technical-followup-model';
import type { ProfessionalProgram } from './professional-development-model';

export type AgendaItem = { id: string; title: string; detail: string; date: string; completionDate: string | null; section: string; planId?: string; activityId?: string };
type Input = { today: string; tasks: Task[]; plans: Plan[]; visits: SupervisoryVisit[]; topics: TechnicalTopic[]; programs: ProfessionalProgram[] };
export function buildAgenda({ today, tasks, plans, visits, topics, programs }: Input) {
  const result: Record<'today' | 'week' | 'overdue' | 'undated' | 'completed', AgendaItem[]> = { today: [], week: [], overdue: [], undated: [], completed: [] };
  const end = new Date(today + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const add = (item: AgendaItem, completed: boolean) => {
    if (completed) result.completed.push(item);
    else if (!validDate(item.date)) result.undated.push(item);
    else if (item.date < today) result.overdue.push(item);
    else if (item.date === today) result.today.push(item);
    else if (item.date <= weekEnd) result.week.push(item);
  };
  for (const task of tasks) add({ id: 'task:' + task.id, title: task.title, detail: 'مهمة · ' + (task.assignedTo ? 'المسؤول: ' + task.assignedTo : task.category), date: task.dueDate, completionDate: task.completedAt ?? null, section: 'الخطط والمهام' }, task.done);
  for (const plan of plans) for (const a of plan.activities) {
    if (plan.archived && a.progress !== 'completed') continue;
    add({ id: 'activity:' + plan.id + ':' + a.id, title: a.title, detail: 'نشاط خطة: ' + plan.title + (a.assignee ? ' · المسؤول: ' + a.assignee : ''), date: a.dueDate, completionDate: a.completedAt, section: 'مكتبة الخطط', planId: plan.id, activityId: a.id }, a.progress === 'completed');
  }
  for (const v of visits.filter(visit => visit.status !== 'completed' || visit.date <= today)) add({ id: 'visit:' + v.id, title: 'زيارة ' + v.teacher, detail: 'زيارة إشرافية للمتابعة والتوثيق' + (v.activityId ? ' · مرتبطة بنشاط خطة' : ''), date: v.date, completionDate: v.status === 'completed' ? v.date : null, section: 'الزيارات الإشرافية' }, v.status === 'completed' && v.date <= today);
  for (const t of topics) add({ id: 'topic:' + t.id, title: t.title, detail: 'متابعة فنية · ' + t.teacher + ' · ' + t.taughtLessons + '/' + t.plannedLessons + ' حصص', date: t.targetDate, completionDate: null, section: 'المتابعة الفنية' }, t.taughtLessons >= t.plannedLessons);
  // A program date is a scheduled event, not proof of completion.
  for (const p of programs) if (!p.completed && p.date >= today) add({ id: 'program:' + p.id, title: p.title, detail: 'برنامج إنماء مهني', date: p.date, completionDate: null, section: 'الإنماء المهني' }, false);
  for (const list of Object.values(result)) list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title, 'ar'));
  return result;
}
