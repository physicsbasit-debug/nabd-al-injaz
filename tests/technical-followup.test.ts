import { describe, expect, it } from 'vitest';
import {
  adjustTaughtLessons,
  saveTechnicalTopic,
  technicalTopicStatus,
  technicalTopicSummary,
  type TechnicalTopic,
} from '../src/technical-followup-model';

const input = {
  teacher: ' معلم تجريبي ',
  grade: '9' as const,
  subject: 'فيزياء' as const,
  title: 'موضوع تجريبي',
  plannedLessons: 2,
  targetDate: '2026-11-12',
};

describe('technical follow-up rules', () => {
  it('creates a topic without inventing execution and normalizes the teacher name', () => {
    const [topic] = saveTechnicalTopic([], input);
    expect(topic.teacher).toBe('معلم تجريبي');
    expect(topic.taughtLessons).toBe(0);
    expect(topic.plannedLessons).toBe(2);
  });

  it('enforces the grade and subject pairing', () => {
    expect(() => saveTechnicalTopic([], { ...input, grade: '8', subject: 'فيزياء' })).toThrow(
      /الصف الثامن/,
    );
    expect(() => saveTechnicalTopic([], { ...input, grade: '10', subject: 'علوم عامة' })).toThrow(
      /اختر مادة/,
    );
  });

  it('does not allow planned lessons below lessons already taught', () => {
    const [topic] = saveTechnicalTopic([], input);
    const [withOneLesson] = adjustTaughtLessons([topic], topic.id, 1);
    expect(() =>
      saveTechnicalTopic([withOneLesson], { ...input, plannedLessons: 1 }, topic.id),
    ).not.toThrow();
    const [withTwoLessons] = adjustTaughtLessons([withOneLesson], topic.id, 1);
    expect(() =>
      saveTechnicalTopic([withTwoLessons], { ...input, plannedLessons: 1 }, topic.id),
    ).toThrow(/أقل من الحصص المنفذة/);
  });

  it('clamps lesson adjustments and classifies date states consistently', () => {
    const topic: TechnicalTopic = { ...input, teacher: 'معلم', id: 't', taughtLessons: 0 };
    expect(adjustTaughtLessons([topic], topic.id, -1)[0].taughtLessons).toBe(0);
    const completed = adjustTaughtLessons(
      adjustTaughtLessons([topic], topic.id, 1),
      topic.id,
      1,
    )[0];
    expect(adjustTaughtLessons([completed], topic.id, 1)[0].taughtLessons).toBe(2);
    expect(technicalTopicStatus(completed, '2026-11-11')).toBe('complete');
    expect(technicalTopicStatus({ ...topic, targetDate: '2026-11-10' }, '2026-11-11')).toBe(
      'overdue',
    );
    expect(technicalTopicStatus({ ...topic, targetDate: '2026-11-11' }, '2026-11-11')).toBe(
      'today',
    );
    expect(technicalTopicSummary([topic, completed], '2026-11-11')).toEqual({
      complete: 1,
      overdue: 0,
      today: 0,
      upcoming: 1,
    });
  });
});
