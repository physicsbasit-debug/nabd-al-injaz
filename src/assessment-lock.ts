// All writers and backup operations must use the same cross-tab lock.
export async function withAssessmentLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) throw new Error('متصفحك لا يدعم حماية التعديل المتزامن؛ لم تُغيّر البيانات.');
  return navigator.locks.request('nabd-al-injaz:assessment-data:v1', { mode: 'exclusive' }, operation);
}
