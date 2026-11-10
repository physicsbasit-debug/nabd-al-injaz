import type { Task } from './task-model';

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTaskOverdue(task: Task, today: string): boolean {
  return !task.done && validDateKey(task.dueDate) && task.dueDate < today;
}

export function tasksDueToday(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((task) => !task.done && validDateKey(task.dueDate) && task.dueDate === today)
    .sort((a, b) => {
      const urgent = Number(b.priority === 'عاجلة') - Number(a.priority === 'عاجلة');
      return urgent || a.title.localeCompare(b.title, 'ar');
    });
}

export function dashboardMetrics(tasks: Task[], today: string) {
  const completed = tasks.filter((task) => task.done).length;
  return {
    total: tasks.length,
    completed,
    inProgress: tasks.filter((task) => !task.done && task.progress === 'قيد التنفيذ').length,
    overdue: tasks.filter((task) => isTaskOverdue(task, today)).length,
    urgentOpen: tasks.filter((task) => !task.done && task.priority === 'عاجلة').length,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function priorityTasks(tasks: Task[], today: string, limit = 5): Task[] {
  return tasks
    .filter((task) => !task.done)
    .sort((a, b) => {
      const overdue = Number(isTaskOverdue(b, today)) - Number(isTaskOverdue(a, today));
      if (overdue) return overdue;
      const urgent = Number(b.priority === 'عاجلة') - Number(a.priority === 'عاجلة');
      if (urgent) return urgent;
      const aDate = validDateKey(a.dueDate) ? a.dueDate : '9999-12-31';
      const bDate = validDateKey(b.dueDate) ? b.dueDate : '9999-12-31';
      const byDate = aDate.localeCompare(bDate);
      return byDate || a.title.localeCompare(b.title, 'ar');
    })
    .slice(0, Math.max(0, limit));
}
