/** Route only unambiguous activity titles; never invent a destination. */
export const PLAN_DESTINATIONS = ['الإنماء المهني', 'الزيارات الإشرافية', 'الزيارات المتبادلة', 'الاجتماعات الدورية', 'رفع المستوى التحصيلي'] as const;
export type PlanDestination = typeof PLAN_DESTINATIONS[number];
export function proposePlanDestination(title: string): PlanDestination | null {
  const text = title.normalize('NFKC').replace(/[\u064b-\u065f\u0670ـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
  const patterns: Array<[PlanDestination, RegExp]> = [
    ['الإنماء المهني', /انماء مهني|مشغل|ورشه|تدريب|قراءه موجهه|حلقه نقاش/],
    ['الزيارات الإشرافية', /زيار(?:ه|ات) اشرافيه|زيار(?:ه|ات) صفيه|زيار(?:ه|ات) فنيه/],
    ['الزيارات المتبادلة', /زيار(?:ه|ات)(?:\s+\S+){0,2}\s+(?:ال)?متبادل(?:ه|ات)/],
    ['الاجتماعات الدورية', /اجتماع(?:ات)? دوري(?:ه)?|اجتماع(?:ات)? الماده/],
    ['رفع المستوى التحصيلي', /رفع (?:المستوى|التحصيل)|خطه علاجيه|برنامج علاجي/],
  ];
  const matches = patterns.filter(([, pattern]) => pattern.test(text));
  return matches.length === 1 ? matches[0][0] : null;
}

import type { Plan } from './plan-model';

/** A view of the original activities; it creates no duplicate records. */
export function activitiesForDestination(plans: Plan[], destination: PlanDestination) {
  return plans.filter((plan) => !plan.archived).flatMap((plan) =>
    plan.activities.filter((activity) => activity.destination === destination)
      .map((activity) => ({ plan, activity })),
  );
}
