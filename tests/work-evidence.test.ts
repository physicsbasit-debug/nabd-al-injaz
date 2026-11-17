import { describe, expect, it } from 'vitest';
import { encodeWorkEvidence, decodeWorkEvidence } from '../src/work-evidence';

describe('شواهد الأعمال', () => {
  it('يحفظ الشاهد ونوع العمل ويستعيد محتواه دون خلط المعرفات', async () => {
    const records = [{id:'e',ownerType:'task' as const,ownerId:'same',name:'test.pdf',mime:'application/pdf',size:3,createdAt:'2026-11-17T12:00:00Z',blob:new Blob(['pdf'],{type:'application/pdf'})}];
    const result=decodeWorkEvidence(await encodeWorkEvidence(records));
    expect(result[0].ownerType).toBe('task');
    expect(await result[0].blob.text()).toBe('pdf');
  });
  it('يدعم شواهد الاحتياط وسجلات الاختبارات والمراجعة دون خلط أنواعها', async () => {
    for (const ownerType of ['cover','assessment','review'] as const) {
      const records = [{id:ownerType,ownerType,ownerId:'same',name:'test.pdf',mime:'application/pdf',size:3,createdAt:'2026-11-17T12:00:00Z',blob:new Blob(['pdf'],{type:'application/pdf'})}];
      expect(decodeWorkEvidence(await encodeWorkEvidence(records))[0].ownerType).toBe(ownerType);
    }
  });
  it('يرفض مرفقات ذات بيانات أو حجم غير صالح', () => {
    expect(()=>decodeWorkEvidence([{id:'e',ownerType:'topic',ownerId:'a',name:'x.pdf',mime:'application/pdf',size:4,createdAt:'x',base64:'cGRm'}])).toThrow();
  });
});
