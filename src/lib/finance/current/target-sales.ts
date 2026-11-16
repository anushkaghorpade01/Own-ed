import {correctionCohortInputs,integratedCorrectionExperiment,type CorrectionExperiment} from './integrated-scenario';
import {simulateRenewalDelays,type Admission} from './renewal-simulation';
export type TargetBasis='retainedClosing'|'averageActivePackHolders'|'minimumActivePackHolders';
export function requiredNewForTargets(test:CorrectionExperiment,targets:number[],basis:TargetBasis){
 if(targets.length!==72||targets.some(n=>!Number.isFinite(n)||n<0)||!['retainedClosing','averageActivePackHolders','minimumActivePackHolders'].includes(basis))throw new Error('Supply72 nonnegative monthly customer targets and an explicit target basis.');
 const {cohortInputs,x,monthStart}=correctionCohortInputs(test);
 const simulate=(admissions:Admission[])=>simulateRenewalDelays({...cohortInputs,admissions,products:cohortInputs.products.map(p=>({...p,priceOn:()=>0}))});
 const existing=simulate(cohortInputs.admissions.filter(a=>a.id.startsWith('founders-')));
 const retained=existing.daily.map(d=>d.retained),active=existing.daily.map(d=>d.activePackHolders);
 const indices=Array.from({length:72},(_,i)=>existing.daily.flatMap((d,j)=>d.date.startsWith(monthStart(i).slice(0,7))?[j]:[]));
 const value=(i:number,a:number[],r:number[])=>basis==='retainedClosing'?r[indices[i].at(-1)!]:basis==='averageActivePackHolders'?indices[i].reduce((s,j)=>s+a[j],0)/indices[i].length:Math.min(...indices[i].map(j=>a[j]));
 const requested:number[]=[],before:number[]=[],unconstrained:number[]=[],structuralShortfall:number[]=[];
 for(let i=0;i<72;i++){
  const unit=simulate(['08','23'].flatMap(day=>[['8',x.mix[0]],['16',x.mix[1]]].flatMap(([product,share])=>Number(share)>1e-8?[{id:`inverse-${i}-${day}-${product}`,date:monthStart(i).slice(0,7)+'-'+day,customers:Number(share)/2,product:String(product)}]:[])));
  before.push(value(i,active,retained));let required=0,unreachable=0;
  if(basis==='minimumActivePackHolders')for(const j of indices[i]){const gap=targets[i]-active[j],response=unit.daily[j].activePackHolders;if(gap>1e-7){if(response>1e-8)required=Math.max(required,gap/response);else unreachable=Math.max(unreachable,gap);}}
  else {const response=basis==='retainedClosing'?unit.daily[indices[i].at(-1)!].retained:indices[i].reduce((s,j)=>s+unit.daily[j].activePackHolders,0)/indices[i].length;const gap=Math.max(0,targets[i]-before[i]);if(response>1e-8)required=gap/response;else unreachable=gap;}
  requested.push(required);structuralShortfall.push(unreachable);
  for(let j=0;j<active.length;j++){active[j]+=required*unit.daily[j].activePackHolders;retained[j]+=required*unit.daily[j].retained;}
  unconstrained.push(value(i,active,retained));
 }
 const experiment={...test,monthlyNewAcquisitions:requested,targetObjective:{basis,targets}};const result=integratedCorrectionExperiment(experiment);
 const rows=result.rows.map((m,i)=>({month:i+1,date:m.date,target:targets[i],existingBeforeNew:before[i],requiredNew:requested[i],admittedNew:m.newCustomersExFounders,unconstrainedMetric:unconstrained[i],achieved:m[basis],shortfall:Math.max(0,targets[i]-m[basis]),structuralShortfall:structuralShortfall[i],returningPackBuyers:m.packBuyers-m.newCustomersExFounders-m.founderAdmissions,returningBuyerIdentityBreach:m.packBuyers+1e-7<m.newCustomersExFounders+m.founderAdmissions}));
 return {basis,targets,experiment,result,rows,method:'Sequential least NEW in each month that reaches that month target given earlier requests, fixed pack mix and 8th/23rd start dates. Future renewal responses remain attached to those customers. Not a global minimum, optimal acquisition schedule or measured sales forecast. Capacity policy is then applied to the whole requested path; denied starts can leave later target shortfalls. Minimum-valid targets before the first possible start or during closure may be impossible under these dates. Fractions are expected customer equivalents, not a real intake schedule.'};
}
export function originalContinuingTargets(test:CorrectionExperiment){
 const {original}=correctionCohortInputs(test);return original.result.months.map(m=>m.members);
}
