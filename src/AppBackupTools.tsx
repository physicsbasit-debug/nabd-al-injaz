import { useState, type Dispatch, type SetStateAction } from 'react';
import { exportAppBackup, restoreAppBackup } from './app-backup';
import type { Plan } from './plan-model';
import type { Task } from './task-model';
import './app-backup.css';

type Props = {
  plans: Plan[];
  setPlans: Dispatch<SetStateAction<Plan[]>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
};

export default function AppBackupTools({ plans, setPlans, setTasks }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <details className="app-backup-tools">
      <summary>نقل نسخة المنظومة بين الأجهزة</summary>
      <p>ملف واحد يحوي المهام والخطط والشواهد والجداول وسجل الاحتياط والمتابعة الفنية والاختبارات والإنماء المهني.</p>
      <div className="app-backup-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage('');
            void exportAppBackup(plans)
              .then(() => setMessage('جُهزت النسخة للتنزيل.'))
              .catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : 'تعذّر إنشاء النسخة.'),
              )
              .finally(() => setBusy(false));
          }}
        >
          تنزيل نسخة كاملة
        </button>
        <label className="app-backup-upload">
          استعادة نسخة كاملة
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (
                !file ||
                !window.confirm(
                  'ستُستبدل بيانات هذا المتصفح بالنسخة المختارة، بما فيها الجداول وسجل الاحتياط والخطط والشواهد والاختبارات والإنماء المهني. هل تتابع؟',
                )
              )
                return;
              setBusy(true);
              setMessage('');
              void restoreAppBackup(file)
                .then((restored) => {
                  setTasks(restored.tasks);
                  setPlans(restored.plans);
                  setMessage('استُعيدت بيانات المنظومة والشواهد بنجاح.');
                })
                .catch((error: unknown) =>
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : 'فشلت الاستعادة دون تغيير البيانات السابقة.',
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
        </label>
      </div>
      <small>
        انقل الملف يدويًا إلى الجهاز الآخر ثم اختر استعادة. يحتوي على بيانات مدرسية خاصة؛ احفظه في
        مكان موثوق.
      </small>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
