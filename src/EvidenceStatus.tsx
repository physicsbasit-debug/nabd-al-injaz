import { useEffect, useState } from 'react';
import { countEvidence } from './evidence-store';
export default function EvidenceStatus({
  activityId,
  completed,
  revision,
}: {
  activityId: string;
  completed: boolean;
  revision: number;
}) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    countEvidence(activityId)
      .then((n) => {
        if (active) setCount(n);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [activityId, revision]);
  if (count === null) return <small>الشواهد: تعذّر التحقق</small>;
  return (
    <small className="evidence-status">
      {completed
        ? count > 0
          ? 'مكتمل • موثق'
          : 'مكتمل • غير موثق'
        : count > 0
          ? 'شواهد مرفقة • غير مكتمل'
          : 'لا توجد شواهد'}{' '}
      ({count})
    </small>
  );
}
