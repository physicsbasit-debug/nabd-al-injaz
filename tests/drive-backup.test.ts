import { describe, it, expect, vi } from 'vitest';
import { listDriveBackups, uploadDriveBackup } from '../src/drive-backup';
describe('drive backup', () => {
 it('lists only application backup snapshots and sorts newest first', async () => {
  const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>({files:[{id:'a',name:'nabd-backup-1.json',modifiedTime:'2026-11-01T00:00:00Z'},{id:'b',name:'nabd-backup-2.json',modifiedTime:'2026-11-02T00:00:00Z'}]})});
  const files=await listDriveBackups('token', fetcher);
  expect(files.map(x=>x.id)).toEqual(['b','a']);
  expect(String(fetcher.mock.calls[0][0])).toContain('appDataFolder');
 });
 it('creates a new private snapshot rather than replacing existing files', async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'new'})});
  await uploadDriveBackup('token', new Blob(['{}'],{type:'application/json'}),fetcher);
  expect(fetcher.mock.calls[0][1].method).toBe('POST');
  expect(fetcher.mock.calls[0][1].body).toBeInstanceOf(Blob);
 });
 it('does not treat an authorization failure as an empty backup list', async () => {
  await expect(listDriveBackups('bad',vi.fn().mockResolvedValue({ok:false,status:401}))).rejects.toThrow();
 });
});
