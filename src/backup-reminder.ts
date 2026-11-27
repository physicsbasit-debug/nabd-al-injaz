export const LAST_BACKUP_KEY = 'nabd-al-injaz:ui:last-backup';
export const BACKUP_REMINDER_DAYS = 7;

export function markBackupDone(at = new Date().toISOString()) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, at);
  } catch {
    /* التذكير اختياري */
  }
}

/** عدد الأيام منذ آخر نسخة احتياطية ناجحة، أو null إن لم تُؤخذ نسخة من هذا المتصفح. */
export function daysSinceBackup(now = new Date()): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    const at = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(at) ? null : Math.max(0, Math.floor((now.getTime() - at) / 86400000));
  } catch {
    return null;
  }
}
