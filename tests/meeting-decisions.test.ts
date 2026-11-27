import { describe, expect, it } from 'vitest';
import {
  addDecision,
  emptyDecisionStore,
  isMeetingDecisionStore,
  openDecisions,
  removeDecision,
  setDecisionDone,
} from '../src/meeting-decisions-model';

const meeting = { planId: 'p', meetingId: 'm', meetingTitle: 'اجتماع نوفمبر' };

describe('meeting decisions', () => {
  it('adds, completes, reopens and removes decisions', () => {
    let store = addDecision(
      emptyDecisionStore(),
      { ...meeting, text: '  تبادل زيارتين  ', owner: ' سالم ', dueDate: '2026-12-01' },
      '2026-11-27T06:00:00.000Z',
      'a',
    );
    expect(store.decisions[0]).toEqual({
      ...meeting,
      id: 'a',
      text: 'تبادل زيارتين',
      owner: 'سالم',
      dueDate: '2026-12-01',
      doneAt: null,
      createdAt: '2026-11-27T06:00:00.000Z',
    });
    store = setDecisionDone(store, 'a', true, '2026-11-30T06:00:00.000Z');
    expect(store.decisions[0].doneAt).toBe('2026-11-30T06:00:00.000Z');
    expect(setDecisionDone(store, 'a', false).decisions[0].doneAt).toBeNull();
    expect(removeDecision(store, 'a').decisions).toEqual([]);
    expect(isMeetingDecisionStore(store)).toBe(true);
  });

  it('rejects empty text or invalid dates', () => {
    expect(() =>
      addDecision(emptyDecisionStore(), { ...meeting, text: '  ', owner: '', dueDate: '' }),
    ).toThrow();
    expect(() =>
      addDecision(emptyDecisionStore(), {
        ...meeting,
        text: 'قرار',
        owner: '',
        dueDate: '2026-13-40',
      }),
    ).toThrow();
    expect(isMeetingDecisionStore({ version: 1, decisions: [{ id: 'x' }] })).toBe(false);
  });

  it('lists open decisions by due date with undated last', () => {
    let store = emptyDecisionStore();
    store = addDecision(
      store,
      { ...meeting, text: 'ب', owner: '', dueDate: '' },
      '2026-11-01T00:00:00.000Z',
      'b',
    );
    store = addDecision(
      store,
      { ...meeting, text: 'ج', owner: '', dueDate: '2026-12-05' },
      '2026-11-01T00:00:00.000Z',
      'c',
    );
    store = addDecision(
      store,
      { ...meeting, text: 'د', owner: '', dueDate: '2026-11-20' },
      '2026-11-01T00:00:00.000Z',
      'd',
    );
    store = setDecisionDone(
      addDecision(
        store,
        { ...meeting, text: 'هـ', owner: '', dueDate: '2026-11-01' },
        '2026-11-01T00:00:00.000Z',
        'e',
      ),
      'e',
      true,
    );
    expect(openDecisions(store).map((d) => d.id)).toEqual(['d', 'c', 'b']);
  });
});
