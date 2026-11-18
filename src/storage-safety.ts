import { readTasks, STORAGE_KEY } from './task-model';
import { readPlans, PLAN_STORAGE_KEY } from './plan-model';

export function inspectStartupStorage():string[]{
 try{
  const issues:string[]=[];
  const taskRaw=localStorage.getItem(STORAGE_KEY),planRaw=localStorage.getItem(PLAN_STORAGE_KEY);
  if(taskRaw!==null){try{const data:unknown=JSON.parse(taskRaw);const tasks=readTasks();if(!Array.isArray(data)||tasks.length!==data.length||new Set(tasks.map(t=>t.id)).size!==tasks.length)issues.push('المهام');}catch{issues.push('المهام')}}
  if(planRaw!==null){try{const data:unknown=JSON.parse(planRaw);const plans=readPlans();if(!Array.isArray(data)||plans.length!==data.length||new Set(plans.map(p=>p.id)).size!==plans.length||data.some((item,i)=>{if(!item||typeof item!=='object'||Array.isArray(item))return true;const record=item as Record<string,unknown>;return record.activities!==undefined&&(!Array.isArray(record.activities)||record.activities.length!==plans[i]?.activities.length||new Set(plans[i]?.activities.map(a=>a.id)).size!==plans[i]?.activities.length)}))issues.push('الخطط');}catch{issues.push('الخطط')}}
  return issues;
 }catch{return ['التخزين']}
}
