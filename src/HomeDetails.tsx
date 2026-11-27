import { useState, type ReactNode } from 'react';

export const HOME_DETAILS_KEY = 'nabd-al-injaz:ui:home-details-open';

/** اللوحات التفصيلية في الرئيسية مطوية افتراضيًا ليبقى موجز اليوم شاشة واحدة؛ يُحفظ اختيار الفتح. */
export default function HomeDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(HOME_DETAILS_KEY) === '1';
    } catch {
      return false;
    }
  });
  return (
    <details
      className="home-details"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        try {
          localStorage.setItem(HOME_DETAILS_KEY, next ? '1' : '0');
        } catch {
          /* تفضيل عرض فقط */
        }
      }}
    >
      <summary>
        <strong>اللوحة التفصيلية</strong>
        <span>متابعة الأسبوع، وأقسام اليوم، والخطط، ومؤشرات المهام</span>
      </summary>
      <div className="home-details-body">{open && children}</div>
    </details>
  );
}
