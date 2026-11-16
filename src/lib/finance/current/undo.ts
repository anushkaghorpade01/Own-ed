import type {FinanceData} from './plan';
/** Undo forecast assumptions, never delete or roll back observed history. */
export function undoFinance(current:FinanceData|undefined,previous:FinanceData|undefined):FinanceData|undefined{
 if(!current||!previous)return current;
 return {...current,plan:structuredClone(previous.plan),settings:structuredClone(previous.settings),workingCorrection:previous.workingCorrection?structuredClone(previous.workingCorrection):undefined};
}
