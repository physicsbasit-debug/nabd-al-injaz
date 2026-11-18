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

describe('حماية الجداول والاحتياط والمتابعة الفنية',()=>{
 it.each([['nabd-al-injaz:schedules:v1','الجداول'],['nabd-al-injaz:cover-drafts:v1','الاحتياط'],['nabd-al-injaz:technical-followup:v1','المتابعة الفنية']])('يرفض التلف في %s قبل الحفظ',(key,name)=>{storage({[key]:'{broken'});expect(inspectStartupStorage()).toContain(name)});
 it('يرفض سجل حصة غير صالح حتى لا تحذف عند التطبيع',()=>{storage({'nabd-al-injaz:schedules:v1':JSON.stringify({teachers:['أحمد'],lessons:[{id:'x',teacher:'أحمد',day:'الجمعة',period:1,description:''}]})});expect(inspectStartupStorage()).toContain('الجداول')});
 it('يرفض سجل احتياط غير صالح دون حذفه',()=>{storage({'nabd-al-injaz:cover-drafts:v1':JSON.stringify({version:1,days:{'2026-11-18':{absent:['أحمد'],assignments:[null]}}})});expect(inspectStartupStorage()).toContain('الاحتياط')});
});

describe('قراءة السجلات الأخرى ترفض البيانات التالفة',()=>{
 it('لا تقبل الزيارات والبرامج والاختبارات سجلات غير صالحة',async()=>{
  const {readSupervisoryVisits,SUPERVISORY_VISITS_KEY}=await import('../src/supervisory-visits-model');
  const {readProfessionalPrograms,PROFESSIONAL_DEVELOPMENT_KEY}=await import('../src/professional-development-model');
  const {readAssessments,ASSESSMENT_KEY}=await import('../src/assessment-tracking');
  const {readShortTests,SHORT_TEST_KEY}=await import('../src/short-test-model');
  for(const [key,read] of [[SUPERVISORY_VISITS_KEY,readSupervisoryVisits],[PROFESSIONAL_DEVELOPMENT_KEY,readProfessionalPrograms],[ASSESSMENT_KEY,readAssessments],[SHORT_TEST_KEY,readShortTests]] as const){storage({[key]:'[null]'});expect(()=>read()).toThrow();expect(localStorage.getItem(key)).toBe('[null]');}
 });
});
