import {it,expect} from 'vitest';
import {constrainRequestedAdmissions} from './constrained-admissions';
import type {RenewalSimulationInput} from './renewal-simulation';
import {runPrimaryModel} from '../own-primary';
it('records finite capacity-tail sensitivity over two churn cases',()=>{
const results=[];for(const churn of [.03,.06])for(const tail of [0,12,24,36]){
const input:RenewalSimulationInput={from:'2028-05-01',through:'2034-04-30',monthlyPermanentChurn:churn,renewalDelayDays:0,seasonality:[1.1,1,1,.8,.8,1,1,1,1,1.1,1.1,.7],products:[{id:'8',credits:8,validDays:35,weeklyDesiredUse:2,priceOn:()=>12000},{id:'16',credits:16,validDays:63,weeklyDesiredUse:2.5,priceOn:()=>22400}],admissions:[{id:'founders-8',date:'2028-05-01',customers:16/3,product:'8'},{id:'founders-16',date:'2028-05-01',customers:8/3,product:'16'},...Array.from({length:72},(_,i)=>{const d=new Date(Date.UTC(2028,4+i,1)).toISOString().slice(0,7);return ['08','23'].flatMap(day=>[{id:`${i}-${day}-8`,date:d+'-'+day,customers:4/3,product:'8'},{id:`${i}-${day}-16`,date:d+'-'+day,customers:2/3,product:'16'}]);}).flat()]};
const r=constrainRequestedAdmissions(input,{memberBookingsPerDay:6*24*.92*.9/7,groupBookingsPerDay:6*24*.92/7,dropBookingsByMonth:Object.fromEntries(runPrimaryModel().result.months.map(m=>[m.date.slice(0,7),m.dropVisits])),lookaheadMonths:tail});const last=r.decisions.filter(d=>d.scheduledDate>='2033-05-01').reduce((s,d)=>s+d.admitted,0);results.push({churn,tail,admitted:r.decisions.reduce((s,d)=>s+d.admitted,0),last12: last,screenThrough:r.screenThrough});expect(r.decisions.every(d=>d.admitted<=d.requested+1e-7)).toBe(true);
}expect(results).toHaveLength(8);console.log(JSON.stringify(results));},120000);
