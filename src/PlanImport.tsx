import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { FileUp, Check, X } from 'lucide-react';
import {
  approvedActivities,
  previewPlanFile,
  type ImportCandidate,
  type ImportPreview,
} from './plan-import';
import type { PlanActivity } from './plan-model';
type Props = { onApprove: (activities: PlanActivity[]) => void; existingTitles: string[] };
export default function PlanImport({ onApprove, existingTitles }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<ImportCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setPreview(null);
    setItems([]);
    setSelected([]);
    try {
      const next = await previewPlanFile(file);
      setPreview(next);
      setItems(next.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذرت قراءة الملف.');
    } finally {
      setBusy(false);
    }
  }
  const existing = new Set(existingTitles.map((s) => s.trim().toLocaleLowerCase('ar')));
  const chosen = items.filter((c) => selected.includes(c.key));
  const unique = new Set<string>();
  const valid = chosen.filter((candidate) => {
    const key = candidate.title.trim().toLocaleLowerCase('ar');
    if (key.length < 4 || key.length > 160 || existing.has(key) || unique.has(key)) return false;
    unique.add(key);
    return true;
  });
  function approve() {
    if (!valid.length) return;
    onApprove(approvedActivities(valid));
    setPreview(null);
    setItems([]);
    setSelected([]);
  }
  return (
    <section className="plan-import-panel" aria-label="استيراد أنشطة الخطة">
      <h4>استيراد أنشطة من ملف</h4>
      <p>
        اختر ملف XLSX أو DOCX أو PDF بحجم لا يتجاوز 8MB. ستظهر المقترحات للمراجعة ولن يُضاف أي نشاط
        دون اختيارك.
      </p>
      <label className="plan-import-file">
        <FileUp size={17} /> اختيار ملف
        <input
          type="file"
          accept=".xlsx,.docx,.pdf"
          onChange={onFile}
          disabled={busy}
          aria-label="ملف الخطة للاستيراد"
        />
      </label>
      {busy && <p role="status">جارٍ استخراج النصوص محليًا…</p>}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      {preview && (
        <>
          <strong>مراجعة: {preview.filename}</strong>
          {preview.warnings.map((warning) => (
            <p className="plan-import-warning" key={warning}>
              {warning}
            </p>
          ))}
          <p role="status" className="plan-import-counter">
            تم اختيار {selected.length} من أصل {items.length} نشاطًا • الصالح للاعتماد{' '}
            {valid.length}
          </p>
          <p>
            راجع العنوان والمسؤول وتاريخ الاستحقاق لكل نشاط. الحقول غير الموجودة في الملف تظل غير
            محددة.
          </p>
          <div className="plan-import-toolbar">
            <button type="button" onClick={() => setSelected(items.map((c) => c.key))}>
              تحديد الكل
            </button>
            <button type="button" onClick={() => setSelected([])}>
              إلغاء التحديد
            </button>
          </div>
          <ul className="plan-import-candidates">
            {items.map((c) => (
              <li key={c.key}>
                <label className="plan-import-choice">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.key)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked ? [...old, c.key] : old.filter((x) => x !== c.key),
                      )
                    }
                  />
                  <span>{c.source}</span>
                </label>
                <input
                  aria-label={'عنوان مقترح: ' + c.source}
                  maxLength={160}
                  value={c.title}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <div className="plan-import-metadata">
                  <label>
                    المسؤول
                    <input
                      aria-label={'مسؤول النشاط: ' + c.source}
                      placeholder="غير محدد"
                      maxLength={100}
                      value={c.assignee}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((x) =>
                            x.key === c.key ? { ...x, assignee: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    تاريخ الاستحقاق
                    <input
                      aria-label={'تاريخ النشاط: ' + c.source}
                      type="date"
                      value={c.dueDate}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((x) => (x.key === c.key ? { ...x, dueDate: e.target.value } : x)),
                        )
                      }
                    />
                  </label>
                </div>
                {existing.has(c.title.trim().toLocaleLowerCase('ar')) && (
                  <small>نشاط موجود بالفعل، لن يُكرر.</small>
                )}
              </li>
            ))}
          </ul>
          <div className="plan-import-actions">
            <button
              className="primary-action"
              type="button"
              onClick={approve}
              disabled={!valid.length}
            >
              <Check size={16} /> اعتماد {valid.length} نشاط
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setItems([]);
                setSelected([]);
              }}
            >
              <X size={16} /> إلغاء الاستيراد
            </button>
          </div>
        </>
      )}
    </section>
  );
}
