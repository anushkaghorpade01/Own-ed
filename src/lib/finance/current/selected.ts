import {integratedCorrectionExperiment,type CorrectionExperiment} from './integrated-scenario';
import type {FinanceData,WorkingCorrection} from './plan';
import {CORRECTED_ENGINE} from './version';
export {CORRECTED_ENGINE} from './version';
export type CorrectedResult=ReturnType<typeof integratedCorrectionExperiment>;
const results=new WeakMap<WorkingCorrection,CorrectedResult>();
const identicalInputs=new Map<string,CorrectedResult>();
export function correctionState(finance:FinanceData):{status:'missing'|'stale'|'invalid'|'version-mismatch';reason:string;result:null}|{status:'ready';reason:string;result:CorrectedResult}{
 const saved=finance.workingCorrection;
 if(!saved)return {status:'missing',reason:'Choose renewal timing and paid demand before calculating a working forecast.',result:null};
 if(saved.engine!==CORRECTED_ENGINE)return {status:'version-mismatch',reason:'This working scenario was calculated under an earlier or unknown engine. Inputs are preserved; recalculate explicitly before reading current outputs.',result:null};
 if(saved.experiment.options.caseName!==saved.caseName)return {status:'invalid',reason:'Saved case label does not match calculation inputs. Recalculate the working scenario.',result:null};
 if(saved.planHash!==JSON.stringify(finance.plan)||saved.caseName!==finance.selection.caseName)return {status:'stale',reason:'The selected case or operating assumptions changed. Recalculate the working forecast before using these outputs.',result:null};
 let result:CorrectedResult|undefined;try{const key=JSON.stringify([saved.engine,saved.experiment]);result=results.get(saved)??identicalInputs.get(key);if(!result){result=integratedCorrectionExperiment(saved.experiment);identicalInputs.set(key,result);if(identicalInputs.size>3)identicalInputs.delete(identicalInputs.keys().next().value!);}results.set(saved,result);}catch(e){return {status:'invalid',reason:'Saved working inputs cannot be calculated: '+String(e)+'. Original records are preserved.',result:null};}
 return {status:'ready',reason:'Explicit working scenario, not measured demand or an approved investment forecast.',result};
}
export function requireCorrection(finance:FinanceData):CorrectedResult{
 const current=correctionState(finance);if(!current.result)throw new Error(current.reason);return current.result;
}
/** Derive a what-if from the same explicit demand and renewal inputs. No inferred sales. */
export function correctedWhatIf(finance:FinanceData,patch:Partial<CorrectionExperiment>):CorrectedResult{
 requireCorrection(finance);return integratedCorrectionExperiment({...finance.workingCorrection!.experiment,...patch});
}
