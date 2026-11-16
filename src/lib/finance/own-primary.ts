import { runScenario, type ModelInputs } from './own-live';

/** Primary teacher-first financial model shared by the Math interface and tests. */
export const PRIMARY_INPUTS: ModelInputs = {
  "opening": "2028-05-01",
  "funding": 4500000,
  "setupSpend": 3935000,
  "partnerCapital": 3500000,
  "rent": 69062.5,
  "rentGST": 0.18,
  "rentGSTDeadCost": true,
  "outputGST": 0.05,
  "rentEscalation": 0.05,
  "priceEscalation": 0.025,
  "salaryEscalation": 0,
  "otherEscalation": 0.05,
  "pilatesSalary": 40000,
  "strengthSalary": 0,
  "reception": 20000,
  "other": 40000,
  "marketing": 20000,
  "founderDraw": 70000,
  "consumablesPerVisit": 40,
  "paymentFee": 0.02,
  "strengthShare": 0,
  "otherVariablePerMember": 0,
  "pack8": 12000,
  "pack16": 22400,
  "complete": 15000,
  "strength": 5000,
  "privatePrice": 2250,
  "dropIn": 1700,
  "mix": [
    0.6666666666666666,
    0.3333333333333333,
    0,
    0
  ],
  "frequency": [
    2,
    2.5,
    2,
    0
  ],
  "strengthFrequency": 0,
  "seasonality": [
    1.1,
    1,
    1,
    0.8,
    0.8,
    1,
    1,
    1,
    1,
    1.1,
    1.1,
    0.7
  ],
  "planningCeiling": 0.95,
  "memberShare": 0.85,
  "expansionFill": 0.7,
  "bufferMonths": 3,
  "reformerCost": 160000,
  "fdOn": true,
  "fdRate": 0.065,
  "bankMonths": 1,
  "taxRate": 0.312,
  "depreciationMonthly": 0,
  "reserveRate": 0.06,
  "reserveBase": "sales",
  "distributionOn": true,
  "payout": 1,
  "partnerFirst": 0.77,
  "partnerAfter": 0.5,
  "packBreakage": 0.1,
  "privateStart": 2,
  "privateMature": 12,
  "privateRampMonths": 12,
  "privateRoomHours": 1,
  "privateCapacity": 12,
  "roomHours": 65,
  "weekdaySeatShare": 0.65,
  "weekdayFillGap": 0.1,
  "strengthCapacity": 120,
  "strengthSecondHireAt": 40,
  "strengthSecondSalary": 55000,
  "pack8Weeks": 5,
  "pack16Weeks": 9,
  "waitlistMonths": 6,
  "scenarios": [
    {
      "name": "Downside",
      "founders": 4,
      "adds": [
        2,
        1.6,
        1.2000000000000002,
        0.8,
        0.4,
        0
      ],
      "churn": 0.09
    },
    {
      "name": "Conservative",
      "founders": 9,
      "adds": [
        3,
        2.4,
        1.7999999999999998,
        1.2,
        0.6,
        0
      ],
      "churn": 0.075
    },
    {
      "name": "Base",
      "founders": 8,
      "adds": [
        5,
        4,
        3,
        2,
        1,
        0
      ],
      "churn": 0.06
    },
    {
      "name": "Target",
      "founders": 20,
      "adds": [
        7,
        5,
        4,
        3,
        2,
        1
      ],
      "churn": 0.05
    }
  ]
};
export const PRIMARY_ASSUMPTIONS = {
 internStartMonth:3,internMonthly:20000,internTeaching:false,
 operatingDays:6,groupsPerDay:4,reformers:6,privateSlotsPerDay:2,
 practicalMemberCap:48,highFillCeiling:144*.95*.85/(13/6)/1.10,
 peakPlanning:.95,founderMonthly:70000,juniorMonthly:40000,receptionMonthly:20000,
 unitCostEscalation:.05,priceEscalation:.025,comparisonTaxRate:.312,
 calendarOpeningConfirmed:false,syntheticCalendar:'Inherited May-April pattern for comparison only',
 juniorTrigger:'At least six solo months; first month with three-month forecast opex cash cover',
 juniorWorkshopShare:{value:.25,status:'ILLUSTRATIVE conditional rule, not confirmed; applies only when workshop inputs supplied'},
 capacityFormula:'24 groups/week x 6 reformers x .95 fill x .85 member share / (13/6 visits/week) / 1.10 peak',
 revenueFormula:'8-pack sales + 16-pack sales + drop-ins + delivered privates + named extras',
 caveats:['95% peak average is aggressive, not timetable validation','No presale cash before opening','All churn replacements succeed','Positive monthly profit tax, zero depreciation, no annual loss netting','Founder remuneration assumed deed-authorized and deductible','Payment fee RATE escalates 5% as an all-costs stress assumption'],
} as const;
export type ExtraLine = { id:string; name:string; heads:number; price:number; frequencyPerMonth:number; startMonth:number|null; status:string };
export const EXTRA_REVENUE_LINES: ExtraLine[] = [
 {id:'workshops',name:'Workshops',heads:0,price:0,frequencyPerMonth:0,startMonth:null,status:'OFF: volume, price, delivery costs and junior cut need confirmation'},
 {id:'online',name:'Online classes',heads:0,price:0,frequencyPerMonth:0,startMonth:null,status:'OFF: demand, format and delivery costs needed'},
 {id:'teacher-training',name:'Teacher training',heads:0,price:0,frequencyPerMonth:0,startMonth:null,status:'OFF: format, eligibility, demand and delivery costs needed'},
 {id:'cafe',name:'Cafe',heads:0,price:0,frequencyPerMonth:0,startMonth:null,status:'OFF: orders, ticket, COGS, labor, setup and compliance needed'},
];
export const PRESALE_ASSUMPTION={founders:8,chargedMonth:1,cashBeforeOpening:0,discount:0,status:'PROPOSED_PLACEHOLDER_REPLACE_WITH_REAL_TERMS'} as const;
export type PrimaryOptions = { inputOverrides?:Partial<Omit<ModelInputs,'scenarios'>>; monthlyNetAdds?:number[]; conservativeSales?:[number,number,number]; privateRampMonths?:number; internStartMonth?:number; internMonthly?:number; unitCostEscalation?:number; founderCapital?:number; capitalRecoveryPartnerShare?:number; postCapitalPayout?:number; presaleFounders?:number; churnOverride?:number; priorTarget48?:boolean; includeIntern?:boolean; grossSignupCap?:number; caseName?:'target'|'base'|'conservative'; requestedMemberCap?:number; memberShare?:number; peakPlanning?:number; extras?:ExtraLine[] };
export function runPrimaryModel(options:PrimaryOptions={}) {
 for(const key of ['unitCostEscalation','internMonthly','founderCapital','capitalRecoveryPartnerShare','postCapitalPayout','grossSignupCap'] as const){const v=options[key];if(v!==undefined&&(!Number.isFinite(v)||v<0))throw new Error(`${key} must be nonnegative.`);}
 for(const key of ['capitalRecoveryPartnerShare','postCapitalPayout'] as const)if((options[key]??0)>1)throw new Error(`${key} must be at most one.`);
 if(options.internStartMonth!==undefined&&(!Number.isInteger(options.internStartMonth)||options.internStartMonth<1||options.internStartMonth>72))throw new Error('Intern start must be a whole month from 1 to 72.');
 const inputs=structuredClone(PRIMARY_INPUTS);
 if(options.presaleFounders!==undefined){if(!Number.isFinite(options.presaleFounders)||options.presaleFounders<0)throw new Error('Presale founder count must be nonnegative');inputs.scenarios[2].founders=options.presaleFounders;}
 const caseName=options.caseName??'target';
 const stretch50=caseName==='target'&&!options.priorTarget48;
 if(stretch50){inputs.memberShare=.90;inputs.planningCeiling=.92;}
 const dials={target:{to30:12,to40:18,to48:27.6,privateMonths:12,churn:.06},base:{to30:18,to40:30,to48:42,privateMonths:18,churn:.075},conservative:{to30:24,to40:42,to48:60,privateMonths:24,churn:.09}}[caseName];
 inputs.privateRampMonths=dials.privateMonths;inputs.scenarios[2].churn=options.churnOverride??(stretch50?.08:dials.churn);
 if(options.memberShare!==undefined)inputs.memberShare=options.memberShare;
 if(options.peakPlanning!==undefined)inputs.planningCeiling=options.peakPlanning;
 Object.assign(inputs,options.inputOverrides??{});
 if(options.privateRampMonths!==undefined)inputs.privateRampMonths=options.privateRampMonths;
 const requestedCap=options.requestedMemberCap??(stretch50?50:48);
 if(!Number.isFinite(requestedCap)||requestedCap<0)throw new Error('Member cap must be nonnegative');
 const blend=inputs.mix.reduce((a,v,i)=>a+v*inputs.frequency[i],0);
 const ceiling=144*inputs.planningCeiling*inputs.memberShare/blend/Math.max(...inputs.seasonality);
 const warnings:string[]=[];
 if(requestedCap>ceiling)warnings.push(`Requested ${requestedCap} exceeds capacity ${ceiling.toFixed(4)}; excess stays on waitlist, earns zero.`);
 const extras=structuredClone(options.extras??EXTRA_REVENUE_LINES);
 if(extras.some(e=>e.heads*e.price*e.frequencyPerMonth!==0))throw new Error('Extras remain OFF until delivery costs, capacity, tax and owner inputs are configured. Do not add gross extras as pure profit.');
 const monthlyNetAdds=options.monthlyNetAdds??Array.from({length:72},(_,i)=>stretch50?(i<12?22/12:i<24?10/12:i<36?0:i<48?10/12:0):caseName==='target'?(i<12?22/12:i<18?10/6:i<36?15/18:0):(i<dials.to30?22/dials.to30:i<dials.to40?10/(dials.to40-dials.to30):i<dials.to48?8/(dials.to48-dials.to40):0));
 if(monthlyNetAdds.length!==72||monthlyNetAdds.some(n=>!Number.isFinite(n)||n<0))throw new Error('Net additions must have 72 nonnegative monthly values.');
 const grossSteps=options.conservativeSales??[2,3,4];
 if(grossSteps.some(n=>!Number.isFinite(n)||n<0))throw new Error('Gross sales must be nonnegative.');
 let hire:number|null=null;let result:ReturnType<typeof runScenario>|null=null;
 for(let h=7;h<=72;h++){
  const r=runScenario(inputs,2,{grossSignupCap:options.grossSignupCap,monthlyGrossSignupCaps:caseName==='conservative'&&options.grossSignupCap===undefined?Array.from({length:72},(_,i)=>i<12?grossSteps[0]:i<24?grossSteps[1]:grossSteps[2]):undefined,initialReformers:6,fixedClasses:true,fixedWeeklyClasses:24,unitCostEscalation:options.unitCostEscalation??.05,internStartMonth:options.includeIntern===false?undefined:(options.internStartMonth??3),internMonthly:options.internMonthly??20000,privatesBeforeHandover:true,privateHandoverMonth:h,privateWeeklySlots:12,monthlyNetAdds,memberCap:requestedCap,founderSingleSalary:true,juniorFlatSalary:inputs.pilatesSalary,capitalRecoveryPartnerShare:options.capitalRecoveryPartnerShare??.7,founderCapital:options.founderCapital??1000000,postCapitalPayout:options.postCapitalPayout??.98});
  if(r.months[h-1].cashGate){hire=h;result=r;break;}
 }
 if(!result){warnings.push('No affordable full-time conversion in 72 months; intern remains20k and founder retains group teaching.');result=runScenario(inputs,2,{grossSignupCap:options.grossSignupCap,monthlyGrossSignupCaps:caseName==='conservative'&&options.grossSignupCap===undefined?Array.from({length:72},(_,i)=>i<12?grossSteps[0]:i<24?grossSteps[1]:grossSteps[2]):undefined,initialReformers:6,fixedClasses:true,fixedWeeklyClasses:24,unitCostEscalation:options.unitCostEscalation??.05,internStartMonth:options.includeIntern===false?undefined:(options.internStartMonth??3),internMonthly:options.internMonthly??20000,privatesBeforeHandover:true,privateHandoverMonth:73,privateWeeklySlots:12,monthlyNetAdds,memberCap:requestedCap,founderSingleSalary:true,juniorFlatSalary:inputs.pilatesSalary,capitalRecoveryPartnerShare:options.capitalRecoveryPartnerShare??.7,founderCapital:options.founderCapital??1000000,postCapitalPayout:options.postCapitalPayout??.98});}
 const extraRevenue=extras.map(e=>({id:e.id,name:e.name,monthly:Array(72).fill(0) as number[],annual:Array(6).fill(0) as number[]}));
 return {status:'PRIMARY',caseName,dials,dialStatus:caseName==='target'?'CURRENT_ASSUMPTIONS':caseName==='conservative'?'USER_CHOSEN_2_3_4_GROSS_CAP_OTHER_DIALS_PROPOSED':'PROPOSED_PENDING_CORRECTION',extraRevenue,inputs,assumptions:{...PRIMARY_ASSUMPTIONS,internStartMonth:options.internStartMonth??3,internMonthly:options.internMonthly??20000,founderMonthly:inputs.founderDraw,juniorMonthly:inputs.pilatesSalary,receptionMonthly:inputs.reception,unitCostEscalation:options.unitCostEscalation??.05,priceEscalation:inputs.priceEscalation,comparisonTaxRate:inputs.taxRate,capacityFormula:`144 x ${inputs.planningCeiling} x ${inputs.memberShare} / ${blend} / ${Math.max(...inputs.seasonality)}`,practicalMemberCap:requestedCap,highFillCeiling:ceiling,peakPlanning:inputs.planningCeiling,memberShare:inputs.memberShare,currentTargetStretch50:stretch50},requestedCap,effectiveCap:Math.min(requestedCap,ceiling),hire,extras,warnings,result};
}
/** Experimental dial only: keeps physical constraint, does NOT fabricate 54 admissions. */
export const runWaitlist54Illustration=()=>runPrimaryModel({priorTarget48:true,requestedMemberCap:54});

export const runTeacherLadder=()=>({target:runPrimaryModel({caseName:'target'}),base:runPrimaryModel({caseName:'base'}),conservative:runPrimaryModel({caseName:'conservative'})});

export const runTargetEightPercentSensitivity=()=>runPrimaryModel({caseName:'target',priorTarget48:true,churnOverride:.08});
export const runPriorTargetSixPercent=()=>runPrimaryModel({caseName:'target',priorTarget48:true});
