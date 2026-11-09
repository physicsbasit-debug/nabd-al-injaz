import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  listEvidence,
  saveEvidence,
  removeEvidence,
  validateEvidence,
  type Evidence,
} from './evidence-store';
type Props = { planId: string; activityId: string; activityTitle: string; onClose: () => void };
export default function EvidencePanel({ planId, activityId, activityTitle, onClose }: Props) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    listEvidence(activityId)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError('تعذّر قراءة الشواهد المحلية.');
      });
    return () => {
      active = false;
    };
  }, [activityId, refresh]);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const invalid = validateEvidence(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveEvidence({
        id: crypto.randomUUID(),
        planId,
        activityId,
        name: file.name,
        mime: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        note: note.trim(),
        blob: file,
      });
      setFile(null);
      setNote('');
      setRefresh((v) => v + 1);
    } catch {
      setError('لم يُحفظ الشاهد. تحقق من المساحة المتاحة في المتصفح.');
    } finally {
      setBusy(false);
    }
  };
  const open = (item: Evidence) => {
    const url = URL.createObjectURL(item.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const remove = async (item: Evidence) => {
    if (!window.confirm('حذف هذا الشاهد نهائيًا من المتصفح؟')) return;
    setBusy(true);
    try {
      await removeEvidence(item.id);
      setRefresh((v) => v + 1);
    } catch {
      setError('تعذّر حذف الشاهد.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="evidence-panel" aria-label={'شواهد النشاط: ' + activityTitle}>
      <div className="evidence-panel-head">
        <div>
          <strong>الشواهد والتوثيق</strong>
          <p>{activityTitle}</p>
        </div>
        <button type="button" onClick={onClose}>
          إغلاق
        </button>
      </div>
      <p className="evidence-info">
        رفع الشاهد لا يغيّر حالة تنفيذ النشاط. تُحفظ الملفات في هذا المتصفح فقط، وقد تُفقد عند مسح
        بياناته.
      </p>
      <p role="status">{items.length} شاهد محفوظ</p>
      {items.length > 0 ? (
        <ul className="evidence-files">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {(item.size / 1024).toFixed(1)}KB •{' '}
                  {new Date(item.createdAt).toLocaleDateString('ar-OM')}
                </small>
                {item.note && <p>{item.note}</p>}
              </div>
              <div>
                <button type="button" onClick={() => open(item)}>
                  تنزيل
                </button>
                <button type="button" disabled={busy} onClick={() => void remove(item)}>
                  حذف الشاهد
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>لا توجد شواهد مرفقة بعد.</p>
      )}
      <form className="evidence-form" onSubmit={(event) => void add(event)}>
        <label>
          ملف الشاهد (PDF، صورة، Word، Excel)
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError('');
            }}
          />
        </label>
        <label>
          وصف الشاهد (اختياري)
          <textarea
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="primary-action" disabled={!file || busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ الشاهد'}
        </button>
      </form>
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
    </section>
  );
}
