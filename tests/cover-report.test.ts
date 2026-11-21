import {it,expect} from 'vitest';
import {buildCoverReport,filterCoverReport} from '../src/cover-report-model';
import type {Schedule} from '../src/schedule-model';
const schedule:Schedule={teachers:['أحمد','سالم'],lessons:[{id:'l',teacher:'أحمد',day:'الإثنين',period:1,description:'10/1'}],verifiedDays:[{teacher:'أحمد',day:'الإثنين'},{teacher:'سالم',day:'الإثنين'}]};
it('يعرض التكليف المحفوظ ويصفي باسم المعلم',()=>{const rows=buildCoverReport(schedule,{version:1,days:{'2026-11-16':{absent:['أحمد'],assignments:[{id:'a',date:'2026-11-16',lessonId:'l',absentTeacher:'أحمد',substitute:'سالم'}]}}});expect(rows[0].assignments[0].substitute).toBe('سالم');expect(filterCoverReport(rows,{teacher:'سالم',from:'',to:''})).toHaveLength(1);expect(filterCoverReport(rows,{teacher:'ناصر',from:'',to:''})).toHaveLength(0)});
