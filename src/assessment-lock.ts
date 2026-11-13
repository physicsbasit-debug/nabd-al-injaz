// All writers and backup operations must use the same cross-tab lock.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('nabd-al-injaz:assessment-changes:v1');
export function onAssessmentChange(listener: () => void): () => void {
  if (!channel) return () => {};
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
export async function withAssessmentLock<T>(operation: () => Promise<T>, notify = true): Promise<T> {
  if (!navigator.locks?.request) throw new Error('متصفحك لا يدعم حماية التعديل المتزامن؛ لم تُغيّر البيانات.');
  const result = await navigator.locks.request('nabd-al-injaz:assessment-data:v1', { mode: 'exclusive' }, operation);
  if (notify) channel?.postMessage('changed');
  return result;
}
