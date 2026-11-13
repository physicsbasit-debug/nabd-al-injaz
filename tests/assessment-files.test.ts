import { describe, expect, it } from 'vitest';
import { createAssessmentArchive, decodeAssessmentArchive } from '../src/assessment-files';
describe('assessment file backup', () => {
  it('preserves exact bytes and separates exam and analysis records', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const source = [{ id: 'f1', recordId: 'r1', kind: 'اختبار' as const, name: 'test.pdf', mime: 'application/pdf', size: bytes.length, createdAt: '2026-11-13T00:00:00Z', blob: new Blob([bytes], { type: 'application/pdf' }) }];
    const encoded = await createAssessmentArchive(source);
    const restored = decodeAssessmentArchive(encoded);
    expect(restored[0].kind).toBe('اختبار');
    expect(new Uint8Array(await restored[0].blob.arrayBuffer())).toEqual(bytes);
  });
  it('rejects mismatched bytes and invalid file kinds', async () => {
    const record = { id: 'f1', recordId: 'r1', kind: 'اختبار' as const, name: 'x.pdf', mime: 'application/pdf', size: 9, createdAt: '2026-11-13', blob: new Blob(['x']) };
    await expect(createAssessmentArchive([record])).rejects.toThrow();
    expect(() => decodeAssessmentArchive([{...record, kind:'غريب', base64:'eA=='}])).toThrow();
  });
});
