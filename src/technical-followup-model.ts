export type TechnicalGrade = '8' | '9' | '10';
export type TechnicalSubject = 'علوم عامة' | 'فيزياء' | 'كيمياء' | 'أحياء';
export type TechnicalTopic = {
  id: string;
  teacher: string;
  grade: TechnicalGrade;
  subject: TechnicalSubject;
  title: string;
  plannedLessons: number;
  taughtLessons: number;
  targetDate: string;
};

export const TECHNICAL_FOLLOWUP_STORAGE_KEY = 'nabd-al-injaz:technical-followup:v1';

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTopic(value: unknown): value is TechnicalTopic {
  if (!value || typeof value !== 'object') return false;
  const topic = value as Partial<TechnicalTopic>;
  return (
    typeof topic.id === 'string' &&
    typeof topic.teacher === 'string' &&
    (topic.grade === '8' || topic.grade === '9' || topic.grade === '10') &&
    (topic.grade === '8'
      ? topic.subject === 'علوم عامة'
      : topic.subject !== 'علوم عامة' &&
        (topic.subject === 'فيزياء' || topic.subject === 'كيمياء' || topic.subject === 'أحياء')) &&
    typeof topic.title === 'string' &&
    Number.isInteger(topic.plannedLessons) &&
    (topic.plannedLessons ?? 0) > 0 &&
    Number.isInteger(topic.taughtLessons) &&
    (topic.taughtLessons ?? -1) >= 0 &&
    (topic.taughtLessons ?? 0) <= (topic.plannedLessons ?? 0) &&
    validDate(topic.targetDate)
  );
}

export function readTechnicalTopics(): TechnicalTopic[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(TECHNICAL_FOLLOWUP_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.filter(validTopic) : [];
  } catch {
    return [];
  }
}

export type TechnicalTopicInput = Omit<TechnicalTopic, 'id' | 'taughtLessons'>;

export function saveTechnicalTopic(
  topics: TechnicalTopic[],
  input: TechnicalTopicInput,
  id?: string,
): TechnicalTopic[] {
  const title = input.title.trim();
  const teacher = input.teacher.trim();
  if (!teacher || !title || !validDate(input.targetDate))
    throw new Error('أكمل المعلم والموضوع والموعد المستهدف.');
  if (input.grade === '8' && input.subject !== 'علوم عامة')
    throw new Error('الصف الثامن يُسجل ضمن العلوم العامة.');
  if (input.grade !== '8' && input.subject === 'علوم عامة')
    throw new Error('اختر مادة الصف التاسع أو العاشر.');
  if (
    !Number.isInteger(input.plannedLessons) ||
    input.plannedLessons < 1 ||
    input.plannedLessons > 60
  )
    throw new Error('عدد الحصص المخطط يجب أن يكون من 1 إلى 60.');
  const existing = id ? topics.find((topic) => topic.id === id) : undefined;
  if (existing && input.plannedLessons < existing.taughtLessons)
    throw new Error('لا يمكن جعل الحصص المخططة أقل من الحصص المنفذة.');
  const next: TechnicalTopic = {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    teacher,
    title,
    taughtLessons: existing?.taughtLessons ?? 0,
  };
  return existing ? topics.map((topic) => (topic.id === id ? next : topic)) : [...topics, next];
}

export function adjustTaughtLessons(
  topics: TechnicalTopic[],
  id: string,
  change: -1 | 1,
): TechnicalTopic[] {
  return topics.map((topic) =>
    topic.id === id
      ? {
          ...topic,
          taughtLessons: Math.max(0, Math.min(topic.plannedLessons, topic.taughtLessons + change)),
        }
      : topic,
  );
}

export function removeTechnicalTopic(topics: TechnicalTopic[], id: string): TechnicalTopic[] {
  return topics.filter((topic) => topic.id !== id);
}

export type TechnicalTopicStatus = 'complete' | 'overdue' | 'today' | 'upcoming';

export function technicalTopicStatus(topic: TechnicalTopic, today: string): TechnicalTopicStatus {
  if (topic.taughtLessons >= topic.plannedLessons) return 'complete';
  if (topic.targetDate < today) return 'overdue';
  if (topic.targetDate === today) return 'today';
  return 'upcoming';
}

export function technicalTopicSummary(topics: TechnicalTopic[], today: string) {
  return topics.reduce(
    (summary, topic) => {
      const status = technicalTopicStatus(topic, today);
      summary[status] += 1;
      return summary;
    },
    { complete: 0, overdue: 0, today: 0, upcoming: 0 },
  );
}

export function readTechnicalTopicSummary(today: string) {
  return technicalTopicSummary(readTechnicalTopics(), today);
}
