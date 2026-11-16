/** Expected-customer cohorts: each cohort owns its own credits. No credit transfer,
 * automatic breakage multiplier, or fractional pack purchase per customer.
 * This is an explicit-input engine, not the published forecast baseline. */
export type Product={id:string;credits:number;validDays:number;priceOn:(date:string)=>number};
export type CohortEvent=
 |{date:string;type:'join';id:string;product:string;customers:number}
 |{date:string;type:'leave';id:string;customers:number}
 |{date:string;type:'renew';id:string}
 |{date:string;type:'extend';days:number}
 |{date:string;type:'use';id:string;attendedPerCustomer:number;forfeitedPerCustomer:number;renewWhenEmpty:boolean};
export type OwnedPack={id:string;cohort:string;product:string;customers:number;soldOn:string;expiresOn:string;pricePerCustomer:number;issuedPerCustomer:number;remainingPerCustomer:number;servedPerCustomer:number;forfeitedPerCustomer:number;expiredPerCustomer:number;active:boolean};
export type LedgerLine={date:string;cohort:string;type:'purchase'|'attended'|'forfeited'|'expired'|'unserved';customers:number;credits:number;netSales:number;earnedRevenue:number};
const DAY=86400000,EPS=1e-8;
function timestamp(s:string){const t=Date.parse(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw new Error('Invalid ledger date.');return t;}
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
function nonnegative(v:number){if(!Number.isFinite(v)||v<0)throw new Error('Ledger amounts must be finite and nonnegative.');}
export function customerPackLedger(products:Product[],events:CohortEvent[],through:string){
 const end=timestamp(through);const catalog=new Map(products.map(p=>[p.id,p]));if(catalog.size!==products.length)throw new Error('Duplicate product.');
 for(const p of products){if(!p.id||!Number.isInteger(p.credits)||p.credits<1||!Number.isInteger(p.validDays)||p.validDays<1)throw new Error('Invalid pack product.');}
 const cohorts=new Map<string,{customers:number;product:string}>(),packs:OwnedPack[]=[],lines:LedgerLine[]=[];let seq=0;let lastExpiryDate='';const byCohort=new Map<string,OwnedPack[]>();
 const purchase=(id:string,date:string)=>{const c=cohorts.get(id)!;const p=catalog.get(c.product)!;const price=p.priceOn(date);nonnegative(price);packs.push({id:`pack-${++seq}`,cohort:id,product:p.id,customers:c.customers,soldOn:date,expiresOn:iso(timestamp(date)+p.validDays*DAY),pricePerCustomer:price,issuedPerCustomer:p.credits,remainingPerCustomer:p.credits,servedPerCustomer:0,forfeitedPerCustomer:0,expiredPerCustomer:0,active:true});byCohort.set(id,[...(byCohort.get(id)??[]),packs[packs.length-1]]);lines.push({date,cohort:id,type:'purchase',customers:c.customers,credits:p.credits*c.customers,netSales:price*c.customers,earnedRevenue:0});};
 const expire=(date:string)=>{if(lastExpiryDate===date)return;lastExpiryDate=date;for(const p of packs)if(p.remainingPerCustomer>EPS&&p.expiresOn<=date){lines.push({date:p.expiresOn,cohort:p.cohort,type:'expired',customers:p.customers,credits:p.remainingPerCustomer*p.customers,netSales:0,earnedRevenue:p.remainingPerCustomer/p.issuedPerCustomer*p.pricePerCustomer*p.customers});p.expiredPerCustomer+=p.remainingPerCustomer;p.remainingPerCustomer=0;}};
 // Caller supplies same-date ordering. This is important for departure/join/booking timing.
 const sorted=events.map((e,index)=>({e,index})).sort((a,b)=>timestamp(a.e.date)-timestamp(b.e.date)||a.index-b.index);
 for(const {e} of sorted){if(timestamp(e.date)>end)continue;if(e.type==='extend'){if(!Number.isInteger(e.days)||e.days<1)throw new Error('Extension days must be positive.');for(const p of packs)if(p.remainingPerCustomer>EPS&&p.expiresOn>e.date)p.expiresOn=iso(timestamp(p.expiresOn)+e.days*DAY);continue;}expire(e.date);
  if(e.type==='join'){nonnegative(e.customers);if(!e.id||cohorts.has(e.id)||!catalog.has(e.product)||e.customers===0)throw new Error('Invalid cohort admission.');cohorts.set(e.id,{customers:e.customers,product:e.product});purchase(e.id,e.date);continue;}
  const c=cohorts.get(e.id);if(!c)throw new Error('Unknown customer cohort.');
  if(e.type==='renew'){if(c.customers<EPS)throw new Error('Departed customers cannot renew.');purchase(e.id,e.date);continue;}
  if(e.type==='leave'){nonnegative(e.customers);if(e.customers>c.customers+EPS)throw new Error('Departures exceed active customers.');if(e.customers<EPS)continue;
   // Departing customers retain their own prepaid credits until expiry. No refund,
   // transfer or extra purchase is fabricated. Rejoining requires a new cohort ID.
   for(const p of byCohort.get(e.id)??[])if(p.active&&p.remainingPerCustomer>EPS){if(e.customers>=c.customers-EPS){p.active=false;}else{packs.push({...p,id:`pack-${++seq}`,customers:e.customers,active:false});p.customers-=e.customers;}}
   c.customers=Math.max(0,c.customers-e.customers);continue;
  }
  nonnegative(e.attendedPerCustomer);nonnegative(e.forfeitedPerCustomer);if(c.customers<EPS&&(e.attendedPerCustomer+e.forfeitedPerCustomer)>EPS)throw new Error('Departed customers cannot make active bookings.');
  for(const [kind,quantity] of [['attended',e.attendedPerCustomer],['forfeited',e.forfeitedPerCustomer]] as const){let need=quantity;let guard=0;while(need>EPS){if(++guard>10000)throw new Error('Too many packs for one booking event.');let p=(byCohort.get(e.id)??[]).find(p=>p.active&&p.remainingPerCustomer>EPS);if(!p){if(!e.renewWhenEmpty){lines.push({date:e.date,cohort:e.id,type:'unserved',customers:c.customers,credits:need*c.customers,netSales:0,earnedRevenue:0});break;}purchase(e.id,e.date);p=packs[packs.length-1];}const used=Math.min(need,p.remainingPerCustomer);p.remainingPerCustomer-=used;if(kind==='attended')p.servedPerCustomer+=used;else p.forfeitedPerCustomer+=used;lines.push({date:e.date,cohort:e.id,type:kind,customers:c.customers,credits:used*c.customers,netSales:0,earnedRevenue:used/p.issuedPerCustomer*p.pricePerCustomer*c.customers});need-=used;}}
 }
 expire(through);
 const sum=(f:(p:OwnedPack)=>number)=>packs.reduce((s,p)=>s+f(p)*p.customers,0);const issued=sum(p=>p.issuedPerCustomer),served=sum(p=>p.servedPerCustomer),forfeited=sum(p=>p.forfeitedPerCustomer),expired=sum(p=>p.expiredPerCustomer),outstanding=sum(p=>p.remainingPerCustomer),deferred=sum(p=>p.remainingPerCustomer/p.issuedPerCustomer*p.pricePerCustomer);
 const netSales=lines.reduce((s,l)=>s+l.netSales,0),earnedRevenue=lines.reduce((s,l)=>s+l.earnedRevenue,0);
 return {packs,lines,activeCustomers:[...cohorts.values()].reduce((s,c)=>s+c.customers,0),issued,served,forfeited,expired,outstanding,deferred,netSales,earnedRevenue,creditCheck:issued-served-forfeited-expired-outstanding,valueCheck:netSales-earnedRevenue-deferred};
}
export type PaidSessionInput={paidBookings:number;attended:number;noShows:number;cancelledRefunded:number;price:number;capacity:number;forfeitNoShow:boolean};
/** No attendance or no-show percentage is guessed. All counts must reconcile. */
export function paidSessions(x:PaidSessionInput){for(const v of [x.paidBookings,x.attended,x.noShows,x.cancelledRefunded,x.price,x.capacity])nonnegative(v);if(Math.abs(x.paidBookings-x.attended-x.noShows-x.cancelledRefunded)>EPS)throw new Error('Paid bookings must equal attended + no-show + cancelled/refunded.');if(x.attended+x.noShows>x.capacity+EPS)throw new Error('Bookings exceed sellable session capacity.');const retained=x.attended+(x.forfeitNoShow?x.noShows:0);return {paidBookings:x.paidBookings,attended:x.attended,noShows:x.noShows,refunds:(x.cancelledRefunded+(x.forfeitNoShow?0:x.noShows))*x.price,netSales:retained*x.price,visits:x.attended,occupiedBookings:x.attended+x.noShows,unsoldSeats:x.capacity-x.attended-x.noShows};}
