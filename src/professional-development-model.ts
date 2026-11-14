export const PROFESSIONAL_DEVELOPMENT_KEY = 'nabd-al-injaz:professional-development:v1';
export const PROGRAM_TYPES = ['مشغل', 'تدريب', 'قراءة موجّهة', 'حلقة نقاش', 'أخرى'] as const;
export type Attendance = 'حاضر' | 'غائب' | 'لم يُرصد';
export type ProfessionalProgram = { id:string; title:string; kind:typeof PROGRAM_TYPES[number]; date:string; period:string; presenter:string; notes:string; attendance:Record<string, Attendance> };
export function isProfessionalProgram(value:unknown): value is ProfessionalProgram {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string,unknown>;
  if (typeof p.id !== 'string' || !p.id.trim() || typeof p.title !== 'string' || !p.title.trim() || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || typeof p.period !== 'string' || typeof p.presenter !== 'string' || typeof p.notes !== 'string' || !PROGRAM_TYPES.includes(p.kind as typeof PROGRAM_TYPES[number])) return false;
  if (!p.attendance || typeof p.attendance !== 'object' || Array.isArray(p.attendance)) return false;
  return Object.entries(p.attendance).every(([name,status]) => !!name.trim() && (status === 'حاضر' || status === 'غائب' || status === 'لم يُرصد'));
}
export function readProfessionalPrograms():ProfessionalProgram[] {
  const raw:unknown = JSON.parse(localStorage.getItem(PROFESSIONAL_DEVELOPMENT_KEY) ?? '[]');
  if (!Array.isArray(raw) || !raw.every(isProfessionalProgram) || new Set(raw.map(p=>p.id)).size !== raw.length) throw new Error('تعذر قراءة برامج الإنماء المهني؛ لم تُغيّر البيانات.');
  return raw;
}
