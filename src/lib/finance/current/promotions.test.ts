import {it,expect} from 'vitest';
import {referralImpact} from './promotions';
const x={contributionPerPurchase:11428,referrerReward:500,newBuyerReward:500,rewardedPairs:10,incrementalPurchases:1,paymentFee:.02,outputGST:.05};
it('does not count each rewarded referral as an extra sale',()=>{const r=referralImpact({...x,incrementalPurchases:0});expect(r.discountFace).toBe(10000);expect(r.contributionCost).toBe(9790);expect(r.incrementalContribution).toBe(-9790);});
it('charges both price-reduction rewards once and offsets only user-tested extra purchases',()=>{expect(referralImpact(x).incrementalContribution).toBe(1638);expect(referralImpact(x).breakEvenIncrementalPurchases).toBeCloseTo(9790/11428);});
it('rejects invalid scope rather than inventing more incremental customers than rewarded pairs',()=>{expect(()=>referralImpact({...x,incrementalPurchases:11})).toThrow();expect(()=>referralImpact({...x,referrerReward:-1})).toThrow();});

it('keeps nonpositive pack contribution visible without a fake break-even lift',()=>{expect(referralImpact({...x,contributionPerPurchase:-10}).breakEvenIncrementalPurchases).toBeNull();});
