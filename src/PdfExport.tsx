import { useEffect, useRef, useState } from 'react';
import { paginateReport } from './pdf-pagination';

export function PdfExport({ disabled, filename }: { disabled: boolean; filename: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const urlRef = useRef('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const report = anchor.current?.closest('.reports')?.querySelector('.report-preview');
    const invalidate = () => {
      generation.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = ''; setUrl('');
    };
    const observer = new MutationObserver(invalidate);
    if (report) observer.observe(report, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); invalidate(); };
  }, []);

  useEffect(() => {
    if (disabled) {
      generation.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = ''; setUrl('');
    }
  }, [disabled]);

  async function createPdf() {
    if (busy || disabled) return;
    const current = ++generation.current;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = ''; setUrl(''); setError(''); setBusy(true);
    let frame: HTMLIFrameElement | undefined;
    try {
      const source = anchor.current?.closest('.reports')?.querySelector<HTMLElement>('.report-preview');
      if (!source) throw new Error('التقرير غير متاح');
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
      await document.fonts?.ready;
      frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      Object.assign(frame.style, { position: 'fixed', top: '0', left: '-10000px', width: '1100px', height: '900px', border: '0' });
      document.body.appendChild(frame);
      const doc = frame.contentDocument;
      if (!doc) throw new Error('تعذر تجهيز التقرير');
      doc.documentElement.lang = 'ar'; doc.documentElement.dir = 'rtl';
      const styles = Array.from(document.head.querySelectorAll('style, link[rel=stylesheet]')).map(node => {
        const copy = node.cloneNode(true) as HTMLElement;
        const loaded = copy.tagName === 'LINK' ? new Promise<void>(resolve => { copy.onload = () => resolve(); copy.onerror = () => resolve(); }) : Promise.resolve();
        doc.head.appendChild(copy); return loaded;
      });
      await Promise.all(styles); await doc.fonts?.ready;
      Object.assign(doc.body.style, { margin: '0', width: '794px', background: '#fff', direction: 'rtl' });
      const style = doc.createElement('style');
      style.textContent = '.report-preview { width:794px !important; max-width:none !important; box-sizing:border-box; border:0; border-radius:0 } .report-table-wrap { overflow:visible !important } .report-preview table { min-width:0 !important; table-layout:fixed } .report-preview th,.report-preview td { overflow-wrap:anywhere }';
      doc.head.appendChild(style);
      const clone = source.cloneNode(true) as HTMLElement;
      clone.querySelectorAll<HTMLDetailsElement>('details').forEach(el => { el.open = true; });
      [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))].forEach(el => el.style.setProperty('letter-spacing', 'normal', 'important'));
      doc.body.appendChild(clone);
      await Promise.all(Array.from(clone.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)));
      const base = clone.getBoundingClientRect();
      const ranges: Array<[number, number]> = Array.from(clone.querySelectorAll('tr,p,h1,h2,h3,h4,li')).map(el => {
        const rect = el.getBoundingClientRect(); return [Math.max(0, rect.top - base.top - 3), rect.bottom - base.top + 3];
      });
      const pages = paginateReport(Math.ceil(base.height), 1088, ranges);
      if (!pages.length) throw new Error('التقرير فارغ');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < pages.length; i++) {
        const [top, bottom] = pages[i];
        const canvas = await html2canvas(clone, { backgroundColor: '#fff', scale: 1.4, x: 0, y: top, width: 794, height: bottom - top, windowWidth: 1100, logging: false, useCORS: true });
        if (i) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 6, 6, 198, (bottom - top) * 198 / 794, undefined, 'FAST');
        canvas.width = 0; canvas.height = 0;
      }
      if (generation.current !== current) throw new Error('changed');
      urlRef.current = URL.createObjectURL(pdf.output('blob')); setUrl(urlRef.current);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'changed' ? 'تغيرت بيانات التقرير أثناء التصدير، أعد المحاولة.' : 'تعذر إنشاء ملف PDF. حاول مرة أخرى، وإذا استمرت المشكلة جرّب متصفحًا آخر.');
    } finally { frame?.remove(); setBusy(false); }
  }
  return <div className="pdf-export-control" ref={anchor}>
    <button type="button" disabled={disabled || busy} onClick={createPdf}>{busy ? 'جارٍ إعداد ملف PDF…' : 'تصدير PDF'}</button>
    {url && <p role="status"><a href={url} download={filename}>تنزيل ملف PDF</a> الملف جاهز للتنزيل.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
