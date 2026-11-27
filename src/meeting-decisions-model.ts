export const MEETING_DECISIONS_KEY = 'nabd-al-injaz:meeting-decisions:v1';

/** قرار أو توصية من اجتماع دوري، يُتابع حتى التنفيذ (الواجب 16). */
export type MeetingDecision = {
  id: string;
  planId: string;
  meetingId: string;
  meetingTitle: string;
  text: string;
  owner: string;
  dueDate: string;
  doneAt: string | null;
  createdAt: string;
};
export type MeetingDecisionStore = { version: 1; decisions: MeetingDecision[] };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const day = (v: unknown) => v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')));
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

export function isMeetingDecision(v: unknown): v is MeetingDecision {
  return (
    isRecord(v) &&
    str(v.id, 100) && !!(v.id as string) &&
    str(v.planId, 200) && !!(v.planId as string) &&
    str(v.meetingId, 200) && !!(v.meetingId as string) &&
    str(v.meetingTitle, 300) &&
    str(v.text, 1000) && !!(v.text as string).trim() &&
    str(v.owner, 300) &&
    day(v.dueDate) &&
    (v.doneAt === null || (typeof v.doneAt === 'string' && !Number.isNaN(Date.parse(v.doneAt)))) &&
    typeof v.createdAt === 'string' && !Number.isNaN(Date.parse(v.createdAt))
  );
}

export function isMeetingDecisionStore(v: unknown): v is MeetingDecisionStore {
  return (
    isRecord(v) &&
    v.version === 1 &&
    Array.isArray(v.decisions) &&
    v.decisions.every(isMeetingDecision) &&
    new Set(v.decisions.map((d) => (d as MeetingDecision).id)).size === v.decisions.length
  );
}

export const emptyDecisionStore = (): MeetingDecisionStore => ({ version: 1, decisions: [] });

export function readDecisionStore(): MeetingDecisionStore {
  const raw = localStorage.getItem(MEETING_DECISIONS_KEY);
  if (!raw) return emptyDecisionStore();
  const data: unknown = JSON.parse(raw);
  if (!isMeetingDecisionStore(data)) throw new Error('تعذر قراءة قرارات الاجتماعات؛ لم تتغير بياناتك.');
  return data;
}

export const DECISIONS_CHANGED = 'nabd-al-injaz:meeting-decisions-changed';
export function writeDecisionStore(store: MeetingDecisionStore) {
  localStorage.setItem(MEETING_DECISIONS_KEY, JSON.stringify(store));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DECISIONS_CHANGED));
}

export function addDecision(
  store: MeetingDecisionStore,
  input: Pick<MeetingDecision, 'planId' | 'meetingId' | 'meetingTitle' | 'text' | 'owner' | 'dueDate'>,
  now = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): MeetingDecisionStore {
  const decision: MeetingDecision = {
    ...input,
    id,
    text: input.text.trim().slice(0, 1000),
    owner: input.owner.trim().slice(0, 300),
    meetingTitle: input.meetingTitle.slice(0, 300),
    doneAt: null,
    createdAt: now,
  };
  if (!isMeetingDecision(decision)) throw new Error('اكتب نص القرار، وتاريخًا صحيحًا إن وُجد.');
  return { ...store, decisions: [...store.decisions, decision] };
}

export function setDecisionDone(store: MeetingDecisionStore, id: string, done: boolean, now = new Date().toISOString()): MeetingDecisionStore {
  return { ...store, decisions: store.decisions.map((d) => (d.id === id ? { ...d, doneAt: done ? now : null } : d)) };
}

export function removeDecision(store: MeetingDecisionStore, id: string): MeetingDecisionStore {
  return { ...store, decisions: store.decisions.filter((d) => d.id !== id) };
}

/** القرارات المفتوحة مرتبة: المتأخرة أولًا ثم حسب الموعد، وما لا موعد له في الآخر. */
export function openDecisions(store: MeetingDecisionStore): MeetingDecision[] {
  return store.decisions
    .filter((d) => !d.doneAt)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt.localeCompare(b.createdAt));
}
