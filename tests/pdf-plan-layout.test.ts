import {describe,it,expect} from 'vitest';
import {extractPlanActivities} from '../src/pdf-plan-layout';
const cell=(str:string,x:number,y:number,width=30)=>({str,x,y,width});
const heading=[cell('المجال الشرافي',740,368),cell('الساليب والنشطة',645,374),cell('(الفعاليات)',656,362),cell('فترة التنفيذ',525,374)];
describe('PDF plan table extraction',()=>{
 it('assembles bullet lines in the activity column and excludes headers, dates and other columns',()=>{
  const rows=extractPlanActivities([{page:1,items:[...heading,cell('تحليل أول',660,344),cell('•',698,344,3),cell('اختبار قصير',660,332),cell('2026/09/01',564,345),cell('النجاز الدراسي',738,344),cell('•',698,250,3),cell('تدريب الطلبة',660,250),cell('توقيع المعلم',650,50)]}]);
  expect(rows).not.toBeNull();expect(rows?.map(x=>x.text)).toEqual(['تحليل أول اختبار قصير','تدريب الطلبة']);
 });
 it('joins continuation at the top of the following page without treating it as a new activity',()=>{
  const rows=extractPlanActivities([{page:1,items:[...heading,cell('•',698,100,3),cell('إعداد قائمة',660,100),cell('توقيع المعلم',650,50)]},{page:2,items:[...heading,cell('بالطلبة المستهدفين',650,344),cell('•',698,200,3),cell('متابعة التنفيذ',650,200)]}]);
  expect(rows?.map(x=>x.text)).toEqual(['إعداد قائمة بالطلبة المستهدفين','متابعة التنفيذ']);
 });
 it('declines an unrecognized document rather than guessing the column',()=>expect(extractPlanActivities([{page:1,items:[cell('قائمة أخرى',200,300)]}])).toBeNull());
});
