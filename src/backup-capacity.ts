/** Estimate UTF-8 JSON size when file payloads are replaced by empty base64 strings. */
export function projectedBackupBytes(stub: unknown, payloadSizes: number[]): number {
  return new Blob([JSON.stringify(stub)]).size + payloadSizes.reduce((sum, size) => sum + 4 * Math.ceil(size / 3), 0);
}

export function assertVisitBackupCapacity(bytes: number, maxBytes: number, visitFileCount: number): void {
  if (visitFileCount > 1000 || bytes > maxBytes)
    throw new Error('لا يمكن إرفاق الشاهد لأن النسخة الكاملة ستتجاوز الحد المدعوم. خفف حجم الملفات أو عددها أولًا.');
}
