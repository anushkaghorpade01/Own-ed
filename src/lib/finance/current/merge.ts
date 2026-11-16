import type {FinanceData} from './plan';
/** Merge adds nonconflicting records; never replaces the current plan, working case or existing history. */
export function mergeFinanceHistory(current:FinanceData|undefined,incoming:FinanceData|undefined):FinanceData|undefined{
 if(!current)return incoming;if(!incoming)return current;
 const by=<T>(old:T[],add:T[],key:(v:T)=>string|number)=>[...new Map([...add,...old].map(v=>[key(v),v])).values()];
 return {...current,actuals:by(current.actuals,incoming.actuals,a=>a.month).sort((a,b)=>a.month-b.month),snapshots:by(current.snapshots,incoming.snapshots,s=>s.id),correctionSnapshots:by(current.correctionSnapshots??[],incoming.correctionSnapshots??[],s=>s.id),whatifs:by(current.whatifs,incoming.whatifs,s=>s.id),leads:by(current.leads??[],incoming.leads??[],l=>l.id)};
}

export function financeMergeCounts(current:FinanceData|undefined,incoming:FinanceData|undefined){if(!incoming)return {added:0,skipped:0};if(!current)return {added:incoming.actuals.length+incoming.snapshots.length+(incoming.correctionSnapshots??[]).length+incoming.whatifs.length+(incoming.leads??[]).length,skipped:0};let added=0,skipped=0;for(const [old,add,key] of [[current.actuals,incoming.actuals,'month'],[current.snapshots,incoming.snapshots,'id'],[current.correctionSnapshots??[],incoming.correctionSnapshots??[],'id'],[current.whatifs,incoming.whatifs,'id'],[current.leads??[],incoming.leads??[],'id']] as const)for(const value of add){const v=value as unknown as Record<string,unknown>;if(old.some(item=>(item as unknown as Record<string,unknown>)[key]===v[key]))skipped++;else added++;}return {added,skipped};}
