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
  category: TaskCategory;
  assignedTo: string;
  progress: TaskProgress;
  notes: string;
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
          notes: typeof task.notes === 'string' ? task.notes.slice(0, 500) : '',
        },
      ];
    });
  } catch {
    return [];
  }
}

export function setTaskProgress(task: Task, progress: TaskProgress): Task {
  return { ...task, progress, done: progress === 'مكتملة' };
}

export function toggleTaskCompletion(task: Task): Task {
  return setTaskProgress(task, task.done ? 'لم تبدأ' : 'مكتملة');
}

export function taskCounts(tasks: Task[]) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.done).length,
    inProgress: tasks.filter((task) => !task.done && task.progress === 'قيد التنفيذ').length,
    notStarted: tasks.filter((task) => !task.done && task.progress !== 'قيد التنفيذ').length,
  };
}
