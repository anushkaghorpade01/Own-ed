/** Temporal linear-response feasibility screen. No baseline or revenue mutation.
 * Customer demand responses must come from an explicit cohort experiment. */
export type AdmissionResponse={id:string;startDay:number;active:number[];bookings:number[]};
export function solveTimedAdmissions(x:{existingActive:number[];existingBookings:number[];targetActive:number[];activeLimit:number[];bookingLimit:number[];candidates:AdmissionResponse[]}){
 const length=x.existingActive.length;const arrays=[x.existingActive,x.existingBookings,x.targetActive,x.activeLimit,x.bookingLimit];if(!length||arrays.some(a=>a.length!==length||a.some(n=>!Number.isFinite(n)||n<0)))throw new Error('Invalid daily planning arrays.');
 const active=[...x.existingActive],bookings=[...x.existingBookings],starts:{id:string;day:number;newCustomers:number;requested:number;capacityLimited:boolean;targetAlreadyCovered:boolean;zeroResponseWithGap:boolean;bindingDay:number|null}[]=[];
 const baselineBreaches=active.map((v,d)=>({day:d,activeBreach:v>x.activeLimit[d]+1e-8,bookingBreach:bookings[d]>x.bookingLimit[d]+1e-8})).filter(d=>d.activeBreach||d.bookingBreach);
 // Existing valid holders and all known future returns keep first claim. A new
 // admission must fit its full future response, not only the current day.
 for(const c of [...x.candidates].sort((a,b)=>a.startDay-b.startDay)){
  if(!Number.isInteger(c.startDay)||c.startDay<0||c.startDay>=length||[c.active,c.bookings].some(a=>a.length!==length||a.some(n=>!Number.isFinite(n)||n<0))||c.active.slice(0,c.startDay).some(n=>n>1e-8)||c.bookings.slice(0,c.startDay).some(n=>n>1e-8))throw new Error('Invalid admission response.');
  const d=c.startDay,response=c.active[d];const gap=Math.max(0,x.targetActive[d]-active[d]);const requested=response>1e-8?gap/response:0;let allowed=requested;let bindingDay:number|null=null;
  for(let t=d;t<length;t++){const before=allowed;if(c.active[t]>1e-8)allowed=Math.min(allowed,Math.max(0,x.activeLimit[t]-active[t])/c.active[t]);if(c.bookings[t]>1e-8)allowed=Math.min(allowed,Math.max(0,x.bookingLimit[t]-bookings[t])/c.bookings[t]);if(allowed<before-1e-8)bindingDay=t;}
  for(let t=d;t<length;t++){active[t]+=allowed*c.active[t];bookings[t]+=allowed*c.bookings[t];}
  starts.push({id:c.id,day:d,newCustomers:allowed,requested,capacityLimited:allowed+1e-8<requested,targetAlreadyCovered:gap<1e-8,zeroResponseWithGap:gap>1e-8&&response<=1e-8,bindingDay});
 }
 const daily=active.map((n,d)=>({day:d,active:n,bookings:bookings[d],target:x.targetActive[d],shortfall:Math.max(0,x.targetActive[d]-n),activeBreach:n>x.activeLimit[d]+1e-8,bookingBreach:bookings[d]>x.bookingLimit[d]+1e-8}));
 return {starts,daily,baselineBreaches,feasible:daily.every(d=>!d.activeBreach&&!d.bookingBreach),method:'Greedy chronological capacity-feasible starts. Not a proof of globally minimum acquisitions or an executable booking plan. Future response horizon must include delayed return waves; a truncated horizon understates obligations.',unmetTargetDays:daily.filter(d=>d.shortfall>1e-8).length};
}
