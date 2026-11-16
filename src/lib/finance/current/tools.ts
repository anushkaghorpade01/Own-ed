import {runPrimaryModel,type PrimaryOptions} from '../own-primary';
import {optionsFor,type Plan,type CaseName} from './plan';
export const TOOLS=['Capital payback','First profitable month','Break-even','Monthly sales target','IRR','NPV','Discount impact','Scenarios and sensitivity','Hiring','Adding a reformer','Schedule and capacity','Margins','Partner recovery','Cash and runway','Packs and credits','GST','Optimise'] as const;
export type Tool=typeof TOOLS[number];
export function solveMembers(plan:Plan,caseName:CaseName,month:number,profitTarget=0){
 const p=runPrimaryModel(optionsFor(plan,caseName));const max=p.effectiveCap;
 const calculate=(members:number)=>runPrimaryModel({...optionsFor(plan,caseName),caseName:'target',inputOverrides:{...p.inputs},privateRampMonths:p.inputs.privateRampMonths,churnOverride:p.inputs.scenarios[2].churn,presaleFounders:members,monthlyNetAdds:Array(72).fill(0),requestedMemberCap:max});
 let lo=0,hi=max;const high=calculate(hi);if(high.result.months[month-1].netProfit<profitTarget)return {feasible:false,members:max,model:high,target:profitTarget};
 for(let i=0;i<13;i++){const mid=(lo+hi)/2;if(calculate(mid).result.months[month-1].netProfit>=profitTarget)hi=mid;else lo=mid;}
 return {feasible:true,members:hi,model:calculate(hi),target:profitTarget};
}
export function hypotheticalOptions(base:PrimaryOptions,p:{reformers?:number;groups?:number;privates?:number;hire?:number;equipmentCost?:number}):PrimaryOptions{
 return {...base,reformers:p.reformers??base.reformers,weeklyGroupClasses:p.groups??base.weeklyGroupClasses,privateWeeklySlots:p.privates??base.privateWeeklySlots,hireMonthOverride:p.hire??base.hireMonthOverride,inputOverrides:{...base.inputOverrides,setupSpend:(base.inputOverrides?.setupSpend??3935000)+(p.equipmentCost??0)}};
}
