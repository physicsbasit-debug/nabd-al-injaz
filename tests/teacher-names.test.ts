import { describe, expect, it } from 'vitest';
import { checkTeacherName } from '../src/teacher-names';

describe('teacher name check', () => {
  const roster = ['أحمد سعيد', 'سالم الهنائي', 'أحمد العامري'];
  it('recognises known names and spacing differences', () => {
    expect(checkTeacherName('', roster)).toEqual({ status: 'empty' });
    expect(checkTeacherName(' سالم  الهنائي ', roster)).toEqual({ status: 'known' });
    expect(checkTeacherName('خالد', [])).toEqual({ status: 'no-roster' });
  });
  it('suggests the full roster name only when the match is unique', () => {
    expect(checkTeacherName('سالم', roster)).toEqual({
      status: 'suggest',
      suggestion: 'سالم الهنائي',
    });
    expect(checkTeacherName('أحمد', roster)).toEqual({ status: 'unknown' });
    expect(checkTeacherName('سالم بن خميس الهنائي', ['سالم الهنائي'])).toEqual({
      status: 'unknown',
    });
    expect(checkTeacherName('خالد', roster)).toEqual({ status: 'unknown' });
  });
});
