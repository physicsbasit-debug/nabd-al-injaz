import { normalizeTeacher } from './schedule-model';

export type NameCheck = { status: 'empty' | 'known' | 'unknown' | 'no-roster' } | { status: 'suggest'; suggestion: string };

/**
 * يقارن الاسم المكتوب بأسماء الجداول حتى لا يتشعب ملف المعلم:
 * الاسم المطابق معروف، والجزئي (مثل «أحمد» مقابل «أحمد سعيد») يقترح الاسم الكامل.
 */
export function checkTeacherName(name: string, roster: string[]): NameCheck {
  const value = normalizeTeacher(name);
  if (!value) return { status: 'empty' };
  const names = [...new Set(roster.map(normalizeTeacher).filter(Boolean))];
  if (!names.length) return { status: 'no-roster' };
  if (names.includes(value)) return { status: 'known' };
  const words = value.split(' ');
  const candidates = names.filter((n) => n.startsWith(value + ' ') || value.startsWith(n + ' ') || words.every((w) => n.split(' ').includes(w)));
  return candidates.length === 1 ? { status: 'suggest', suggestion: candidates[0] } : { status: 'unknown' };
}
