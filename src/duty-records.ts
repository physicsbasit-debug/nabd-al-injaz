import { buildAchievements, type Achievement } from './achievement-register';
import type { Plan } from './plan-model';
import { readSupervisoryVisits, type SupervisoryVisit } from './supervisory-visits-model';
import { readProfessionalPrograms } from './professional-development-model';
import { readCoverStore } from './cover-planning';
import { CHECK_KINDS, readTeacherStore } from './teacher-profile-model';
import type { Task } from './task-model';
import type { DutyRecord } from './duty-routine';

/** الأقسام التي يُعد السجل المكتمل فيها إنجازًا مباشرًا لواجب محدد. */
export const AUTO_SECTION_DUTY: Record<string, number> = {
  'الجداول والاحتياط': 4,
  'الزيارات الإشرافية': 11,
  'الزيارات المتبادلة': 12,
  'الاجتماعات الدورية': 16,
  'رفع المستوى التحصيلي': 26,
  'الإنماء المهني': 27,
};

/** الواجبات التي تُغلق تلقائيًا من أقسامها (إضافة إلى أي واجب تُربط به مهمة). */
export const AUTO_CLOSING_DUTIES = new Set([...Object.values(AUTO_SECTION_DUTY), 5, 7, 24, 30]);

/**
 * يحوّل سجل الإنجازات إلى شواهد للواجبات:
 * المهمة المرتبطة برقم واجب تُحسب لذلك الواجب، وبقية السجلات تُحسب حسب قسمها.
 * السجلات دون تاريخ إنجاز لا تُحسب لأنه لا يمكن نسبتها إلى فترة.
 */
export function dutyRecordsFrom(achievements: Achievement[], tasks: Task[]): DutyRecord[] {
  const taskDuty = new Map(tasks.filter((t) => t.dutyId).map((t) => [t.id, t.dutyId as number]));
  const records: DutyRecord[] = [];
  for (const row of achievements) {
    if (!row.date) continue;
    const dutyId = row.source === 'task' ? taskDuty.get(row.sourceId) : AUTO_SECTION_DUTY[row.section];
    if (dutyId) records.push({ dutyId, date: row.date, title: row.title, section: row.section });
  }
  return records;
}

/** يقرأ السجلات المحفوظة ويحولها إلى شواهد للواجبات؛ القسم التالف يُتجاوز دون إيقاف الباقي. */
export function readDutyRecords(tasks: Task[], plans: Plan[], today: string): DutyRecord[] {
  const safe = <T,>(read: () => T, fallback: T): T => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };
  const visits = safe(readSupervisoryVisits, []);
  const achievements = buildAchievements({
    today,
    tasks,
    plans,
    visits,
    topics: [],
    cover: safe(readCoverStore, undefined),
    programs: safe(readProfessionalPrograms, []),
  });
  const checks = safe(readTeacherStore, null)?.checks ?? [];
  const checkRecords: DutyRecord[] = checks.map((c) => {
    const kind = CHECK_KINDS.find((k) => k.kind === c.kind)!;
    return { dutyId: kind.duty, date: c.date, title: `${kind.label}: ${c.teacher}`, section: 'ملفات المعلمين' };
  });
  return [...dutyRecordsFrom(achievements, tasks), ...checkRecords, ...visitMethodRecords(visits, today)];
}

/** الدرس التطبيقي يُحتسب للواجب 7، وكل أسلوب غير الزيارة الصفية يُحتسب تنويعًا للواجب 12. */
export function visitMethodRecords(visits: SupervisoryVisit[], today: string): DutyRecord[] {
  const records: DutyRecord[] = [];
  for (const v of visits) {
    if (v.status !== 'completed' || !v.method || !v.date || v.date > today) continue;
    const title = `${v.method}: ${v.teacher.trim()}`;
    if (v.method === 'درس تطبيقي') records.push({ dutyId: 7, date: v.date, title, section: 'الزيارات الإشرافية' });
    if (v.method !== 'زيارة صفية') records.push({ dutyId: 12, date: v.date, title, section: 'الزيارات الإشرافية' });
  }
  return records;
}
