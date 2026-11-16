import type {Actual} from './plan';
import type {CorrectedResult} from './selected';
/** Actual-field definitions are explicit; legacy snapshots keep their own engine label. */
export function correctedRecordValues(r:CorrectedResult,month:number):Actual['values']{
 const m=r.rows[month-1],lines=r.cohort.ledger.lines.filter(l=>l.date.startsWith(m.date.slice(0,7))),prior=r.cohort.ledger.lines.filter(l=>l.date<m.date),all=[...prior,...lines];
 const credits=(type:string)=>lines.filter(l=>l.type===type).reduce((s,l)=>s+l.credits,0);
 const productSale=(product:string)=>lines.filter(l=>l.type==='purchase'&&r.cohort.ledger.packs.some(p=>p.cohort===l.cohort&&p.product===product)).reduce((s,l)=>s+l.netSales,0);
 return {members:m.activePackHoldersClosing,grossSalesTarget:m.newAdmissions,netSales:m.netSales,grossReceipts:m.grossReceipts,opex:m.opex,cash:m.cash,memberVisits:m.attended,privateSessions:r.assumptions.test.separatePaidDemand[month-1].paidPrivates,pack8Sales:productSale('8'),pack16Sales:productSale('16'),packSessionsIssued:credits('purchase'),packSessionsServed:credits('attended'),packSessionsExpired:credits('expired'),packSessionsOutstanding:all.reduce((s,l)=>s+(l.type==='purchase'?l.credits:['attended','expired','forfeited'].includes(l.type)?-l.credits:0),0),gstCollected:m.gstCollected,gstPaid:m.gstPaid};
}
