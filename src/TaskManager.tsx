import { useMemo, useState } from 'react';
import {
  TASK_CATEGORIES,
  setTaskProgress,
  toggleTaskCompletion,
  taskCounts,
  type Task,
  type TaskCategory,
  type TaskPriority,
  type TaskProgress,
} from './task-model';

export { readTasks, STORAGE_KEY } from './task-model';
export type { Task } from './task-model';

type Props = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
};

const PROGRESS_OPTIONS: TaskProgress[] = ['لم تبدأ', 'قيد التنفيذ', 'مكتملة'];

export default function TaskManager({ tasks, setTasks }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('عادية');
  const [category, setCategory] = useState<TaskCategory>('أخرى');
  const [assignedTo, setAssignedTo] = useState('');
  const [progress, setProgress] = useState<TaskProgress>('لم تبدأ');
  const [notes, setNotes] = useState('');

  const [filter, setFilter] = useState<'الكل' | 'المفتوحة' | 'المكتملة'>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'كل المجالات'>('كل المجالات');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('عادية');
  const [editCategory, setEditCategory] = useState<TaskCategory>('أخرى');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editProgress, setEditProgress] = useState<TaskProgress>('لم تبدأ');
  const [editNotes, setEditNotes] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const counts = taskCounts(tasks);
  const overdue = tasks.filter((task) => !task.done && task.dueDate && task.dueDate < today).length;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ar');
    return tasks
      .filter((task) => filter === 'الكل' || (filter === 'المكتملة' ? task.done : !task.done))
      .filter((task) => categoryFilter === 'كل المجالات' || task.category === categoryFilter)
      .filter(
        (task) =>
          !term ||
          [task.title, task.assignedTo, task.notes].some((text) =>
            text.toLocaleLowerCase('ar').includes(term),
          ),
      )
      .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate));
  }, [tasks, filter, categoryFilter, search]);

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean || clean.length > 160) return;
    setTasks((old) => [
      {
        id: crypto.randomUUID(),
        title: clean,
        dueDate,
        priority,
        done: progress === 'مكتملة',
        createdAt: new Date().toISOString(),
        category,
        assignedTo: assignedTo.trim(),
        progress,
        notes: notes.trim(),
      },
      ...old,
    ]);
    setTitle('');
    setDueDate('');
    setPriority('عادية');
    setCategory('أخرى');
    setAssignedTo('');
    setProgress('لم تبدأ');
    setNotes('');
    setAddOpen(false);
    setFilter('الكل');
    setCategoryFilter('كل المجالات');
    setSearch('');
  }

  function startEdit(task: Task) {
    setEditing(task.id);
    setEditTitle(task.title);
    setEditDate(task.dueDate);
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditAssignedTo(task.assignedTo);
    setEditProgress(task.progress);
    setEditNotes(task.notes);
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = editTitle.trim();
    if (!clean || clean.length > 160) return;
    setTasks((old) =>
      old.map((task) =>
        task.id === editing
          ? setTaskProgress(
              {
                ...task,
                title: clean,
                dueDate: editDate,
                priority: editPriority,
                category: editCategory,
                assignedTo: editAssignedTo.trim(),
                notes: editNotes.trim(),
              },
              editProgress,
            )
          : task,
      ),
    );
    setEditing(null);
  }

  return (
    <section className="task-manager task-manager-v2" aria-label="إدارة الخطط والمهام">
      <div className="task-summary">
        <article>
          <span>إجمالي المهام</span>
          <strong>{counts.total}</strong>
        </article>
        <article>
          <span>المكتملة</span>
          <strong>{counts.completed}</strong>
        </article>
        <article>
          <span>المتأخرة</span>
          <strong>{overdue}</strong>
        </article>
        <article>
          <span>نسبة الإنجاز</span>
          <strong>{counts.total ? Math.round((counts.completed / counts.total) * 100) : 0}%</strong>
        </article>
      </div>

      <section className="card add-task-card">
        <button
          type="button"
          className="accordion-trigger"
          aria-expanded={addOpen}
          aria-controls="add-task-panel"
          onClick={() => setAddOpen((open) => !open)}
        >
          <span className="accordion-heading">
            <span className="accordion-symbol" aria-hidden="true">
              ＋
            </span>
            <span>إضافة مهمة جديدة</span>
          </span>
          <span className="accordion-chevron" aria-hidden="true">
            {addOpen ? '⌃' : '⌄'}
          </span>
        </button>
        {addOpen && (
          <div id="add-task-panel" className="accordion-content">
            <p className="task-form-hint">
              سجّل المهمة ومجالها والمسؤول عنها. جميع البيانات محلية في هذا المتصفح.
            </p>
            <form className="task-form" onSubmit={addTask}>
              <label>
                عنوان المهمة
                <input
                  required
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="مثال: متابعة تنفيذ الخطة الأسبوعية"
                />
              </label>
              <label>
                المجال
                <select
                  aria-label="المجال"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TaskCategory)}
                >
                  {TASK_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                المسؤول عن التنفيذ
                <input
                  maxLength={100}
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  placeholder="اسم المعلم أو الفريق (اختياري)"
                />
              </label>
              <label>
                تاريخ الاستحقاق
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label>
                الأولوية
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  <option>عادية</option>
                  <option>عاجلة</option>
                </select>
              </label>
              <label>
                حالة التنفيذ
                <select
                  aria-label="حالة التنفيذ"
                  value={progress}
                  onChange={(event) => setProgress(event.target.value as TaskProgress)}
                >
                  {PROGRESS_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="task-notes-field">
                ملاحظات المتابعة
                <textarea
                  maxLength={500}
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="تفاصيل مختصرة أو ما يلزم متابعته (اختياري)"
                />
              </label>
              <button className="primary-action" type="submit">
                إضافة المهمة
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="card task-list-card">
        <div className="task-toolbar">
          <div>
            <h2>قائمة المهام</h2>
            <p className="task-list-subtitle">
              قيد التنفيذ: {counts.inProgress} · لم تبدأ: {counts.notStarted}
            </p>
          </div>
          <div className="task-filters" role="group" aria-label="تصفية المهام">
            {(['الكل', 'المفتوحة', 'المكتملة'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                className={filter === item ? 'selected' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="task-search-row">
          <label>
            بحث في المهام
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالعنوان أو المسؤول أو الملاحظات"
            />
          </label>
          <label>
            تصفية حسب المجال
            <select
              aria-label="تصفية حسب المجال"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as TaskCategory | 'كل المجالات')
              }
            >
              <option>كل المجالات</option>
              {TASK_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <p className="empty-tasks">
            {tasks.length === 0
              ? 'لا توجد مهام ضمن هذا العرض.'
              : 'لا توجد مهام تطابق خيارات العرض الحالية.'}
          </p>
        ) : (
          <ul className="managed-tasks">
            {visible.map((task) => (
              <li key={task.id} className={task.done ? 'finished' : ''}>
                {editing === task.id ? (
                  <form className="edit-task-form" onSubmit={saveEdit}>
                    <label>
                      عنوان المهمة
                      <input
                        required
                        maxLength={160}
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                      />
                    </label>
                    <label>
                      المجال
                      <select
                        aria-label="المجال"
                        value={editCategory}
                        onChange={(event) => setEditCategory(event.target.value as TaskCategory)}
                      >
                        {TASK_CATEGORIES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      المسؤول عن التنفيذ
                      <input
                        maxLength={100}
                        value={editAssignedTo}
                        onChange={(event) => setEditAssignedTo(event.target.value)}
                      />
                    </label>
                    <label>
                      تاريخ الاستحقاق
                      <input
                        type="date"
                        value={editDate}
                        onChange={(event) => setEditDate(event.target.value)}
                      />
                    </label>
                    <label>
                      الأولوية
                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                      >
                        <option>عادية</option>
                        <option>عاجلة</option>
                      </select>
                    </label>
                    <label>
                      حالة التنفيذ
                      <select
                        aria-label="حالة التنفيذ"
                        value={editProgress}
                        onChange={(event) => setEditProgress(event.target.value as TaskProgress)}
                      >
                        {PROGRESS_OPTIONS.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="task-notes-field">
                      ملاحظات المتابعة
                      <textarea
                        maxLength={500}
                        rows={2}
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                      />
                    </label>
                    <div className="task-edit-actions">
                      <button className="primary-action" type="submit">
                        حفظ التعديل
                      </button>
                      <button type="button" onClick={() => setEditing(null)}>
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <label className="task-title">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() =>
                          setTasks((old) =>
                            old.map((item) =>
                              item.id === task.id ? toggleTaskCompletion(item) : item,
                            ),
                          )
                        }
                      />
                      <span>{task.title}</span>
                    </label>
                    <div className="task-meta">
                      <span className="task-chip">{task.category}</span>
                      <span
                        className={
                          task.done
                            ? 'task-chip task-chip-done'
                            : task.progress === 'قيد التنفيذ'
                              ? 'task-chip task-chip-active'
                              : 'task-chip'
                        }
                      >
                        {task.progress}
                      </span>
                      {task.assignedTo && <span>المسؤول: {task.assignedTo}</span>}
                      <span>{task.priority}</span>
                      {task.dueDate && <span>الاستحقاق: {task.dueDate}</span>}
                      {!task.done && task.dueDate && task.dueDate < today && (
                        <strong>متأخرة</strong>
                      )}
                    </div>
                    {task.notes && <p className="task-notes-preview">{task.notes}</p>}
                    <button type="button" className="edit-task" onClick={() => startEdit(task)}>
                      تعديل
                    </button>
                    <button
                      className="delete-task"
                      type="button"
                      aria-label={`حذف المهمة: ${task.title}`}
                      onClick={() => {
                        if (window.confirm('حذف هذه المهمة نهائيًا؟'))
                          setTasks((old) => old.filter((item) => item.id !== task.id));
                      }}
                    >
                      حذف
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="task-storage-note">
        البيانات محفوظة محليًا في هذا المتصفح فقط. لا تتزامن بين الأجهزة ولا تُعد نسخة احتياطية.
      </p>
    </section>
  );
}
