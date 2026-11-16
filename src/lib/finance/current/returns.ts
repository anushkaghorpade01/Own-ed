import type {ScenarioResult} from '../own-live';
export type CashFlow={month:number;amount:number};
export function npv(flows:CashFlow[],annualRate:number){if(!Number.isFinite(annualRate)||annualRate<=-1)throw new Error('Discount rate must be finite and above -100%.');return flows.reduce((s,f)=>{if(!Number.isFinite(f.amount)||!Number.isFinite(f.month)||f.month<0)throw new Error('Invalid dated cash flow.');return s+f.amount/Math.pow(1+annualRate,f.month/12);},0);}
/** Returns all sign-changing annualised roots, never picks a flattering root. */
export function irr(flows:CashFlow[]):{rates:number[];status:string}{
 if(!flows.some(f=>f.amount<0)||!flows.some(f=>f.amount>0))return {rates:[],status:'No IRR: cash flows need both an investment and a receipt.'};
 const roots:number[]=[];let left=-13.815510557964274;let lv=npv(flows,Math.expm1(left));
 for(let i=1;i<=600;i++){const right=-13.815510557964274+i*27.631021115928547/600;const rv=npv(flows,Math.expm1(right));if(Math.abs(rv)<1e-8&&!roots.some(r=>Math.abs(r-Math.expm1(right))<1e-7))roots.push(Math.expm1(right));if(Number.isFinite(lv)&&Number.isFinite(rv)&&lv*rv<0){let a=left,b=right,fa=lv;for(let j=0;j<80;j++){const mid=(a+b)/2,fm=npv(flows,Math.expm1(mid));if(fa*fm<=0)b=mid;else{a=mid;fa=fm;}}const root=Math.expm1((a+b)/2);if(!roots.some(r=>Math.abs(r-root)<1e-7))roots.push(root);}left=right;lv=rv;}
 const signs=flows.filter(f=>f.amount!==0).map(f=>Math.sign(f.amount));const changes=signs.slice(1).filter((s,i)=>s!==signs[i]).length;
 return {rates:roots,status:roots.length>1?'Multiple IRRs: no single return is selected.':roots.length===0?'No sign-changing IRR found in the searched range.':changes>1?'One root found; multiple cash-flow sign changes mean other/tangent roots may exist.':'One annualised IRR found.'};
}
export function cashPayback(flows:CashFlow[]){let balance=0;for(const f of [...flows].sort((a,b)=>a.month-b.month)){balance+=f.amount;if(f.month>0&&balance>=0)return f.month;}return null;}
export function returnFlows(result:ScenarioResult,funding:number,hisCapital:number,herCapital:number){return {
 project:[{month:0,amount:-funding},...result.months.map(m=>({month:m.month,amount:m.ebitda+m.fdInterest-m.tax-m.capex}))],
 his:[{month:0,amount:-hisCapital},...result.months.map(m=>({month:m.month,amount:m.partner}))],
 hers:[{month:0,amount:-herCapital},...result.months.map(m=>({month:m.month,amount:m.founder}))],
};}
export function alternativeFutureValue(flows:CashFlow[],annualRate:number,endMonth=72){if(annualRate<0||!Number.isFinite(annualRate))throw new Error('Use a finite nonnegative comparison assumption.');return flows.reduce((s,f)=>s+f.amount*Math.pow(1+annualRate,(endMonth-f.month)/12),0);}
export function discountImpact(price:number,credits:number,discount:number,consumablePerVisit:number,processingRate:number,gst:number){
 for(const n of [price,credits,discount,consumablePerVisit,processingRate,gst])if(!Number.isFinite(n)||n<0)throw new Error('Enter nonnegative values.');if(credits<=0||discount>=1||processingRate>=1)throw new Error('Credits must be positive and discount/payment rate below100%.');
 const contribution=(p:number)=>p-credits*consumablePerVisit-p*(1+gst)*processingRate;
 const newPrice=price*(1-discount),before=contribution(price),after=contribution(newPrice);
 return {newPrice,grossPrice:newPrice*(1+gst),before,after,perSession:after/credits,extraVolumePct:after>0?Math.max(0,before/after-1):null,contributionMargin:newPrice>0?after/newPrice:null};
}
