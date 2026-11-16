import {customerPackLedger,type CohortEvent,type Product} from './customer-ledger';
export type Admission={date:string;customers:number;product:string;id:string};
export type RenewalSimulationInput={from:string;through:string;products:(Product&{weeklyDesiredUse:number})[];admissions:Admission[];monthlyPermanentChurn:number;renewalDelayDays:number;seasonality:number[];closures?:{from:string;through:string;newAdmissions:'defer'|'skip'}[]};
const DAY=86400000,EPS=1e-8;
const stamp=(s:string)=>{const t=Date.parse(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw new Error('Invalid simulation date.');return t;};
const iso=(n:number)=>new Date(n).toISOString().slice(0,10);
/** Explicit scenario experiment only. Admission dates/delay/churn are supplied,
 * never inferred as measured facts. Churn permanently leaves once. Delays do not
 * generate extra churn, replacement buyers, visits or revenue. */
export function simulateRenewalDelays(x:RenewalSimulationInput){
 const start=stamp(x.from),end=stamp(x.through);if(end<start||end-start>3653*DAY)throw new Error('Invalid simulation horizon.');
 if(!Number.isFinite(x.monthlyPermanentChurn)||x.monthlyPermanentChurn<0||x.monthlyPermanentChurn>1||!Number.isInteger(x.renewalDelayDays)||x.renewalDelayDays<0)throw new Error('Invalid churn or delay input.');
 if(x.seasonality.length!==12||x.seasonality.some(n=>!Number.isFinite(n)||n<0))throw new Error('Twelve nonnegative seasonality factors required.');
 const products=new Map(x.products.map(p=>[p.id,p]));for(const p of x.products)if(!Number.isFinite(p.weeklyDesiredUse)||p.weeklyDesiredUse<0)throw new Error('Invalid use frequency.');
 const ids=new Set<string>();for(const a of x.admissions){if(ids.has(a.id)||!a.id||!products.has(a.product)||!Number.isFinite(a.customers)||a.customers<=0||stamp(a.date)<start||stamp(a.date)>end)throw new Error('Invalid admission.');ids.add(a.id);}
 type Cohort={id:string;product:string;customers:number;remaining:number;expires:number;renewAt:number|null};
 const closures=(x.closures??[]).map(c=>({...c,start:stamp(c.from),end:stamp(c.through)}));for(let i=0;i<closures.length;i++){const c=closures[i];if(c.end<c.start||c.start<start||c.end>end||!['defer','skip'].includes(c.newAdmissions)||closures.some((v,j)=>j!==i&&v.start<=c.end&&v.end>=c.start))throw new Error('Invalid or overlapping closure.');}
 const actualAdmissions=x.admissions.flatMap(a=>{const c=closures.find(c=>stamp(a.date)>=c.start&&stamp(a.date)<=c.end);return !c?[a]:c.newAdmissions==='skip'?[]:[{...a,date:iso(c.end+DAY)}];});
 if(actualAdmissions.some(a=>stamp(a.date)>end))throw new Error('Deferred admission falls after the scenario horizon; extend the horizon to retain this pending start.');
 const cohorts:Cohort[]=[],events:CohortEvent[]=[],daily:{date:string;retained:number;activePackHolders:number;betweenPacks:number;permanentlyLeft:number;newAdmissions:number;attended:number}[]=[];let left=0;
 const purchase=(c:Cohort,t:number)=>{const p=products.get(c.product)!;c.remaining=p.credits;c.expires=t+p.validDays*DAY;c.renewAt=null;};
 for(let t=start;t<=end;t+=DAY){const date=iso(t),day=new Date(t);let admitted=0,attended=0;
  if(day.getUTCDate()===1&&t>start)for(const c of cohorts){const lost=c.customers*x.monthlyPermanentChurn;if(lost>EPS){events.push({date,type:'leave',id:c.id,customers:lost});c.customers-=lost;left+=lost;}}
  const closure=closures.find(c=>t>=c.start&&t<=c.end);
  for(const a of actualAdmissions)if(a.date===date){const c:Cohort={id:a.id,product:a.product,customers:a.customers,remaining:0,expires:t,renewAt:null};purchase(c,t);cohorts.push(c);events.push({date,type:'join',id:a.id,product:a.product,customers:a.customers});admitted+=a.customers;}
  if(closure){events.push({date,type:'extend',days:1});for(const c of cohorts)if(c.remaining>EPS&&c.expires>t)c.expires+=DAY;}
  for(const c of cohorts){if(c.customers<EPS)continue;if(closure)continue;const p=products.get(c.product)!;
   if(t>=c.expires&&c.remaining>EPS){c.remaining=0;c.renewAt=t+x.renewalDelayDays*DAY;}
   if(c.remaining<=EPS&&c.renewAt!==null&&t>=c.renewAt){events.push({date,type:'renew',id:c.id});purchase(c,t);}
   if(c.remaining<=EPS)continue;
   const desired=p.weeklyDesiredUse*x.seasonality[day.getUTCMonth()]/7;
   let use=Math.min(desired,c.remaining);
   if(x.renewalDelayDays===0&&desired>c.remaining+EPS){events.push({date,type:'use',id:c.id,attendedPerCustomer:c.remaining,forfeitedPerCustomer:0,renewWhenEmpty:false});use=desired-c.remaining;attended+=c.remaining*c.customers;events.push({date,type:'renew',id:c.id});purchase(c,t);if(use>c.remaining+EPS)throw new Error('Daily use exceeds one additional whole pack; use smaller day events.');}
   if(use>EPS){events.push({date,type:'use',id:c.id,attendedPerCustomer:use,forfeitedPerCustomer:0,renewWhenEmpty:false});c.remaining-=use;attended+=use*c.customers;}
   if(c.remaining<=EPS){if(x.renewalDelayDays===0){events.push({date,type:'renew',id:c.id});purchase(c,t);}else c.renewAt=t+x.renewalDelayDays*DAY;}
  }
  const retained=cohorts.reduce((s,c)=>s+c.customers,0),active=cohorts.filter(c=>c.remaining>EPS&&c.expires>t).reduce((s,c)=>s+c.customers,0);daily.push({date,retained,activePackHolders:active,betweenPacks:retained-active,permanentlyLeft:left,newAdmissions:admitted,attended});
 }
 const ledger=customerPackLedger(x.products,events,x.through);
 const monthly=[...new Set(daily.map(d=>d.date.slice(0,7)))].map(month=>{const days=daily.filter(d=>d.date.startsWith(month)),last=days[days.length-1],lines=ledger.lines.filter(l=>l.date.startsWith(month));const buyers=new Map<string,number>();for(const line of lines)if(line.type==='purchase')buyers.set(line.cohort,Math.max(buyers.get(line.cohort)??0,line.customers));const packBuyers=[...buyers.values()].reduce((s,n)=>s+n,0),packPurchases=lines.filter(l=>l.type==='purchase').reduce((s,l)=>s+l.customers,0);const cumulative=ledger.lines.filter(l=>l.date<=last.date),outstandingValue=cumulative.reduce((s,l)=>s+l.netSales-l.earnedRevenue,0);return {month,outstandingValue,packBuyers,packPurchases,retainedClosing:last.retained,activePackHoldersClosing:last.activePackHolders,betweenPacksClosing:last.betweenPacks,minimumActivePackHolders:Math.min(...days.map(d=>d.activePackHolders)),maximumActivePackHolders:Math.max(...days.map(d=>d.activePackHolders)),averageActivePackHolders:days.reduce((s,d)=>s+d.activePackHolders,0)/days.length,permanentlyLeftCumulative:last.permanentlyLeft,newAdmissions:days.reduce((s,d)=>s+d.newAdmissions,0),attended:days.reduce((s,d)=>s+d.attended,0),packSales:lines.reduce((s,l)=>s+l.netSales,0),earnedRevenue:lines.reduce((s,l)=>s+l.earnedRevenue,0),expiredCredits:lines.filter(l=>l.type==='expired').reduce((s,l)=>s+l.credits,0)};});
 return {assumptions:{closures:closures.map(c=>({from:c.from,through:c.through,newAdmissions:c.newAdmissions})),expiryConvention:'expiresOn is the first invalid day, exclusive. Packs expiring on the first closure day were already invalid at start-of-day; no automatic revival. This date convention must be shown and can be changed only with consistent policy.',closureRules:'No sessions or repeat pack purchases during closure. Every currently valid unexpired pack gets one day validity extension per closure day. Existing renewal dates remain calendar dates but no purchases occur until reopening. Original permanent churn continues unchanged; no extra closure attrition/refunds assumed. New admission deferral/skip is explicitly supplied, not a forecast.',renewalDelayDays:x.renewalDelayDays,monthlyPermanentChurn:x.monthlyPermanentChurn,admissionDates:'Caller supplied exact dates; no hidden monthly backfill',attendance:'Desired service only while valid credits exist; no no-show rate supplied'},monthly,daily,ledger,events};
}
