export const TASK_CATEGORIES = [
  'تخطيط ومناهج',
  'متابعة فنية',
  'تقويم وتحصيل',
  'إنماء مهني',
  'أخرى',
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type TaskProgress = 'لم تبدأ' | 'قيد التنفيذ' | 'مكتملة';
export type TaskPriority = 'عادية' | 'عاجلة';

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  category: TaskCategory;
  assignedTo: string;
  progress: TaskProgress;
  previousProgress?: Exclude<TaskProgress, 'مكتملة'>;
  notes: string;
  /** رقم الواجب الوظيفي (1–44) الذي تخدمه المهمة */
  dutyId?: number;
};

export const STORAGE_KEY = 'nabd-al-injaz:tasks:v1';

const isCategory = (value: unknown): value is TaskCategory =>
  TASK_CATEGORIES.some((category) => category === value);

export function readTasks(): Task[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];

    return value.flatMap((item): Task[] => {
      if (!item || typeof item !== 'object') return [];
      const task = item as Record<string, unknown>;
      if (
        typeof task.id !== 'string' ||
        typeof task.title !== 'string' ||
        typeof task.dueDate !== 'string' ||
        typeof task.done !== 'boolean' ||
        (task.priority !== 'عادية' && task.priority !== 'عاجلة') ||
        typeof task.createdAt !== 'string'
      ) {
        return [];
      }

      return [
        {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          priority: task.priority,
          done: task.done,
          createdAt: task.createdAt,
          category: isCategory(task.category) ? task.category : 'أخرى',
          assignedTo: typeof task.assignedTo === 'string' ? task.assignedTo.slice(0, 100) : '',
          progress: task.done
            ? 'مكتملة'
            : task.progress === 'قيد التنفيذ'
              ? 'قيد التنفيذ'
              : 'لم تبدأ',
          ...(task.done &&
          (task.previousProgress === 'قيد التنفيذ' || task.previousProgress === 'لم تبدأ')
            ? { previousProgress: task.previousProgress }
            : {}),
          notes: typeof task.notes === 'string' ? task.notes.slice(0, 500) : '',
          ...(Number.isInteger(task.dutyId) && (task.dutyId as number) >= 1 && (task.dutyId as number) <= 44 ? { dutyId: task.dutyId as number } : {}),
          ...(task.done && typeof task.completedAt === 'string' && !Number.isNaN(Date.parse(task.completedAt)) ? { completedAt: task.completedAt } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function setTaskProgress(task: Task, progress: TaskProgress, now = new Date().toISOString()): Task {
  if (progress === 'مكتملة') {
    return {
      ...task,
      progress,
      done: true,
      ...(!task.done ? { completedAt: now } : {}),
      previousProgress: task.done
        ? (task.previousProgress ?? 'لم تبدأ')
        : task.progress === 'قيد التنفيذ'
          ? 'قيد التنفيذ'
          : 'لم تبدأ',
    };
  }

  const updated: Task = { ...task, progress, done: false };
  delete updated.previousProgress;
  delete updated.completedAt;
  return updated;
}

export function toggleTaskCompletion(task: Task): Task {
  return setTaskProgress(task, task.done ? (task.previousProgress ?? 'لم تبدأ') : 'مكتملة');
}

export function formatDueDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat('ar-OM', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function taskCounts(tasks: Task[]) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.done).length,
    inProgress: tasks.filter((task) => !task.done && task.progress === 'قيد التنفيذ').length,
    notStarted: tasks.filter((task) => !task.done && task.progress !== 'قيد التنفيذ').length,
  };
}

/** يربط المهمة بواجب وظيفي أو يزيل الربط عند القيمة الفارغة. */
export function withDutyId(task: Task, value: string): Task {
  const id = Number(value);
  const updated: Task = { ...task };
  delete updated.dutyId;
  return Number.isInteger(id) && id >= 1 && id <= 44 ? { ...updated, dutyId: id } : updated;
}
