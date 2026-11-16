import {describe,it,expect} from 'vitest';
import {fundingAllocation,setupCutForCashFloor} from './funding';
const base={total:4500000,depositAndOperatingEnvelope:1000000,setupBudget:3500000,lockedDeposit:435000,transferFromSetupToOperating:0};
describe('protected funding envelopes',()=>{
 it('reconciles inherited illustrative deposit without inventing10Lfree cash',()=>{const a=fundingAllocation(base);expect(a.spendableOpeningCash).toBe(565000);expect(a.totalInitialCashDeduction).toBe(3935000);});
 it('never assumes a deposit when unknown',()=>expect(fundingAllocation({...base,lockedDeposit:null}).spendableOpeningCash).toBeNull());
 it('takes extra liquidity from interiors, never adds unapproved funding',()=>{const a=fundingAllocation({...base,transferFromSetupToOperating:200000});expect(a.setupAfterTransfer).toBe(3300000);expect(a.spendableOpeningCash).toBe(765000);expect(a.setupAfterTransfer+a.lockedDeposit!+a.spendableOpeningCash!).toBe(4500000);});
 it('shows required setup cuts, including infeasible ones',()=>{expect(setupCutForCashFloor(base,800000)).toEqual({additionalSetupCut:235000,feasible:true});expect(setupCutForCashFloor(base,5000000).feasible).toBe(false);});
 it('rejects overallocated budgets or an unsupported deposit',()=>{expect(()=>fundingAllocation({...base,setupBudget:4000000})).toThrow();expect(()=>fundingAllocation({...base,lockedDeposit:1100000})).toThrow();});
});
