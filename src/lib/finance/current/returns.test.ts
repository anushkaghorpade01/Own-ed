import {describe,it,expect} from 'vitest';
import {npv,irr,cashPayback,discountImpact,returnFlows,alternativeFutureValue} from './returns';
import {runPrimaryModel} from '../own-primary';
describe('current investment and discount calculators',()=>{
 it('discounts dated monthly cash flows at an annual rate',()=>{expect(npv([{month:0,amount:-100},{month:12,amount:110}],.1)).toBeCloseTo(0,8);expect(npv([{month:0,amount:-100},{month:6,amount:110}],.21)).toBeCloseTo(0,8);});
 it('computes an annual IRR without a terminal value',()=>{const r=irr([{month:0,amount:-100},{month:12,amount:110}]);expect(r.rates).toHaveLength(1);expect(r.rates[0]).toBeCloseTo(.1,7);});
 it('reports multiple roots instead of choosing one',()=>{const r=irr([{month:0,amount:-100},{month:12,amount:230},{month:24,amount:-132}]);expect(r.rates).toHaveLength(2);expect(r.rates[0]).toBeCloseTo(.1,6);expect(r.rates[1]).toBeCloseTo(.2,6);});
 it('handles no receipt and no recovered capital',()=>{expect(irr([{month:0,amount:-100}]).rates).toEqual([]);expect(cashPayback([{month:0,amount:-100},{month:12,amount:50}])).toBeNull();});
 it('separates founder remuneration from invested-capital cash returns',()=>{const p=runPrimaryModel();const f=returnFlows(p.result,p.inputs.funding,p.inputs.partnerCapital,1e6);expect(f.hers[1].amount).toBe(p.result.months[0].founder);expect(f.hers[0].amount).toBe(-1e6);expect(f.project[0].amount).toBe(-4500000);});
 it('compares alternatives using the same dated contributions and withdrawals',()=>{expect(alternativeFutureValue([{month:0,amount:100}],.1,12)).toBeCloseTo(110);});
 it('computes discount contribution and required extra volume without creating demand',()=>{const d=discountImpact(12000,8,.1,40,.02,.05);expect(d.newPrice).toBe(10800);expect(d.after).toBeCloseTo(10253.2);expect(d.extraVolumePct).toBeCloseTo(d.before/d.after-1);});
 it('rejects invalid rates and loss-making volume solutions',()=>{expect(()=>npv([], -1)).toThrow();expect(discountImpact(100,8,.5,40,0,0).extraVolumePct).toBeNull();});
});
