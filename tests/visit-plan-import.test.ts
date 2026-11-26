import { describe, expect, it } from 'vitest';
import { visitPlanRows } from '../src/visit-plan-import';

describe('visit plan tables', () => {
  it('reads both kinds of visit without importing headings and keeps dates and roles', () => {
    const supervisory = visitPlanRows('الفصل الأول', [
      ['خطة الزيارات الإشرافية'],
      ['م', 'التخصص', 'اسم المعلم', 'التاريخ المقترح', 'اليوم', 'حالة المتابعة'],
      [1, 'الفيزياء', 'معلم تجريبي', new Date('2026-09-15T00:00:00Z'), 'الثلاثاء', 'لم تنفذ'],
      ['تنبيه: التواريخ مقترحة'],
    ]);
    expect(supervisory).toHaveLength(1);
    expect(supervisory?.[0]).toMatchObject({ title: 'زيارة إشرافية إلى معلم تجريبي – الفصل الأول', assignee: '', dueDate: '2026-09-15', destination: 'الزيارات الإشرافية' });
    const peer = visitPlanRows('الفصل الثاني', [
      ['م', 'التخصص', 'المعلم الزائر', 'المعلم المستضيف', 'التاريخ المقترح', 'التاريخ الفعلي', 'حالة المتابعة'],
      [1, 'الكيمياء', 'معلم زائر', 'معلم مستضيف', '2027/02/09', '', 'لم تنفذ'],
    ]);
    expect(peer?.[0]).toMatchObject({ dueDate: '2027-02-09', assignee: 'معلم زائر', destination: 'الزيارات المتبادلة' });
    expect(peer?.[0].details).toContain('المعلم المستضيف: معلم مستضيف');
    expect(visitPlanRows('خطة أخرى', [['النشاط', 'التاريخ'], ['ورشة عمل', '2027/02/09']])).toBeNull();
  });
});
