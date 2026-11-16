import type { Plan } from './plan-model';
import { activitiesForDestination, type PlanDestination } from './plan-routing';

type Props = {
  plans: Plan[];
  destination: PlanDestination;
  onOpenPlan: (id: string) => void;
};

const labels = {
  not_started: 'لم يبدأ',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
} as const;

export default function PlanSectionActivities({ plans, destination, onOpenPlan }: Props) {
  const activities = activitiesForDestination(plans, destination);
  return (
    <section className="card" aria-label={'أنشطة الخطط: ' + destination}>
      <h2>أنشطة الخطط: {destination}</h2>
      <p>تظهر هنا الأنشطة المعتمدة في الخطط. افتح الخطة لتحديث النشاط أو إضافة شواهده.</p>
      {activities.length === 0 ? (
        <p>لا توجد أنشطة مصنفة لهذا القسم في الخطط النشطة.</p>
      ) : (
        <ul>
          {activities.map(({ plan, activity }) => (
            <li key={plan.id + ':' + activity.id}>
              <strong>{activity.title}</strong>
              <p>الخطة: {plan.title} • الحالة: {labels[activity.progress]}</p>
              {activity.assignee && <p>المسؤول: {activity.assignee}</p>}
              {activity.dueDate && <p>الاستحقاق: {activity.dueDate}</p>}
              <button type="button" onClick={() => onOpenPlan(plan.id)}>فتح الخطة</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
