import type { Lesson } from './schedule-model';
import type { CoverAssignment } from './cover-planning';

/** Render only the saved local draft; uncovered or invalid slots remain explicit. */
export function generateCoverImage(date: string, day: string, absent: string[], slots: Lesson[], assignments: CoverAssignment[], invalidIds: Set<string>, processed: boolean): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء الصورة في هذا المتصفح.');
  const width = 1400, margin = 48, content = width - margin * 2;
  canvas.width = width;
  ctx.font = '30px sans-serif';
  const wrap = (value: string, max: number): string[] => {
    const words = value.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width <= max) { line = candidate; continue; }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (ctx.measureText(line + char).width > max && line) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ['—'];
  };
  const cols = [360, 420, 140, 384];
  const names = wrap(absent.join('، ') || 'لا يوجد', content - 50);
  const rows = [...slots].sort((a, b) => a.period - b.period || a.teacher.localeCompare(b.teacher, 'ar')).map((slot) => {
    const assignment = assignments.find((item) => item.lessonId === slot.id);
    const invalid = assignment && invalidIds.has(assignment.id);
    const values = [slot.teacher, slot.description || 'غير محدد', String(slot.period), invalid ? 'تكليف غير صالح — يلزم التصحيح' : assignment?.substitute || 'دون بديل'];
    return { cells: values.map((v, i) => wrap(v, cols[i] - 24)), warning: !assignment || invalid };
  });
  const headerHeight = 170 + names.length * 42;
  const heights = rows.map((row) => Math.max(72, Math.max(...row.cells.map((c) => c.length)) * 40 + 26));
  canvas.height = margin * 2 + headerHeight + 30 + 72 + heights.reduce((a, b) => a + b, 0);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, canvas.height);
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#005448'; ctx.fillRect(margin, margin, content, headerHeight);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText(day + ' | ' + date.split('-').reverse().join('-'), width - margin - 25, margin + 48);
  ctx.font = '30px sans-serif'; ctx.fillText(processed ? 'جدول توزيع الاحتياط' : 'مسودة توزيع الاحتياط — للمراجعة', width - margin - 25, margin + 103);
  ctx.fillText('المعلمون الغائبون:', width - margin - 25, margin + 150);
  names.forEach((line, i) => ctx.fillText(line, width - margin - 25, margin + 192 + i * 42));
  let y = margin + headerHeight + 30;
  ctx.fillStyle = '#005448'; ctx.fillRect(margin, y, content, 72);
  let x = width - margin;
  ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#fff';
  ['المعلم الغائب', 'الصف أو المادة', 'الحصة', 'المعلم البديل'].forEach((title, i) => { ctx.fillText(title, x - 12, y + 36); x -= cols[i]; });
  y += 72; ctx.font = '30px sans-serif';
  rows.forEach((row, index) => {
    const h = heights[index]; ctx.fillStyle = row.warning ? '#fbecef' : index % 2 ? '#f4f6f4' : '#fff'; ctx.fillRect(margin, y, content, h);
    x = width - margin; ctx.fillStyle = '#172a25';
    row.cells.forEach((lines, i) => { lines.forEach((line, n) => ctx.fillText(line, x - 12, y + 34 + n * 40)); x -= cols[i]; });
    ctx.strokeStyle = '#cdd7d2'; ctx.strokeRect(margin, y, content, h); y += h;
  });
  return canvas.toDataURL('image/png');
}
