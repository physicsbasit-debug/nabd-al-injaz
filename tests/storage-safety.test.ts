import { describe,it,expect,vi,afterEach } from 'vitest';
import { inspectStartupStorage } from '../src/storage-safety';
import { STORAGE_KEY } from '../src/task-model';
import { PLAN_STORAGE_KEY } from '../src/plan-model';
afterEach(()=>vi.unstubAllGlobals());
function storage(entries:Record<string,string>){vi.stubGlobal('localStorage',{getItem:(key:string)=>entries[key]??null});}
describe('حماية البيانات عند فتح التطبيق',()=>{
 it('يرفض النص التالف ويحافظ على السجلات المختلطة غير الصالحة',()=>{storage({[PLAN_STORAGE_KEY]:'{bad'});expect(inspectStartupStorage()).toContain('الخطط');storage({[STORAGE_KEY]:JSON.stringify([{id:'broken'}])});expect(inspectStartupStorage()).toContain('المهام');});
 it('يكتشف نشاط خطة تالف دون حذفه',()=>{storage({[PLAN_STORAGE_KEY]:JSON.stringify([{id:'p',title:'خطة',activities:[null]}])});expect(inspectStartupStorage()).toContain('الخطط');});
 it('يسمح بالبيانات القديمة الصالحة وغياب البيانات',()=>{storage({});expect(inspectStartupStorage()).toEqual([]);storage({[STORAGE_KEY]:JSON.stringify([{id:'t',title:'مهمة',dueDate:'',priority:'عادية',done:false,createdAt:'2026-01-01T00:00:00Z'}]),[PLAN_STORAGE_KEY]:JSON.stringify([{id:'p',title:'خطة',activities:[]}])});expect(inspectStartupStorage()).toEqual([]);});
 it('يوقف التشغيل عندما يتعذر الوصول للتخزين',()=>{vi.stubGlobal('localStorage',{getItem:()=>{throw Error('denied')}});expect(inspectStartupStorage()).toContain('التخزين');});
});
