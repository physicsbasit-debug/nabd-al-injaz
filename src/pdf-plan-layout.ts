export type PdfPlanItem={str:string;x:number;y:number;width:number};
export type PdfPlanPage={page:number;items:PdfPlanItem[]};
export type ExtractedPlanActivity={text:string;page:number};
const normalize=(s:string)=>s.normalize('NFKC').replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[إأآ]/g,'ا');
/** Recognize the ministerial table by column headings, then assemble only bullet items in its activities column. */
export function extractPlanActivities(pages:PdfPlanPage[]):ExtractedPlanActivity[]|null {
 if(!pages.length)return null;
 const result:ExtractedPlanActivity[]=[];let previousEndsNearBottom=false;
 for(const page of pages){
  const head=page.items.find(i=>/الساليب والنشطة|الاساليب والانشطه|الاساليب والانشطة/.test(normalize(i.str)));
  const scope=page.items.find(i=>/المجال الاشرافي|المجال الشرافي/.test(normalize(i.str)));
  const period=page.items.find(i=>/فترة التنفيذ|فتره التنفيذ/.test(normalize(i.str)));
  const caption=page.items.find(i=>/الفعاليات/.test(normalize(i.str)));
  if(!head||!scope||!period||!caption)return null;
  const left=(head.x+period.x+period.width)/2; const right=(head.x+head.width+scope.x)/2;
  if(!(left<right))return null;
  const signature=page.items.filter(i=>/توقيع/.test(normalize(i.str)) && i.y<caption.y).map(i=>i.y);
  const bottom=signature.length?Math.max(...signature)+10:0;
  const selected=page.items.filter(i=>i.y<caption.y-3&&i.y>bottom&&i.x+i.width/2>=left&&i.x+i.width/2<right&&i.str.trim());
  selected.sort((a,b)=>b.y-a.y||b.x-a.x);
  const lines:{y:number;items:PdfPlanItem[]}[]=[];
  for(const item of selected){const row=lines.find(line=>Math.abs(line.y-item.y)<=3);if(row)row.items.push(item);else lines.push({y:item.y,items:[item]});}
  lines.sort((a,b)=>b.y-a.y);
  let active:ExtractedPlanActivity|null=null;
  for(const line of lines){
   const bullet=line.items.some(i=>/^[•●▪‣◦]$/.test(i.str.trim()));
   const text=line.items.filter(i=>!/^[•●▪‣◦]$/.test(i.str.trim())).sort((a,b)=>b.x-a.x).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' ').trim();
   if(bullet){active={page:page.page,text};result.push(active);}
   else if(!active && previousEndsNearBottom && result.length)active=result[result.length-1];
   if(!bullet&&active&&text)active.text=(active.text+' '+text).trim();
  }
  previousEndsNearBottom=!!active && lines.length>0 && lines[lines.length-1].y-bottom<65;
 }
 return result.filter(x=>x.text.length>=4);
}
