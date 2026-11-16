/** Optional unit-economics test only, never a campaign, observed CAC or forecast input. */
export function referralImpact(x:{contributionPerPurchase:number;referrerReward:number;newBuyerReward:number;rewardedPairs:number;incrementalPurchases:number;paymentFee:number;outputGST:number}){
 for(const [k,v] of Object.entries(x))if(!Number.isFinite(v)||(k!=='contributionPerPurchase'&&v<0))throw new Error(`${k} must be nonnegative.`);
 if(x.incrementalPurchases>x.rewardedPairs)throw new Error('Incremental purchases cannot exceed the tested rewarded pairs.');
 if(x.paymentFee>1||x.outputGST>1)throw new Error('Supply fee and GST as fractions.');
 const discountFace=(x.referrerReward+x.newBuyerReward)*x.rewardedPairs;
 // Tested rewards are price reductions before output GST, not cash payouts.
 const contributionCost=discountFace*(1-(1+x.outputGST)*x.paymentFee);
 return {discountFace,contributionCost,incrementalContribution:x.incrementalPurchases*x.contributionPerPurchase-contributionCost,breakEvenIncrementalPurchases:x.contributionPerPurchase>0?contributionCost/x.contributionPerPurchase:null};
}
