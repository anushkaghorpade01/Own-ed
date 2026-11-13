import type { OwnOperatingPlan } from "../schemas";

export const OWN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const OWN_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const OWN_SERVICES = ["group_pilates", "group_strength", "private_pilates", "private_strength"] as const;
export type OwnService = typeof OWN_SERVICES[number];

const defaults = (id: string, name: string, family: string, price: number, months: number, sessions: [number, number, number, number]) => ({
  id, name, family, price, validityMonths: months,
  sessions: Object.fromEntries(OWN_SERVICES.map((service, i) => [service, sessions[i]])) as Record<OwnService, number>,
  expectedSalesPerMonth: 0, active: true,
});

/** Sample catalogue only: prices must be confirmed by the studio. */
export function initialOwnPlan(): OwnOperatingPlan {
  return {
    enabled: false,
    packages: [
      defaults("own-pilates-drop", "Drop-in", "OWN Pilates", 0, 1, [1, 0, 0, 0]),
      defaults("own-pilates-8", "8 sessions", "OWN Pilates", 0, 1, [8, 0, 0, 0]),
      defaults("own-pilates-16", "16 sessions", "OWN Pilates", 0, 2, [16, 0, 0, 0]),
      defaults("own-complete-12", "12 sessions", "OWN Complete", 0, 2, [8, 4, 0, 0]),
      defaults("own-strength-8", "8 sessions", "OWN Strength", 0, 1, [0, 8, 0, 0]),
      defaults("own-strength-16", "16 sessions", "OWN Strength", 0, 2, [0, 16, 0, 0]),
      defaults("own-private-pilates-8", "8 sessions", "Private Pilates", 0, 1, [0, 0, 8, 0]),
      defaults("own-private-pilates-12", "12 sessions", "Private Pilates", 0, 2, [0, 0, 12, 0]),
      defaults("own-private-strength-8", "8 sessions", "Private Strength", 0, 1, [0, 0, 0, 8]),
      defaults("own-private-strength-12", "12 sessions", "Private Strength", 0, 2, [0, 0, 0, 12]),
    ],
    otherRevenue: ["Space rentals", "Brand partnerships", "External workshops", "Online sessions", "OWN special workshops", "Corporate workshops"].map((name, i) => ({
      id: `other-${i}`, name, unitPrice: 0, monthlyUnits: Array(12).fill(0), variableCostPerUnit: 0, studioHoursPerUnit: 0, resource: (i === 1 || i === 3 ? "none" : "both") as "none" | "both", active: true,
    })),
    contributions: ["Founder 1", "Founder 2", "Partner"].map((name, i) => ({id:`contributor-${i}`, name, amount: 0})),
    schedule: [], reformers: 5, strengthGroupLimit: 6, pilatesTrainers: 1, strengthTrainers: 1,
    privatePilatesPayout: 0, privateStrengthPayout: 0,
    pilatesTrainerMonthlySalary: 0, strengthTrainerMonthlySalary: 0,
    churnPct: 8, renewalPurchasePct: 70, openingActiveMembers: 0, newMembersPerMonth: 0,
    targetRevenueByMonth: Array(12).fill(600000),
    seasonByMonth: ["normal", "normal", "normal", "off", "off", "normal", "normal", "normal", "peak", "peak", "peak", "off"],
    seasonDemandPct: {peak: 80, normal: 60, off: 40}, expectedUsagePct: 90,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Validate recurring slots against trainer headcount and exclusive reformer access. */
export function scheduleConflicts(plan: OwnOperatingPlan): string[] {
  const slots = plan.schedule.filter(s => s.active);
  const issues: string[] = [];
  const dayMinutes = 24 * 60;
  for (const s of slots) {
    const start = toMinutes(s.startTime);
    if (!Number.isFinite(start) || start < 0 || start >= dayMinutes ||
        s.durationMinutes < 15 || start + s.durationMinutes > dayMinutes) {
      issues.push(`${s.id}: invalid class time or class crosses midnight`);
    }
    if (s.service.includes("pilates") && plan.pilatesTrainers < 1) issues.push(`${s.id}: no Pilates trainer`);
    if (s.service.includes("strength") && plan.strengthTrainers < 1) issues.push(`${s.id}: no strength trainer`);
  }
  for (const day of OWN_DAYS) {
    const events = slots.filter(s => s.day === day);
    // Sweep through all boundaries: catches three overlapping sessions even
    // when neither pair of the first two would exceed two trainers.
    const boundaries = [...new Set(events.flatMap(s => [toMinutes(s.startTime), toMinutes(s.startTime) + s.durationMinutes]))].sort((a,b) => a-b);
    for (let i = 0; i < boundaries.length - 1; i++) {
      const at = boundaries[i];
      const concurrent = events.filter(s => toMinutes(s.startTime) <= at && toMinutes(s.startTime) + s.durationMinutes > at);
      const pilates = concurrent.filter(s => s.service.includes("pilates"));
      const strength = concurrent.filter(s => s.service.includes("strength"));
      if (pilates.length > plan.pilatesTrainers) issues.push(`${day}: insufficient Pilates trainers`);
      if (strength.length > plan.strengthTrainers) issues.push(`${day}: insufficient strength trainers`);
      if (pilates.some(s => s.service === "private_pilates") && pilates.length > 1) {
        issues.push(`${day}: private Pilates reserves the entire studio`);
      } else if (pilates.length > 1) {
        issues.push(`${day}: Pilates classes cannot share the five-reformer studio`);
      }
      // With one instructor each, group and private strength cannot overlap.
    }
  }
  return [...new Set(issues)];
}

export function weeklyCapacity(plan: OwnOperatingPlan): Record<OwnService, number> {
  const result = { group_pilates: 0, group_strength: 0, private_pilates: 0, private_strength: 0 };
  for (const s of plan.schedule.filter(x => x.active)) {
    result[s.service] += s.service === "group_pilates" ? plan.reformers : s.service === "group_strength" ? plan.strengthGroupLimit : 1;
  }
  return result;
}

export interface OwnMonthResult {
  month: number; season: string; membersStart: number; churned: number; newMembers: number; membersEnd: number;
  packageSales: number; productRevenue: number; otherRevenue: number; totalRevenue: number; variableCosts: number; contribution: number;
  demand: Record<OwnService, number>; capacity: Record<OwnService, number>; capacityFeasible: boolean;
  revenueTarget: number; revenueGap: number; additionalPackagesRequired: number | null;
  additionalNewMembersRequired: number | null;
  /** Incremental package purchases, over and above baseline forecast, to reach the selected target. */
  targetPackageSales: Record<string, number>;
  targetCapacityFeasible: boolean;
}

/** Deterministic 12-month sales-based forecast, not accrual accounting or a booking system. */
export function forecastOwnPlan(plan: OwnOperatingPlan, weeksClosedPerYear = 0, months = 12): OwnMonthResult[] {
  const weekly = weeklyCapacity(plan);
  const weekFactor = Math.max(0, 52 - weeksClosedPerYear) / 12;
  let members = plan.openingActiveMembers;
  const history: Array<Record<string, number>> = [];
  return Array.from({length: months}, (_, index) => {
    const monthIndex = index % 12;
    const season = plan.seasonByMonth[monthIndex];
    const multiplier = plan.seasonDemandPct[season] / Math.max(1, plan.seasonDemandPct.normal);
    const demand = {group_pilates:0, group_strength:0, private_pilates:0, private_strength:0};
    const current: Record<string, number> = {};
    let packageSales = 0, productRevenue = 0, variableCosts = 0;
    for (const p of plan.packages.filter(p => p.active)) {
      const sales = p.expectedSalesPerMonth * multiplier;
      current[p.id] = sales;
      packageSales += sales;
      productRevenue += sales * p.price;
      for (let back = 0; back < p.validityMonths; back++) {
        const cohortSales = back === 0 ? sales : history[index - back]?.[p.id] ?? 0;
        for (const service of OWN_SERVICES) demand[service] += cohortSales * p.sessions[service] * plan.expectedUsagePct / 100 / p.validityMonths;
      }
    }
    history.push(current);
    const otherRevenue = plan.otherRevenue.filter(r => r.active).reduce((total, r) => {
      const units = r.monthlyUnits[monthIndex];
      variableCosts += units * r.variableCostPerUnit;
      return total + units * r.unitPrice;
    }, 0);
    variableCosts += demand.private_pilates * plan.privatePilatesPayout + demand.private_strength * plan.privateStrengthPayout;
    const capacity = Object.fromEntries(OWN_SERVICES.map(k => [k, weekly[k] * weekFactor])) as Record<OwnService, number>;
    // Other-revenue space usage removes available scheduled studio hours, not
    // arbitrary revenue. As bookings are not individually timed, this is a
    // proportional monthly capacity allowance, not a booking conflict check.
    const blocked = {pilates:0,strength:0};
    for (const stream of plan.otherRevenue.filter(r=>r.active)) {
      const hours = stream.monthlyUnits[monthIndex] * stream.studioHoursPerUnit;
      if (stream.resource === "pilates" || stream.resource === "both") blocked.pilates += hours;
      if (stream.resource === "strength" || stream.resource === "both") blocked.strength += hours;
    }
    for (const discipline of ["pilates", "strength"] as const) {
      const relevant = plan.schedule.filter(s=>s.active && s.service.includes(discipline));
      const hours = relevant.reduce((total,s)=>total+s.durationMinutes/60,0) * weekFactor;
      const remainingFraction = hours === 0 ? 0 : Math.max(0, 1 - blocked[discipline] / hours);
      for (const key of OWN_SERVICES.filter(service=>service.includes(discipline))) {
        capacity[key] *= remainingFraction;
      }
    }
    const capacityFeasible = OWN_SERVICES.every(k => demand[k] <= capacity[k] + 1e-9) && scheduleConflicts(plan).length === 0;
    const membersStart = members;
    const churned = members * plan.churnPct / 100;
    const newMembers = plan.newMembersPerMonth * multiplier;
    members = Math.max(0, members - churned + newMembers);
    const totalRevenue = productRevenue + otherRevenue;
    const revenueTarget = plan.targetRevenueByMonth[monthIndex];
    const revenueGap = Math.max(0, revenueTarget - totalRevenue);
    const priced = plan.packages.filter(p => p.active && p.price > 0);
    // Target solver retains the planned product mix. If there are no forecast
    // sales yet, it uses an equal mix of active, priced SKUs as an explicit
    // provisional assumption. Quantities are whole packages.
    const totalMix = priced.reduce((total,p) => total + (current[p.id] ?? 0), 0);
    const weights = priced.map(p => totalMix > 0 ? (current[p.id] ?? 0) / totalMix : 1 / priced.length);
    const averagePrice = priced.reduce((total,p,i) => total + p.price * weights[i], 0);
    const targetPackageSales: Record<string, number> = {};
    if (revenueGap > 0 && averagePrice > 0) {
      const count = Math.ceil(revenueGap / averagePrice);
      const raw = priced.map((p,i) => count * weights[i]);
      let assigned = 0;
      for (let i = 0; i < priced.length; i++) {
        const qty = Math.floor(raw[i]);
        targetPackageSales[priced[i].id] = qty;
        assigned += qty;
      }
      const remainderOrder = priced.map((p,i) => i)
        .sort((a,b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])));
      for (let i = 0; i < count - assigned; i++) targetPackageSales[priced[remainderOrder[i]].id]++;
      let achieved = priced.reduce((total,p) => total + (targetPackageSales[p.id] ?? 0) * p.price, 0);
      // If round-off undershoots the target, sell the least additional number
      // of packages with the highest available price.
      const highest = priced.reduce((a,b) => a.price >= b.price ? a : b);
      if (achieved < revenueGap - 1e-7) {
        const extras = Math.ceil((revenueGap - achieved - 1e-7) / highest.price);
        targetPackageSales[highest.id] += extras;
        achieved += extras * highest.price;
      }
    }
    const additionalPackagesRequired = revenueGap === 0 ? 0
      : averagePrice > 0 ? Object.values(targetPackageSales).reduce((a,b)=>a+b,0) : null;
    const targetDemand = {...demand};
    for (const p of priced) for (const service of OWN_SERVICES) {
      targetDemand[service] += (targetPackageSales[p.id] ?? 0) * p.sessions[service] * plan.expectedUsagePct / 100 / p.validityMonths;
    }
    const targetCapacityFeasible = OWN_SERVICES.every(service => targetDemand[service] <= capacity[service] + 1e-9) && scheduleConflicts(plan).length === 0;
    // Do not equate packages to unique members: multiple purchases and renewals are possible.
    // Members renewing are not automatically a purchase; renewal rate makes
    // their expected repeat demand explicit. One incremental new member is
    // assumed to buy one membership package upon joining.
    const memberPackages = plan.packages.filter(p => p.active && Object.values(p.sessions).reduce((a,b)=>a+b,0)>1);
    const memberSales = memberPackages.reduce((total,p)=>total+(current[p.id]??0),0);
    // A two-month pack normally creates one purchasing opportunity every
    // two months, unlike an eight-session one-month pack.
    const memberMixTotal = memberPackages.reduce((total,p)=>total+(current[p.id]??0),0);
    const renewalFrequency = memberMixTotal > 0
      ? memberPackages.reduce((total,p)=>total+(current[p.id]??0)/p.validityMonths,0)/memberMixTotal
      : (memberPackages.length ? memberPackages.reduce((total,p)=>total+1/p.validityMonths,0)/memberPackages.length : 0);
    const repeatableMemberPurchases = Math.max(0, membersStart - churned) * plan.renewalPurchasePct / 100 * renewalFrequency;
    const incrementalMemberPacks = memberPackages.reduce((total,p)=>total+(targetPackageSales[p.id]??0),0);
    // New members required for the target must cover any unfilled baseline
    // membership sales as well as incremental target sales, after renewals.
    // Multiple purchased packs and drop-ins aren't unique members.
    const totalMembershipsNeeded = memberSales + incrementalMemberPacks;
    const totalNewMembersNeeded = Math.max(0, Math.ceil(totalMembershipsNeeded - repeatableMemberPurchases));
    const additionalNewMembersRequired = additionalPackagesRequired === null ? null
      : Math.max(0, totalNewMembersNeeded - newMembers);
    return {month:index + 1, season, membersStart, churned, newMembers, membersEnd:members, packageSales, productRevenue, otherRevenue, totalRevenue, variableCosts, contribution:totalRevenue-variableCosts, demand, capacity, capacityFeasible, revenueTarget, revenueGap, additionalPackagesRequired, additionalNewMembersRequired, targetPackageSales, targetCapacityFeasible};
  });
}

export function ownFundingTotal(plan: OwnOperatingPlan): number {
  return plan.contributions.reduce((sum, c) => sum + c.amount, 0);
}
