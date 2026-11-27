import { PERFORMANCE_INDICATORS, VISIT_METHODS, type PerformanceIndicator, type SupervisoryVisit, type VisitMethod } from './supervisory-visits-model';

export type VisitAnalysis = {
  total: number;
  tagged: number;
  byMethod: Array<[VisitMethod | 'غير محدد', number]>;
  strengths: Array<[PerformanceIndicator, number]>;
  priorities: Array<[PerformanceIndicator, number]>;
  /** أولويات تكررت لدى أكثر من معلم: مرشحة لبرنامج إنماء جماعي */
  sharedPriorities: Array<{ indicator: PerformanceIndicator; teachers: string[] }>;
};

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');

/** يحلل الزيارات المنفذة في فترة: الأساليب المستخدمة، وأكثر المؤشرات قوة وأولوية. */
export function analyzeVisits(visits: SupervisoryVisit[], from: string, to: string): VisitAnalysis {
  const done = visits.filter((v) => v.status === 'completed' && v.date >= from && v.date <= to);
  const count = <T extends string>(values: T[], order: readonly T[]) =>
    order
      .map((key) => [key, values.filter((v) => v === key).length] as [T, number])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  const methods = done.map((v) => v.method ?? 'غير محدد') as Array<VisitMethod | 'غير محدد'>;
  const strengths = count(done.flatMap((v) => v.strengthIndicators ?? []), PERFORMANCE_INDICATORS);
  const priorities = count(done.flatMap((v) => v.priorityIndicators ?? []), PERFORMANCE_INDICATORS);
  const sharedPriorities = priorities
    .map(([indicator]) => ({
      indicator,
      teachers: [...new Set(done.filter((v) => v.priorityIndicators?.includes(indicator)).map((v) => tidy(v.teacher)))],
    }))
    .filter((item) => item.teachers.length >= 2);
  return {
    total: done.length,
    tagged: done.filter((v) => v.strengthIndicators?.length || v.priorityIndicators?.length).length,
    byMethod: count(methods, [...VISIT_METHODS, 'غير محدد'] as const),
    strengths,
    priorities,
    sharedPriorities,
  };
}
