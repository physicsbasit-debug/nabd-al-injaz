import { readTasks, STORAGE_KEY } from './task-model';
import { readPlans, PLAN_STORAGE_KEY } from './plan-model';
import { readSchedule, SCHEDULE_STORAGE_KEY } from './schedule-model';
import { readCoverStore, COVER_DRAFT_KEY } from './cover-planning';
import { readTechnicalTopics, TECHNICAL_FOLLOWUP_STORAGE_KEY } from './technical-followup-model';
import { SHORT_TEST_KEY } from './short-test-model';
import { ASSESSMENT_KEY } from './assessment-tracking';
import { PROFESSIONAL_DEVELOPMENT_KEY } from './professional-development-model';
import { SUPERVISORY_VISITS_KEY } from './supervisory-visits-model';
import { DUTY_ROUTINE_KEY } from './duty-routine';
import { TEACHER_PROFILES_KEY, isTeacherStore } from './teacher-profile-model';
import { SEMESTER_REPORT_KEY, isSemesterReportStore } from './semester-report-model';
export const RECOVERY_KEYS=[STORAGE_KEY,PLAN_STORAGE_KEY,SCHEDULE_STORAGE_KEY,COVER_DRAFT_KEY,TECHNICAL_FOLLOWUP_STORAGE_KEY,SHORT_TEST_KEY,ASSESSMENT_KEY,PROFESSIONAL_DEVELOPMENT_KEY,SUPERVISORY_VISITS_KEY,DUTY_ROUTINE_KEY,TEACHER_PROFILES_KEY,SEMESTER_REPORT_KEY];
const record=(x:unknown):x is Record<string,unknown> => !!x && typeof x==='object'&&!Array.isArray(x);

export function inspectStartupStorage():string[]{
 try{
  const issues:string[]=[];
  const taskRaw=localStorage.getItem(STORAGE_KEY),planRaw=localStorage.getItem(PLAN_STORAGE_KEY);
  if(taskRaw!==null){try{const data:unknown=JSON.parse(taskRaw);const tasks=readTasks();if(!Array.isArray(data)||tasks.length!==data.length||new Set(tasks.map(t=>t.id)).size!==tasks.length)issues.push('المهام');}catch{issues.push('المهام')}}
  if(planRaw!==null){try{const data:unknown=JSON.parse(planRaw);const plans=readPlans();if(!Array.isArray(data)||plans.length!==data.length||new Set(plans.map(p=>p.id)).size!==plans.length||data.some((item,i)=>{if(!item||typeof item!=='object'||Array.isArray(item))return true;const record=item as Record<string,unknown>;return record.activities!==undefined&&(!Array.isArray(record.activities)||record.activities.length!==plans[i]?.activities.length||new Set(plans[i]?.activities.map(a=>a.id)).size!==plans[i]?.activities.length)}))issues.push('الخطط');}catch{issues.push('الخطط')}}
  const checks:[string,string,(data:unknown)=>boolean][]=[
   [SCHEDULE_STORAGE_KEY,'الجداول',data=>{if(!record(data)||!Array.isArray(data.teachers)||!Array.isArray(data.lessons)||(data.verifiedDays!==undefined&&!Array.isArray(data.verifiedDays)))return false;const value=readSchedule();return value.teachers.length===data.teachers.length&&value.lessons.length===data.lessons.length&&(value.verifiedDays?.length??0)===(Array.isArray(data.verifiedDays)?data.verifiedDays.length:0)}],
   [TECHNICAL_FOLLOWUP_STORAGE_KEY,'المتابعة الفنية',data=>Array.isArray(data)&&readTechnicalTopics().length===data.length&&new Set(readTechnicalTopics().map(t=>t.id)).size===data.length],
   [COVER_DRAFT_KEY,'الاحتياط',data=>{if(!record(data)||data.version!==1||!record(data.days))return false;const value=readCoverStore();if(Object.keys(value.days).length!==Object.keys(data.days).length)return false;for(const [date,day] of Object.entries(data.days)){const saved=value.days[date];if(!record(day)||!saved||!Array.isArray(day.absent)||!Array.isArray(day.assignments)||saved.absent.length!==day.absent.length||saved.assignments.length!==day.assignments.length||(day.processedAt!==undefined&&saved.processedAt!==day.processedAt))return false}if(data.teacherPolicies!==undefined){if(!record(data.teacherPolicies)||Object.keys(value.teacherPolicies??{}).length!==Object.keys(data.teacherPolicies).length)return false;for(const [name,p] of Object.entries(data.teacherPolicies)){if(!record(p))return false;const normalized=value.teacherPolicies?.[name];if(!normalized||['exempt','carryInBalance','priority'].some(k=>p[k]!==undefined&&p[k]!==normalized[k as keyof typeof normalized]))return false}}return true}]
   ,[TEACHER_PROFILES_KEY,'ملفات المعلمين',data=>isTeacherStore(data)]
   ,[SEMESTER_REPORT_KEY,'ملاحظات التقرير الفصلي',data=>isSemesterReportStore(data)]
  ];
  for(const [key,name,valid] of checks){const raw=localStorage.getItem(key);if(raw!==null){try{if(!valid(JSON.parse(raw)))issues.push(name)}catch{issues.push(name)}}}
  return issues;
 }catch{return ['التخزين']}
}
