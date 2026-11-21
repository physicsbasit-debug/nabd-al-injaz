/** Select page breaks above text and table rows whenever possible. */
export function paginateReport(height: number, pageHeight: number, protectedRanges: Array<[number, number]>): Array<[number, number]> {
  if (!Number.isFinite(height) || !Number.isFinite(pageHeight) || height <= 0 || pageHeight <= 0) return [];
  // Only keep blocks together when they fit on a page; taller blocks must be
  // allowed to flow so pagination always makes progress.
  const ranges = protectedRanges.filter(([top, bottom]) => Number.isFinite(top) && Number.isFinite(bottom) && bottom > top && bottom - top <= pageHeight);
  const pages: Array<[number, number]> = [];
  let start = 0;
  while (start < height) {
    let end = Math.min(start + pageHeight, height);
    if (end < height) {
      let previous: number;
      do {
        previous = end;
        for (const [top, bottom] of ranges) {
          if (top < end && bottom > end && top > start) end = top;
        }
      } while (end < previous);
    }
    pages.push([start, end]);
    start = end;
  }
  return pages;
}
