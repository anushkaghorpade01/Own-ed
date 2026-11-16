import {simulateRenewalDelays,type RenewalSimulationInput,type Admission} from './renewal-simulation';
/** Planning screen only. All expected existing returns retain first claim.
 * Never claims a real preferred-slot timetable or infers member no-shows. */
export function constrainRequestedAdmissions(input:RenewalSimulationInput,limits:{memberBookingsPerDay:number;groupBookingsPerDay:number;dropBookingsByMonth:Record<string,number>;lookaheadMonths?:number}){
 for(const n of [limits.memberBookingsPerDay,limits.groupBookingsPerDay,...Object.values(limits.dropBookingsByMonth)])if(!Number.isFinite(n)||n<0)throw new Error('Planning limits and paid drop-in reservations must be nonnegative.');
 const lookaheadMonths=limits.lookaheadMonths??24;
 if(!Number.isInteger(lookaheadMonths)||lookaheadMonths<0||lookaheadMonths>36)throw new Error('Capacity lookahead must be 0-36 whole months.');
 const last=new Date(input.through+'T00:00:00Z'),screenThrough=lookaheadMonths?new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+lookaheadMonths+1,0)).toISOString().slice(0,10):input.through;
 const tailDrops={...limits.dropBookingsByMonth};for(let n=1;n<=lookaheadMonths;n++){const d=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+n,1)),key=d.toISOString().slice(0,7);const matching=Object.keys(limits.dropBookingsByMonth).filter(k=>k.slice(5)===key.slice(5)).sort().at(-1);tailDrops[key]=matching?limits.dropBookingsByMonth[matching]:0;}
 const simulate=(admissions:Admission[])=>simulateRenewalDelays({...input,through:screenThrough,admissions,products:input.products.map(p=>({...p,priceOn:()=>0}))});
 const founders=input.admissions.filter(a=>a.id.startsWith('founders-'));
 const base=simulate(founders),member=base.daily.map(d=>d.attended);
 const group=base.daily.map(d=>{const date=new Date(d.date+'T00:00:00Z'),days=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();return d.attended+(tailDrops[d.date.slice(0,7)]??0)/days;});
 const baselineBreaches=base.daily.filter((d,i)=>member[i]>limits.memberBookingsPerDay+1e-7||group[i]>limits.groupBookingsPerDay+1e-7).map(d=>d.date);
 const batches=new Map<string,Admission[]>();for(const a of input.admissions.filter(a=>!a.id.startsWith('founders-'))){batches.set(a.date,[...(batches.get(a.date)??[]),a]);}
 const adjusted=[...founders],decisions:{scheduledDate:string;requested:number;admitted:number;unadmitted:number;bindingDate:string|null;bindingConstraint:string|null;reason:string}[]=[];
 for(const [date,batch] of [...batches.entries()].sort(([a],[b])=>a.localeCompare(b))){
  const requested=batch.reduce((s,a)=>s+a.customers,0),unit=simulate(batch.map(a=>({...a,customers:a.customers/requested})));let admitted=requested,bindingDate:string|null=null,bindingConstraint:string|null=null;
  const response=unit.daily.map(d=>d.attended);if(input.closures?.some(c=>date>=c.from&&date<=c.through&&c.newAdmissions==='skip')){admitted=0;bindingDate=date;bindingConstraint='Closure: skip NEW starts';}
  for(let i=0;i<response.length;i++){const v=response[i];if(v<=1e-9)continue;const before=admitted,memberRoom=Math.max(0,limits.memberBookingsPerDay-member[i])/v,groupRoom=Math.max(0,limits.groupBookingsPerDay-group[i])/v;admitted=Math.min(admitted,memberRoom,groupRoom);if(admitted<before-1e-8){bindingDate=unit.daily[i].date;bindingConstraint=memberRoom<=groupRoom?'Member reserved share':'All group bookings';}}
  admitted=Math.max(0,admitted);for(let i=0;i<response.length;i++){member[i]+=admitted*response[i];group[i]+=admitted*response[i];}
  if(admitted>1e-8)adjusted.push(...batch.map(a=>({...a,customers:a.customers*admitted/requested})));
  decisions.push({scheduledDate:date,requested,admitted,unadmitted:requested-admitted,bindingDate,bindingConstraint,reason:admitted+1e-7<requested?'Not admitted in this planning case; no sale or revenue. No automatic waitlist/defer/outreach.':'Requested starts fit the modeled daily-average planning response.'});
 }
 return {admissions:adjusted,decisions,baselineBreaches,screenThrough,lookaheadMonths,method:`Chronological first-claim admission rule, not an optimum. Each batch fits remaining daily-average expected responses through ${screenThrough}, including ${lookaheadMonths} months beyond reported financials. Existing returns first. No NEW starts after the reported horizon; tail paid drops repeat the latest supplied same-calendar-month count, solely to reserve capacity, with no tail revenue reported. Six operating days are averaged over seven calendar days; actual preferred slots and member no-shows are unverified. Finite-tail residual risk remains after ${screenThrough}; this is not a lifetime capacity guarantee.`};
}
