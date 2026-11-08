import { useMemo, useState } from 'react';
export type Task = { id: string; title: string; dueDate: string; priority: 'عادية' | 'عاجلة'; done: boolean; createdAt: string };
export const STORAGE_KEY = 'nabd-al-injaz:tasks:v1';
export function readTasks(): Task[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((t): t is Task => Boolean(t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.dueDate === 'string' && typeof t.done === 'boolean' && (t.priority === 'عادية' || t.priority === 'عاجلة') && typeof t.createdAt === 'string'));
  } catch { return []; }
}
type Props = { tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>> };
export default function TaskManager({tasks,setTasks}:Props) {
  const [addOpen,setAddOpen] = useState(false);
  const [title,setTitle] = useState('');
  const [dueDate,setDueDate] = useState('');
  const [priority,setPriority] = useState<Task['priority']>('عادية');
  const [filter,setFilter] = useState<'الكل'|'المفتوحة'|'المكتملة'>('الكل');
  const [editing,setEditing] = useState<string|null>(null);
  const [editTitle,setEditTitle] = useState('');
  const [editDate,setEditDate] = useState('');
  const [editPriority,setEditPriority] = useState<Task['priority']>('عادية');
  const today = new Date().toLocaleDateString('en-CA');
  const done = tasks.filter(t=>t.done).length;
  const overdue = tasks.filter(t=>!t.done && t.dueDate && t.dueDate<today).length;
  const visible = useMemo(()=>tasks.filter(t=>filter==='الكل'||(filter==='المكتملة'?t.done:!t.done)).sort((a,b)=>Number(a.done)-Number(b.done)||a.dueDate.localeCompare(b.dueDate)),[tasks,filter]);
  function addTask(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const clean=title.trim();if(!clean||clean.length>160)return;setTasks(old=>[{id:crypto.randomUUID(),title:clean,dueDate,priority,done:false,createdAt:new Date().toISOString()},...old]);setTitle('');setDueDate('');setPriority('عادية');setAddOpen(false);}
  function startEdit(t:Task){setEditing(t.id);setEditTitle(t.title);setEditDate(t.dueDate);setEditPriority(t.priority);}
  function saveEdit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const clean=editTitle.trim();if(!clean||clean.length>160)return;setTasks(old=>old.map(t=>t.id===editing?{...t,title:clean,dueDate:editDate,priority:editPriority}:t));setEditing(null);}
  return <section className="task-manager" aria-label="إدارة الخطط والمهام">
    <div className="task-summary"><article><span>إجمالي المهام</span><strong>{tasks.length}</strong></article><article><span>المكتملة</span><strong>{done}</strong></article><article><span>المتأخرة</span><strong>{overdue}</strong></article><article><span>نسبة الإنجاز</span><strong>{tasks.length?Math.round(done/tasks.length*100):0}%</strong></article></div>
    <section className="card add-task-card"><button type="button" className="accordion-trigger" aria-expanded={addOpen} aria-controls="add-task-panel" onClick={()=>setAddOpen(v=>!v)}><span className="accordion-heading"><span className="accordion-symbol" aria-hidden="true">＋</span><span>إضافة مهمة جديدة</span></span><span className="accordion-chevron" aria-hidden="true">{addOpen?"⌃":"⌄"}</span></button>{addOpen&&<div id="add-task-panel" className="accordion-content"><form className="task-form" onSubmit={addTask}><label>عنوان المهمة<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: متابعة تنفيذ الخطة الأسبوعية"/></label><label>تاريخ الاستحقاق<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>الأولوية<select value={priority} onChange={e=>setPriority(e.target.value as Task['priority'])}><option>عادية</option><option>عاجلة</option></select></label><button className="primary-action" type="submit">إضافة المهمة</button></form></div>}</section>
    <section className="card"><div className="task-toolbar"><h2>قائمة المهام</h2><div className="task-filters" role="group" aria-label="تصفية المهام">{(['الكل','المفتوحة','المكتملة'] as const).map(f=><button key={f} type="button" aria-pressed={filter===f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
    {visible.length===0?<p className="empty-tasks">لا توجد مهام ضمن هذا العرض.</p>:<ul className="managed-tasks">{visible.map(t=><li key={t.id} className={t.done?'finished':''}>
      {editing===t.id?<form className="edit-task-form" onSubmit={saveEdit}><label>عنوان المهمة<input required maxLength={160} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label><label>تاريخ الاستحقاق<input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)}/></label><label>الأولوية<select value={editPriority} onChange={e=>setEditPriority(e.target.value as Task['priority'])}><option>عادية</option><option>عاجلة</option></select></label><button className="primary-action" type="submit">حفظ التعديل</button><button type="button" onClick={()=>setEditing(null)}>إلغاء</button></form>:<>
      <label><input type="checkbox" checked={t.done} onChange={()=>setTasks(old=>old.map(x=>x.id===t.id?{...x,done:!x.done}:x))}/><span>{t.title}</span></label><div className="task-meta"><span>{t.priority}</span>{t.dueDate&&<span>الاستحقاق: {t.dueDate}</span>}{!t.done&&t.dueDate&&t.dueDate<today&&<strong>متأخرة</strong>}</div><button type="button" className="edit-task" onClick={()=>startEdit(t)}>تعديل</button><button className="delete-task" type="button" aria-label={`حذف المهمة: ${t.title}`} onClick={()=>{if(window.confirm('حذف هذه المهمة نهائيًا؟'))setTasks(old=>old.filter(x=>x.id!==t.id));}}>حذف</button></>}
    </li>)}</ul>}</section><p className="task-storage-note">البيانات محفوظة محليًا في هذا المتصفح فقط. لا تتزامن بين الأجهزة ولا تُعد نسخة احتياطية.</p>
  </section>;
}