export type DemandCase = { name: string; founders: number; adds: number[]; churn: number };
export type ModelInputs = {
  opening: string; funding: number; setupSpend: number; partnerCapital: number;
  rent: number; rentGST: number; rentGSTDeadCost: boolean; outputGST: number;
  rentEscalation: number; priceEscalation: number; salaryEscalation: number; otherEscalation: number;
  pilatesSalary: number; strengthSalary: number; reception: number; other: number; marketing: number; founderDraw: number;
  consumablesPerVisit: number; paymentFee: number; strengthShare: number; otherVariablePerMember: number;
  pack8: number; pack16: number; complete: number; strength: number; privatePrice: number; dropIn: number;
  mix: number[]; frequency: number[]; strengthFrequency: number; seasonality: number[];
  planningCeiling: number; memberShare: number; expansionFill: number; bufferMonths: number;
  reformerCost: number; fdOn: boolean; fdRate: number; bankMonths: number;
  taxRate: number; depreciationMonthly: number; reserveRate: number; reserveBase: 'sales'|'ebitda';
  distributionOn: boolean; payout: number; partnerFirst: number; partnerAfter: number;
  packBreakage: number; privateStart: number; privateMature: number; privateRampMonths: number;
  privateRoomHours: number; privateCapacity: number; roomHours: number; weekdaySeatShare: number; weekdayFillGap: number;
  strengthCapacity: number; strengthSecondHireAt: number; strengthSecondSalary: number;
  pack8Weeks: number; pack16Weeks: number; waitlistMonths: number;
  scenarios: DemandCase[];
};
export const DEFAULT_INPUTS: ModelInputs = {
  opening:'2028-05-01',funding:5300000,setupSpend:4800000,partnerCapital:4100000,
  rent:170000,rentGST:.18,rentGSTDeadCost:true,outputGST:.05,
  rentEscalation:.05,priceEscalation:.05,salaryEscalation:.09,otherEscalation:.055,
  pilatesSalary:40000,strengthSalary:80000,reception:20000,other:40000,marketing:20000,founderDraw:70000,
  consumablesPerVisit:40,paymentFee:.02,strengthShare:.04,otherVariablePerMember:0,
  pack8:12000,pack16:22400,complete:15000,strength:5000,privatePrice:2250,dropIn:1700,
  mix:[.4,.2,.2,.2],frequency:[2,2.5,2,0],strengthFrequency:2,
  seasonality:[1.1,1,1,.8,.8,1,1,1,1,1.1,1.1,.7],
  planningCeiling:.75,memberShare:.85,expansionFill:.70,bufferMonths:4,
  reformerCost:160000,fdOn:true,fdRate:.065,bankMonths:1,
  taxRate:.25,depreciationMonthly:0,reserveRate:.06,reserveBase:'sales',
  distributionOn:true,payout:1,partnerFirst:.77,partnerAfter:.5,
  packBreakage:.10,privateStart:2,privateMature:10,privateRampMonths:24,
  privateRoomHours:1,privateCapacity:15,roomHours:65,weekdaySeatShare:.65,weekdayFillGap:.1,
  strengthCapacity:120,strengthSecondHireAt:40,strengthSecondSalary:55000,
  pack8Weeks:5,pack16Weeks:9,waitlistMonths:6,
  scenarios:[
    {name:'Downside',founders:4,adds:[2,1,.5,.2,.1,0],churn:.09},
    {name:'Conservative',founders:9,adds:[3,1.5,.75,.5,.2,0],churn:.075},
    {name:'Base',founders:13,adds:[5,2.5,1,.4,0,0],churn:.06},
    {name:'Target',founders:20,adds:[6,3,1.25,.25,0,0],churn:.05},
  ]
};
export const MODEL_NOTES = [
  'Working draft, not an investment-ready forecast. Historic snapshot anchors are comparison checks, never calibration targets.',
  'Demand is net of churn. Non-renewals increase replacement sales targets, not a second subtraction from paying actives. Fractional members and pack quantities are planning equivalents.',
  'Four projected member-demand weekly fills including the live queue must exceed 70% before class expansion. A positive live queue is required. Forecast weeks repeat a monthly member base with calendar seasonality; they are not measured booking evidence. Capacity changes only at the next month boundary, after the prior four completed weeks qualify. No calendar-forced purchases.',
  'Class ladder 25/30/35/40/50 is separate from reformers. Four reformers remain until at least 40 classes. A fifth reformer uses a positive live queue, demand above the protected cap, and a projected weekend-fill >=100% proxy; this is not measured peak-class evidence. Classes have decision priority, at most one capacity change per month. No sixth-reformer trigger is specified. Admission capacity = reformers x weekly classes x 75% x 85% / blended visits / MAX(seasonality). The 1.10 peak divisor explains 34.09, not 37.50, opening members.',
  'FIFO waitlist is exact at monthly-vintage level, expires after six months, and backfills in the same month as an expansion. Waitlisted prospects generate no revenue.',
  'Pack vintages are pooled expected credits, not individual clients. New/replacement customers buy a pack; further packs are bought only for service demand not covered by usable credits. Prices are fixed at purchase; sessions expire after 5/9 weeks. Breakage is separate from attendance.',
  'The 10% reserved pack-breakage assumption is from the legacy reference, not measured data. It is withheld from usable credits and expires on the original date. Unused usable credits can also expire. Edit it and compare.',
  'Headline sales and EBITDA use the supplied sale-basis convention: pack sales + term dues + delivered drop-ins/privates. Service-earned pack revenue and prepaid service obligations are reported separately. Sale-basis profit is not statutory accrual profit.',
  'Founders are opening actives, with initial packs billed in Month 1. No pre-opening collections or unserved founding-pack balances were supplied. This differs from a presale-funded opening and must be reconciled before relying on cash.',
  'Rs 53L funding less provisional Rs 48L setup gives Rs 5L opening cash. Setup is a single unresolved budget, not a vendor-verified asset schedule. Rs 5.17L still needs quotes; it does not gate expansion or distributions.',
  'The Rs 40k opening group-teaching line pays the founder through 25 classes; at 30 classes two juniors cost Rs 40k each and founder privates start. This is in addition to the separate Rs 70k founder operator draw, with possible overlap unresolved. The Rs 70k is from the later 19:56 operating summary; supersedes Rs 50k in the attachment. Private demand ramp 2 to 10 sessions/week over 24 months is a visible provisional assumption, capped at 15 and constrained by non-overlapping room hours.',
  'FD sweeps keep one month of expenses in bank; surplus is treated as callable FD, earning 6.5% annual interest. Early-break penalties and bank product terms are unknown. Combined bank + FD is the sole four-month buffer test.',
  'Reserve 6% is a cash allocation inside bank+FD, not another operating expense or extra cash gate. Default base is net sales, unresolved versus EBITDA. Distributions are quarterly from Year 2, after three positive months, limited to current-quarter post-tax operating profit less reserve and the single buffer; blocked payouts do not carry forward.',
  'Tax is a provisional 25% on positive monthly sale-basis EBITDA plus FD interest. Depreciation defaults to zero because no current asset schedule exists; optional depreciation changes the displayed net-profit proxy but has no tax shield. CA review is required for tax and statutory profit.',
  'Strength uses the same fixed product mix, with Complete counted once in unique members and again only in room usage. A second strength hire is demand-triggered at 40 strength users (provisional threshold), never at a fixed month.',
  'Weekday/weekend splits are planning allocations, not a slot schedule. Their weighted average reconciles; peak fill and room/staffing breaches remain visible. Legacy app pages outside the revised finance routes remain separate and must not be mixed with this plan.'
];
export type WaitVintage={arrival:number;expires:number;quantity:number;admitted:number;expired:number;remaining:number};
export type PackVintage={product:8|16;soldOn:string;expiresOn:string;quantity:number;price:number;issued:number;served:number;expired:number;remaining:number;usable:number;deferredValue:number};
export type Week={demandFill:number;waiting:number;week:number;start:string;end:string;month:number;stage:number;members:number;seats:number;visits:number;fill:number;qualifies:boolean;streak:number};
export type Month={
  month:number;date:string;year:number;stage:number;reformers:number;classes:number;instructors:number;cap:number;members:number;openingMembers:number;
  adds:number;churn:number;grossSalesTarget:number;newAdmissions:number;waiting:number;expiredWait:number;expansion:string;
  memberVisits:number;dropVisits:number;privateSessions:number;fill:number;weekdayFill:number;weekendFill:number;strengthMembers:number;pilatesMembers:number;
  pack8Sales:number;pack16Sales:number;dues:number;dropSales:number;privateSales:number;netSales:number;earnedRevenue:number;deferred:number;
  gstCollected:number;gstPaid:number;grossReceipts:number;fixed:number;variable:number;opex:number;ebitda:number;operatingProfit:number;
  fdInterest:number;tax:number;depreciation:number;netProfit:number;capex:number;reserve:number;distributions:number;partner:number;founder:number;partnerCumulative:number;
  openingCash:number;cashBeforePayout:number;bank:number;fd:number;cash:number;buffer:number;breach:boolean;solvent:boolean;
  packSessionsIssued:number;packSessionsServed:number;packSessionsExpired:number;packSessionsOutstanding:number;packCheck:number;
  groupPayroll:number;reformerGate:boolean;demandGate:boolean;cashGate:boolean;staffGate:boolean;gateBuffer:number;gateCash:number;roomBreach:boolean;strengthBreach:boolean;
};
export type ScenarioResult={name:string;months:Month[];weeks:Week[];waitlist:WaitVintage[];packs:PackVintage[];totalSales:number;totalEBITDA:number;totalProfit:number;totalDistributions:number;minCash:number;minCashMonth:number;breaches:number;firstNegative:number|null;partnerPayback:number|null;warnings:string[]};
const DAY=86400000;
const iso=(n:number)=>new Date(n).toISOString().slice(0,10);
const total=(a:number[])=>a.reduce((s,x)=>s+x,0);
const EPS=1e-7;
const STAGES=[{r:4,c:25},{r:4,c:30},{r:4,c:35},{r:4,c:40},{r:4,c:50}];
export function validateInputs(x:ModelInputs):string[]{
 const e:string[]=[];
 for(const [k,v] of Object.entries(x))if(typeof v==='number'&&(!Number.isFinite(v)||v<0))e.push(`${k} must be a finite non-negative number.`);
 if(!/^\d{4}-\d{2}-01$/.test(x.opening)||!Number.isFinite(Date.parse(x.opening)))e.push('Opening must be the first day of a valid month.');
 if(x.mix.length!==4||x.mix.some(v=>!Number.isFinite(v)||v<0)||Math.abs(total(x.mix)-1)>1e-8)e.push('Product mix must total 100%.');
 if(x.frequency.length!==4||x.frequency.some(v=>!Number.isFinite(v)||v<0)||total(x.frequency.map((v,i)=>v*x.mix[i]))<=0)e.push('Blended Pilates frequency must be positive.');
 if(x.seasonality.length!==12||x.seasonality.some(v=>!Number.isFinite(v)||v<=0))e.push('All 12 seasonal factors must be positive.');
 for(const k of ['outputGST','rentGST','rentEscalation','priceEscalation','salaryEscalation','otherEscalation','paymentFee','strengthShare','planningCeiling','memberShare','expansionFill','taxRate','reserveRate','payout','partnerFirst','partnerAfter','packBreakage','weekdaySeatShare'] as const)if(x[k]>1)e.push(`${k} cannot exceed 100%.`);
 if(x.memberShare<=0||x.planningCeiling<=0||x.weekdaySeatShare<=0||x.weekdaySeatShare>=1)e.push('Member share, planning ceiling and weekday split must be positive; weekday share must be below 100%.');
 if(x.packBreakage>=1)e.push('Breakage must be below 100%.');
 if(x.privateCapacity>15)e.push('Founder private capacity cannot exceed the locked 15 sessions/week.');
 if(x.privateStart>x.privateCapacity||x.privateMature>x.privateCapacity)e.push('Private demand cannot exceed private capacity.');
 if(x.pack8Weeks<=0||x.pack16Weeks<=0||!Number.isInteger(x.waitlistMonths)||x.waitlistMonths<1)e.push('Pack validity and whole-month waitlist expiry must be positive.');
 if(x.scenarios.length!==4)e.push('Exactly four demand scenarios are required.');
 for(const s of x.scenarios){if(!Number.isFinite(s.founders)||s.founders<0||!Number.isFinite(s.churn)||s.churn<0||s.churn>1||s.adds.length!==6||s.adds.some(v=>!Number.isFinite(v)||v<0))e.push(`${s.name}: founders, six annual net-add rates and churn must be valid.`);}
 return e;
}
export function runScenario(x:ModelInputs,which:number,options:{privatesBeforeHandover?:boolean;initialReformers?:number;fixedClasses?:boolean;privateHandoverMonth?:number;keepFounderTeachingPay?:boolean;privateWeeklySlots?:number;monthlyNetAdds?:number[];memberCap?:number;founderSingleSalary?:boolean;juniorFlatSalary?:number;capitalFirstWaterfall?:boolean;founderCapital?:number;postCapitalPayout?:number;capitalRecoveryPartnerShare?:number;fixedWeeklyClasses?:number;unitCostEscalation?:number;internStartMonth?:number;internMonthly?:number;grossSignupCap?:number;monthlyGrossSignupCaps?:number[]}={}):ScenarioResult{
 const stages=options.fixedWeeklyClasses===undefined?STAGES:STAGES.map(s=>({...s,c:options.fixedWeeklyClasses!}));
 if(options.fixedWeeklyClasses!==undefined&&(!Number.isInteger(options.fixedWeeklyClasses)||options.fixedWeeklyClasses<1))throw new Error('Weekly group classes must be a positive integer.');
 const errors=validateInputs(x);if(errors.length)throw new Error(errors.join(' '));
 const s=x.scenarios[which];if(!s)throw new Error('Unknown scenario.');
 const open=Date.parse(x.opening+'T00:00:00Z');const od=new Date(open);
 const blend=total(x.mix.map((v,i)=>v*x.frequency[i]));const peak=Math.max(...x.seasonality);
 if(options.initialReformers!==undefined&&(!Number.isInteger(options.initialReformers)||options.initialReformers<4||options.initialReformers>6))throw new Error('Initial reformers must be 4, 5 or 6.');
 let reformerCount=options.initialReformers??4;let stage=0,members=0,cash=x.funding-x.setupSpend,fd=0,partnerCumulative=0,streak=0,lastExpansion=-1;
 let weekStart=open,weekVisits=0,weekDemandVisits=0,weekDays=0,weekStage=0,weekSeats=100;
 let reserveHeld=0,quarterProfit=0,quarterReserve=0,founderCapitalReturned=0,quarterNetProfit=0;
 const months:Month[]=[],weeks:Week[]=[],waitlist:WaitVintage[]=[],packs:PackVintage[]=[];
 const warnings:string[]=[];
 let activePacks:PackVintage[]=[];
 const openingCap=reformerCount*stages[0].c*x.planningCeiling*x.memberShare/blend/peak;
 if(s.founders>openingCap)warnings.push('Founders exceed opening admission cap; excess enters the dated waitlist, with no revenue until admission.');
 // Prices rise each April; costs use operating-year anniversaries, disclosed in inputs.
 const priceFactor=(date:Date)=>Math.pow(1+x.priceEscalation,Math.max(0,date.getUTCFullYear()-od.getUTCFullYear()-(date.getUTCMonth()<3?1:0)+(od.getUTCMonth()<3?1:0)));
 const staffing=(st:number,strengthUsers:number,yr:number)=>{
  const salary=Math.pow(1+x.salaryEscalation,yr);
  return ((options.founderSingleSalary?0:Math.ceil(stages[st].c/25)*x.pilatesSalary)+x.strengthSalary+x.reception+(strengthUsers>=x.strengthSecondHireAt?x.strengthSecondSalary:0))*salary;
 };
 const fixedCost=(st:number,n:number,yr:number)=>x.rent*(1+(x.rentGSTDeadCost?x.rentGST:0))*Math.pow(1+x.rentEscalation,yr)+staffing(st,n*(x.mix[2]+x.mix[3]),yr)+(x.other+x.marketing)*Math.pow(1+x.otherEscalation,yr)+x.founderDraw;
 const buy=(product:8|16,quantity:number,day:number,price:number)=>{
  if(quantity<EPS)return;
  const vintage:PackVintage={product,soldOn:iso(day),expiresOn:iso(day+(product===8?x.pack8Weeks:x.pack16Weeks)*7*DAY),quantity,price,issued:quantity*product,served:0,expired:0,remaining:quantity*product,usable:quantity*product*(1-x.packBreakage),deferredValue:quantity*price};
  packs.push(vintage);activePacks.push(vintage);
 };
 for(let m=1;m<=72;m++){
  const d=new Date(Date.UTC(od.getUTCFullYear(),od.getUTCMonth()+m-1,1));const start=d.getTime();const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);const days=(end-start)/DAY;const year=Math.floor((m-1)/12);const factor=priceFactor(d);
  const openingMembers=members;const openingCash=cash;
  let expiredWait=0;
  for(const w of waitlist)if(w.expires<=m&&w.remaining>EPS){expiredWait+=w.remaining;w.expired+=w.remaining;w.remaining=0;}
  const adds=options.monthlyNetAdds?.[m-1]??s.adds[year];
  waitlist.push({arrival:m,expires:m+x.waitlistMonths,quantity:adds+(m===1?s.founders:0),admitted:0,expired:0,remaining:adds+(m===1?s.founders:0)});
  const queued=total(waitlist.map(w=>w.remaining));
  const privateRamp=Math.min(x.privateCapacity,x.privateStart+(x.privateMature-x.privateStart)*Math.min(1,(m-1)/Math.max(1,x.privateRampMonths-1)));
  // Waitlisted members count as unserved booked demand for the forecast trigger, never revenue.
  const liveQueue=queued>EPS;
  const demandGate=!options.fixedClasses&&stage<4&&streak>=4&&liveQueue&&weeks.length>0&&weeks[weeks.length-1].stage===stage;
  const demandMemberFill=(members+queued)*blend*x.seasonality[d.getUTCMonth()]/(reformerCount*stages[stage].c);
  const projectedWeekendFill=(demandMemberFill-Math.max(0,demandMemberFill-x.weekdayFillGap)*x.weekdaySeatShare)/(1-x.weekdaySeatShare);
  const currentCap=reformerCount*stages[stage].c*x.planningCeiling*x.memberShare/blend/peak;
  const reformerGate=!options.fixedClasses&&stages[stage].c>=40&&reformerCount===4&&liveQueue&&members+queued>currentCap+EPS&&projectedWeekendFill>=1-EPS;
  // At most one decision per month. Add classes first if their four-week gate passes.
  const addClasses=demandGate;
  const addReformer=!addClasses&&reformerGate;
  const next=addClasses?stage+1:stage;
  const nextReformers=reformerCount+(addReformer?1:0);
  const nextCap=Math.min(options.memberCap??Infinity,nextReformers*stages[next].c*x.planningCeiling*x.memberShare/blend/peak);
  const capexNext=addReformer?x.reformerCost:0;
  const nextMembers=Math.min(nextCap,members+queued);
  const forecastMemberVisits=nextMembers*blend*peak*days/7;
  const forecastGroupVisits=forecastMemberVisits/x.memberShare;
  const forecastStrengthVisits=nextMembers*(x.mix[2]+x.mix[3])*x.strengthFrequency*days/7;
  const forecastPrivateVisits=(next>0||options.privatesBeforeHandover||(options.privateHandoverMonth!==undefined&&m>=options.privateHandoverMonth))?x.privateCapacity*peak*days/7:0;
  const forecastPackValue=nextMembers*(x.mix[0]*x.pack8+x.mix[1]*x.pack16)*factor+(forecastMemberVisits/(1-x.packBreakage))*Math.max(x.pack8/8,x.pack16/16)*factor;
  const forecastDues=nextMembers*(x.mix[2]*x.complete+x.mix[3]*x.strength)*factor;
  const forecastReceipts=(forecastPackValue+forecastDues+forecastGroupVisits*x.dropIn*factor+forecastPrivateVisits*x.privatePrice*factor)*(1+x.outputGST);
  const forecastVariable=(forecastGroupVisits+forecastStrengthVisits+forecastPrivateVisits)*x.consumablesPerVisit*Math.pow(1+(options.unitCostEscalation??0),year)+forecastReceipts*x.paymentFee*Math.pow(1+(options.unitCostEscalation??0),year)+forecastDues*x.strengthShare+nextMembers*x.otherVariablePerMember;
  const extraFounderTeachingPay=options.keepFounderTeachingPay&&options.privateHandoverMonth!==undefined&&m>=options.privateHandoverMonth?x.pilatesSalary*Math.pow(1+x.salaryEscalation,year):0;
  const juniorPayroll=options.founderSingleSalary&&options.privateHandoverMonth!==undefined&&m>=options.privateHandoverMonth?(options.juniorFlatSalary??40000):(options.internStartMonth!==undefined&&m>=options.internStartMonth?(options.internMonthly??20000):0);
  const projectedOpex=fixedCost(next,nextMembers,year)+extraFounderTeachingPay+juniorPayroll+forecastVariable;
  const gateBuffer=x.bufferMonths*projectedOpex;
  const cashGate=cash-capexNext>=gateBuffer-EPS;
  const forecastPrivateDemand=(next>0||options.privatesBeforeHandover||(options.privateHandoverMonth!==undefined&&m>=options.privateHandoverMonth))?privateRamp:0;
  const staffGate=stages[next].c<=2*25&&stages[next].c+forecastPrivateDemand*x.privateRoomHours<=x.roomHours;
  let capex=0,expansion='';
  if((addClasses||addReformer)&&cashGate&&staffGate){stage=next;reformerCount=nextReformers;capex=capexNext;cash-=capex;expansion=`${reformerCount} reformers / ${stages[stage].c} classes`;lastExpansion=m;streak=0;}
  const reformers=reformerCount;const classes=stages[stage].c;const seats=reformers*classes;
  const privateDemand=(stage>0||options.privatesBeforeHandover||(options.privateHandoverMonth!==undefined&&m>=options.privateHandoverMonth))?privateRamp:0;
  const cap=Math.min(options.memberCap??Infinity,seats*x.planningCeiling*x.memberShare/blend/peak);
  let room=Math.max(0,cap-members),newAdmissions=0;
  const churn=openingMembers*s.churn;
  let replacements=churn;
  const grossSignupLimit=options.monthlyGrossSignupCaps?.[m-1]??options.grossSignupCap;
  if(grossSignupLimit!==undefined){
   if(!Number.isFinite(grossSignupLimit)||grossSignupLimit<0)throw new Error('Gross signup cap must be nonnegative');
   members=Math.max(0,openingMembers-churn);
   const presale=m===1?Math.min(s.founders,cap):0;members+=presale;
   const paidAdmissions=Math.min(grossSignupLimit,Math.max(0,cap-members));
   replacements=Math.min(churn,paidAdmissions);newAdmissions=presale+Math.max(0,paidAdmissions-replacements);
   members+=paidAdmissions;
   for(const w of waitlist){w.expired+=w.remaining;w.remaining=0;}
  }else{
   for(const w of waitlist){const admit=Math.min(room,w.remaining);w.admitted+=admit;w.remaining-=admit;room-=admit;members+=admit;newAdmissions+=admit;}
  }
  const grossSalesTarget=replacements+newAdmissions;
  const packStart=packs.length;const priorIssued=total(packs.map(p=>p.issued));const priorServed=total(packs.map(p=>p.served));const priorExpired=total(packs.map(p=>p.expired));
  buy(8,grossSalesTarget*x.mix[0],start,x.pack8*factor);buy(16,grossSalesTarget*x.mix[1],start,x.pack16*factor);
  let memberVisits=0,dropVisits=0,privateSessions=0,earnedPack=0,expiredValue=0;
  for(let day=start;day<end;day+=DAY){
   const season=x.seasonality[new Date(day).getUTCMonth()];
   for(const p of activePacks)if(p.remaining>EPS&&Date.parse(p.expiresOn+'T00:00:00Z')<=day){expiredValue+=p.remaining/p.product*p.price;p.expired+=p.remaining;p.remaining=0;p.usable=0;p.deferredValue=0;}
   activePacks=activePacks.filter(p=>p.remaining>EPS);
   for(const product of [8,16] as const){
    const ix=product===8?0:1;let need=members*x.mix[ix]*x.frequency[ix]*season/7;
    let available=total(activePacks.filter(p=>p.product===product).map(p=>p.usable));
    if(available+EPS<need){buy(product,(need-available)/(product*(1-x.packBreakage)),day,(product===8?x.pack8:x.pack16)*factor);available=need;}
    for(const p of activePacks){if(p.product!==product||p.usable<=EPS||need<=EPS)continue;const use=Math.min(need,p.usable);p.usable-=use;p.remaining-=use;p.served+=use;p.deferredValue=p.remaining/p.product*p.price;earnedPack+=use/product*p.price;need-=use;}
   }
   const visit=members*blend*season/7;const drops=visit*(1-x.memberShare)/x.memberShare;
   memberVisits+=visit;dropVisits+=drops;
   const privateAvailable=Math.max(0,(x.roomHours-classes)/x.privateRoomHours);
   privateSessions+=Math.min(Math.min(privateDemand,x.privateCapacity,privateAvailable)*season,options.privateWeeklySlots??Infinity)/7;
   // Only complete, non-overlapping seven-day weeks qualify. Stage changes invalidate mixed weeks.
   if(weekDays===0){weekStart=day;weekStage=stage;weekSeats=seats;}
   if(weekStage!==stage||weekSeats!==seats)weekStage=-1;
   weekVisits+=visit+drops;weekDemandVisits+=(members+total(waitlist.map(w=>w.remaining)))*blend*season/7;weekDays++;
   if(weekDays===7){const fill=weekVisits/weekSeats;const demandFill=weekDemandVisits/weekSeats;const qualifies=weekStage===stage&&weekStage>=0&&total(waitlist.map(w=>w.remaining))>EPS&&demandFill>x.expansionFill+EPS;streak=qualifies?streak+1:0;
    weeks.push({demandFill,waiting:total(waitlist.map(w=>w.remaining)),week:weeks.length+1,start:iso(weekStart),end:iso(day),month:m,stage:weekStage,members,seats:weekSeats,visits:weekVisits,fill,qualifies,streak});weekDays=0;weekVisits=0;weekDemandVisits=0;
   }
  }
  const pack8Sales=total(packs.slice(packStart).filter(p=>p.product===8).map(p=>p.quantity*p.price));const pack16Sales=total(packs.slice(packStart).filter(p=>p.product===16).map(p=>p.quantity*p.price));
  const dues=members*(x.mix[2]*x.complete+x.mix[3]*x.strength)*factor;
  const dropSales=dropVisits*x.dropIn*factor;const privateSales=privateSessions*x.privatePrice*factor;
  const netSales=pack8Sales+pack16Sales+dues+dropSales+privateSales;
  const earnedRevenue=earnedPack+expiredValue+dues+dropSales+privateSales;
  const gstCollected=netSales*x.outputGST;const gstPaid=gstCollected;const grossReceipts=netSales+gstCollected;
  const fixed=fixedCost(stage,members,year)+extraFounderTeachingPay+juniorPayroll;
  const strengthMembers=members*(x.mix[2]+x.mix[3]);const strengthRev=members*(x.mix[3]*x.strength+x.mix[2]*x.complete*x.strength/(x.strength+x.pack8))*factor;
  const unitCostFactor=Math.pow(1+(options.unitCostEscalation??0),year);
  const variable=(memberVisits+dropVisits+privateSessions+strengthMembers*x.strengthFrequency*days/7)*x.consumablesPerVisit*unitCostFactor+grossReceipts*x.paymentFee*unitCostFactor+strengthRev*x.strengthShare+members*x.otherVariablePerMember;
  const opex=fixed+variable;const ebitda=netSales-opex;
  const fdInterest=(x.fdOn?Math.max(0,fd):0)*x.fdRate*days/365;
  const tax=Math.max(0,ebitda+fdInterest)*x.taxRate;
  const depreciation=x.depreciationMonthly;const operatingProfit=ebitda-depreciation;const netProfit=ebitda+fdInterest-tax-depreciation;
  const reserve=Math.max(0,(x.reserveBase==='sales'?netSales:ebitda)*x.reserveRate);reserveHeld+=reserve;quarterReserve+=reserve;quarterProfit+=Math.max(0,ebitda-tax);quarterNetProfit+=netProfit;
  cash+=grossReceipts-gstPaid-opex-tax+fdInterest;
  const buffer=x.bufferMonths*opex;const cashBeforePayout=cash;
  const profitable3=months.length>=2&&ebitda>0&&months[months.length-1].ebitda>0&&months[months.length-2].ebitda>0;
  let distributions=0,postCapitalDistribution=0;
  if(m%3===0){if(x.distributionOn&&m>12&&profitable3){distributions=Math.max(0,Math.min((quarterProfit-quarterReserve)*x.payout,cash-buffer));if(options.capitalRecoveryPartnerShare!==undefined){distributions=Math.max(0,Math.min(Math.max(0,quarterNetProfit)*(options.postCapitalPayout??.98),cash-buffer));}else if(options.capitalFirstWaterfall&&options.postCapitalPayout!==undefined){const remainingCapital=Math.max(0,x.partnerCapital-partnerCumulative)+Math.max(0,(options.founderCapital??0)-founderCapitalReturned);const capitalPayment=Math.min(distributions,remainingCapital);if(capitalPayment>=remainingCapital-EPS){postCapitalDistribution=Math.max(0,Math.min(Math.max(0,quarterNetProfit-capitalPayment)*options.postCapitalPayout,cash-buffer-capitalPayment));distributions=capitalPayment+postCapitalDistribution;}}}quarterProfit=0;quarterReserve=0;quarterNetProfit=0;}
  if(options.capitalFirstWaterfall&&options.postCapitalPayout===undefined)distributions=Math.min(distributions,Math.max(0,x.partnerCapital-partnerCumulative)+Math.max(0,(options.founderCapital??0)-founderCapitalReturned));
  const recoveryPool=x.partnerFirst>0?Math.min(distributions,Math.max(0,x.partnerCapital-partnerCumulative)/x.partnerFirst):0;
  const recoveryShare=options.capitalRecoveryPartnerShare;
  const recoveryDistribution=recoveryShare!==undefined?Math.min(distributions,Math.max(0,(x.partnerCapital-partnerCumulative)/recoveryShare,((options.founderCapital??0)-founderCapitalReturned)/(1-recoveryShare))):0;
  const partner=recoveryShare!==undefined?recoveryDistribution*recoveryShare+(distributions-recoveryDistribution)*.5:options.capitalFirstWaterfall?Math.min(distributions-postCapitalDistribution,Math.max(0,x.partnerCapital-partnerCumulative))+postCapitalDistribution*.5:recoveryPool*x.partnerFirst+(distributions-recoveryPool)*x.partnerAfter;const founder=distributions-partner;
  if(recoveryShare!==undefined)founderCapitalReturned+=founder;else if(options.capitalFirstWaterfall)founderCapitalReturned+=founder-postCapitalDistribution*.5;
  partnerCumulative+=partner;cash-=distributions;
  fd=x.fdOn?Math.max(0,cash-x.bankMonths*opex):0;const bank=cash-fd;
  const fill=(memberVisits+dropVisits)/(seats*days/7);const weekdayFill=Math.max(0,fill-x.weekdayFillGap);const weekendFill=(fill-weekdayFill*x.weekdaySeatShare)/(1-x.weekdaySeatShare);
  const packSessionsIssued=total(packs.map(p=>p.issued))-priorIssued;const packSessionsServed=total(packs.map(p=>p.served))-priorServed;const packSessionsExpired=total(packs.map(p=>p.expired))-priorExpired;const packSessionsOutstanding=total(packs.map(p=>p.remaining));
  const packCheck=total(packs.map(p=>p.issued-p.served-p.expired-p.remaining));
  months.push({month:m,date:iso(start),year:year+1,stage,reformers,classes,instructors:Math.ceil(classes/25),cap,members,openingMembers,adds,churn,grossSalesTarget,newAdmissions,waiting:total(waitlist.map(w=>w.remaining)),expiredWait,expansion,
   memberVisits,dropVisits,privateSessions,fill,weekdayFill,weekendFill,strengthMembers,pilatesMembers:members*(1-x.mix[3]),pack8Sales,pack16Sales,dues,dropSales,privateSales,netSales,earnedRevenue,deferred:total(packs.map(p=>p.deferredValue)),
   gstCollected,gstPaid,grossReceipts,fixed,variable,opex,ebitda,operatingProfit,fdInterest,tax,depreciation,netProfit,capex,reserve,distributions,partner,founder,partnerCumulative,
   openingCash,cashBeforePayout,bank,fd,cash,buffer,breach:cash+EPS<buffer,solvent:cash>=-EPS,packSessionsIssued,packSessionsServed,packSessionsExpired,packSessionsOutstanding,packCheck,
   groupPayroll:options.founderSingleSalary?juniorPayroll:Math.ceil(classes/25)*x.pilatesSalary*Math.pow(1+x.salaryEscalation,year),reformerGate,demandGate,cashGate,staffGate,gateBuffer,gateCash:openingCash-capexNext,roomBreach:classes+privateDemand*x.privateRoomHours>x.roomHours, strengthBreach:strengthMembers>x.strengthCapacity});
 }
 void reserveHeld;void lastExpansion;
 const minCash=Math.min(...months.map(m=>m.cash));
 return {name:s.name,months,weeks,waitlist,packs,totalSales:total(months.map(m=>m.netSales)),totalEBITDA:total(months.map(m=>m.ebitda)),totalProfit:total(months.map(m=>m.netProfit)),totalDistributions:total(months.map(m=>m.distributions)),minCash,minCashMonth:months.find(m=>m.cash===minCash)!.month,breaches:months.filter(m=>m.breach).length,firstNegative:months.find(m=>!m.solvent)?.month??null,partnerPayback:months.find(m=>m.partnerCumulative>=x.partnerCapital-EPS)?.month??null,warnings};
}
export function runAll(x:ModelInputs){return x.scenarios.map((_,i)=>runScenario(x,i));}
export const sumMonths=(ms:Month[],key:keyof Month)=>ms.reduce((s,m)=>s+(typeof m[key]==='number'?m[key] as number:0),0);
export function aggregate(ms:Month[]){const last=ms[ms.length-1];return {from:ms[0].month,to:last.month,members:last.members,fill:sumMonths(ms,'memberVisits')+sumMonths(ms,'dropVisits')? (sumMonths(ms,'memberVisits')+sumMonths(ms,'dropVisits'))/ms.reduce((s,m)=>s+m.reformers*m.classes*(new Date(Date.UTC(+m.date.slice(0,4),+m.date.slice(5,7),1)).getTime()-Date.parse(m.date+'T00:00:00Z'))/DAY/7,0):0,netSales:sumMonths(ms,'netSales'),opex:sumMonths(ms,'opex'),ebitda:sumMonths(ms,'ebitda'),operatingProfit:sumMonths(ms,'operatingProfit'),netProfit:sumMonths(ms,'netProfit'),cash:last.cash,distributions:sumMonths(ms,'distributions'),partner:sumMonths(ms,'partner'),founder:sumMonths(ms,'founder'),capex:sumMonths(ms,'capex')};}
