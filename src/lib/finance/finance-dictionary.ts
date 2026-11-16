/**
 * Founder-facing glossary — every term Own-ed uses, in Pilates studio context.
 * Linked from Math → Dictionary.
 */

export type DictionaryCategory =
  | "pricing"
  | "margin"
  | "profit"
  | "capacity"
  | "products"
  | "cash"
  | "investment"
  | "planning";

export interface DictionaryEntry {
  term: string;
  aliases?: string[];
  category: DictionaryCategory;
  /** Where this shows up in Own-ed */
  usedIn?: string;
  definition: string;
  formula?: string;
  example?: string;
  notTheSameAs?: string;
}

export const DICTIONARY_CATEGORIES: Record<
  DictionaryCategory,
  { label: string; description: string }
> = {
  pricing: {
    label: "Pricing & GST",
    description: "How founder-entered prices flow through the model.",
  },
  margin: {
    label: "Margins & unit economics",
    description: "What each seat, class, and reformer contributes.",
  },
  profit: {
    label: "Profit & P&L",
    description: "From gross profit to planning net profit.",
  },
  capacity: {
    label: "Capacity & occupancy",
    description: "Reformers, spots, utilisation, and unused capacity.",
  },
  products: {
    label: "Access products",
    description: "Drop-in, packs, Private, Standing, Standby.",
  },
  cash: {
    label: "Cash vs sales",
    description: "When money moves vs when it counts in planning.",
  },
  investment: {
    label: "Investment & payback",
    description: "Launch costs, break-even, and recovery.",
  },
  planning: {
    label: "Planning & scenarios",
    description: "Assumptions, mix, and optimisation.",
  },
};

const EARLIER_DICTIONARY: DictionaryEntry[] = [
  {
    term: "Net sales (ex-GST)",
    aliases: ["Net price", "Net sales price", "Canonical price"],
    category: "pricing",
    usedIn: "Pricing, Pack Designer, P&L, Optimise",
    definition:
      "The founder's primary editable price — what OWN keeps as revenue before GST. This is the single source of truth for contribution, margin, P&L, break-even, and payback.",
    formula: "Customer pays ÷ (1 + GST rate)",
    example: "Private net ₹4,000 → customer pays ₹4,720 at 18% GST. OWN plans on ₹4,000.",
    notTheSameAs: "Customer pays incl. GST — that includes tax remitted to the government, not studio revenue.",
  },
  {
    term: "Customer pays (incl. GST)",
    aliases: ["Gross price", "Sticker price"],
    category: "pricing",
    usedIn: "Pricing, Flexible Credits, Private mix",
    definition:
      "What the customer actually pays at checkout. Calculated automatically from net sales — never entered separately.",
    formula: "Net sales × (1 + GST rate)",
    example: "₹4,000 net × 1.18 = ₹4,720 customer pays.",
  },
  {
    term: "GST collected",
    category: "pricing",
    usedIn: "P&L",
    definition:
      "Tax on customer billings that OWN collects and remits. Not studio revenue — shown as a deduction between gross billings and net sales.",
    notTheSameAs: "Net sales. GST is pass-through to the tax authority.",
  },
  {
    term: "Net sales / credit",
    category: "pricing",
    usedIn: "Pricing, weighted revenue",
    definition:
      "Net pack price divided by credits sold — the per-credit net sales value for mix-weighting. Redemption rate does not reduce this; unused credits affect delivery costs only.",
    formula: "Net pack price ÷ credits in pack",
  },
  {
    term: "Weighted net sales / occupied spot",
    aliases: ["Average realised net revenue per credit"],
    category: "pricing",
    usedIn: "Pricing insight, unit economics",
    definition:
      "Credit-weighted average net sales per flexible reformer spot, driven by service demand mix (not simple customer-count average).",
  },
  {
    term: "CM1 — Contribution margin (per seat)",
    aliases: ["Contribution / occupied seat", "Contribution margin per seat"],
    category: "margin",
    usedIn: "Unit Economics, break-even",
    definition:
      "First contribution margin: net sales from one delivered group-class seat minus direct variable costs to serve that seat (payment fees, consumables, instructor variable payout).",
    formula: "Net sales/seat − payment fee − consumables − instructor variable",
    example:
      "If net sales/seat is ₹1,400 and direct variable costs are ₹250, CM1 = ₹1,150 toward fixed costs.",
    notTheSameAs:
      "Gross profit (business-level) or fully loaded profit (after fixed allocation). CM1 is per delivered seat only.",
  },
  {
    term: "CM2 — Gross profit (planning)",
    aliases: ["Gross profit", "Gross margin"],
    category: "margin",
    usedIn: "P&L",
    definition:
      "Business-level margin after all direct delivery costs for the month — net sales minus instructor, consumables, payment fees, and other direct variable costs across group, Private, Standing, etc.",
    formula: "Net sales − direct costs",
    notTheSameAs:
      "CM1 per seat × seats (CM2 includes Private, Standing, workshops, and month-level direct cost mix).",
  },
  {
    term: "Contribution / session (Private)",
    category: "margin",
    usedIn: "Access Products → Mix, Private economics",
    definition:
      "Private CM1: net sales per Private session minus instructor cost and other direct costs for that session.",
    formula: "Net sales/session − instructor − other direct",
    example: "₹4,000 − ₹500 − ₹110 = ₹3,390 contribution/session.",
  },
  {
    term: "Contribution margin %",
    category: "margin",
    usedIn: "Pack Designer, flexible packs",
    definition:
      "Expected contribution divided by net sales for a pack — after expected delivery costs for redeemed credits, not after fixed rent.",
    formula: "Expected contribution ÷ net pack price × 100",
  },
  {
    term: "Fully loaded profit (per class)",
    aliases: ["Fully loaded"],
    category: "margin",
    usedIn: "Unit Economics table",
    definition:
      "Contribution from one class minus a fair share of monthly fixed operating costs allocated to that class slot. Shows whether a class at that occupancy covers its share of rent and salaries.",
    formula: "Class contribution − (monthly fixed costs ÷ classes per month)",
    example:
      "A 2/3 class might have positive contribution but negative fully loaded if fixed costs are high.",
    notTheSameAs:
      "Contribution alone. Fully loaded answers 'does this class pay for its share of the studio?' not just variable costs.",
  },
  {
    term: "Direct costs",
    aliases: ["Direct variable costs", "Delivery costs"],
    category: "profit",
    usedIn: "P&L, pack economics",
    definition:
      "Costs that scale with sessions delivered: instructor payouts, session consumables, payment gateway fees, and product-specific delivery costs.",
  },
  {
    term: "Operating expenses",
    aliases: ["Fixed costs", "Opex"],
    category: "profit",
    usedIn: "Assumptions, P&L, break-even",
    definition:
      "Monthly costs that don't vary per seat: rent, salaries, insurance, software, marketing retainer, etc.",
  },
  {
    term: "EBITDA",
    category: "profit",
    usedIn: "P&L, Optimise, scenarios",
    definition:
      "Earnings before interest, tax, depreciation, and amortisation. Net sales minus direct costs minus operating expenses — operating cash-generating power before financing and capex accounting.",
    formula: "Net sales − direct costs − operating expenses",
  },
  {
    term: "EBIT",
    category: "profit",
    usedIn: "P&L",
    definition: "EBITDA minus depreciation and amortisation of equipment and fit-out.",
  },
  {
    term: "Planning net profit",
    aliases: ["Net profit (planning)"],
    category: "profit",
    usedIn: "P&L, Optimise, Home",
    definition:
      "Founder planning bottom line: net sales minus all modelled costs including depreciation, interest, and income tax where configured. Not statutory audited accounts.",
    formula: "EBIT − interest − income tax (simplified path through P&L)",
  },
  {
    term: "Reformer spot",
    aliases: ["Seat", "Capacity unit"],
    category: "capacity",
    usedIn: "Capacity, schedule",
    definition:
      "One reformer position in one scheduled class — the atomic unit of group-class capacity. A 3-reformer class at full occupancy = 3 spots.",
  },
  {
    term: "Booked occupancy",
    category: "capacity",
    usedIn: "Assumptions",
    definition:
      "Percentage of available reformer spots expected to be booked (reserved), before cancellations and no-shows.",
  },
  {
    term: "Attended occupancy",
    category: "capacity",
    usedIn: "Assumptions, unit economics",
    definition:
      "Percentage of spots where customers actually show up — after cancellation and no-show rates. Drives delivered-class economics.",
  },
  {
    term: "Utilisation",
    category: "capacity",
    usedIn: "Unit Economics",
    definition:
      "How fully reformers are used: attended seats divided by monthly available seats. Under-used reformers mean expensive idle capacity.",
  },
  {
    term: "Unused capacity",
    category: "capacity",
    usedIn: "Capacity page, insights",
    definition:
      "Scheduled reformer spots not expected to be booked under the current scenario. Physical availability — not a financial loss in the model.",
    notTheSameAs: "Lost revenue. Own-ed never books unused capacity as an expense.",
  },
  {
    term: "Unrealised revenue opportunity",
    category: "capacity",
    usedIn: "Capacity insights",
    definition:
      "Theoretical extra net sales if every unused spot were filled at current weighted price, assuming demand exists. Sizing tool only — not counted in P&L.",
  },
  {
    term: "Eligible capacity (pack safety)",
    category: "capacity",
    usedIn: "Pack Designer → Safe Pack Sales",
    definition:
      "Reformer spots available during a pack's validity window that pack-holders can book into — used to test whether selling more packs overcommits capacity.",
  },
  {
    term: "Service demand mix",
    category: "planning",
    usedIn: "Access Products → Mix",
    definition:
      "Out of every 100 service bookings, what share comes from Drop-In, 8-Pack, 16-Pack, and Private. Must total 100%. Standing and Standby are separate optional products.",
    example: "Drop-In 10%, 8-Pack 45%, 16-Pack 30%, Private 15%.",
  },
  {
    term: "Expected redemption",
    category: "products",
    usedIn: "Pack Designer, flexible packs",
    definition:
      "Planning assumption for what % of sold credits will actually be used before expiry. Affects expected delivery costs and capacity consumed — does not reduce net sales at purchase.",
    example: "8 credits sold, 85% redemption → 6.8 expected used, 1.2 expected unused.",
  },
  {
    term: "Breakage",
    category: "products",
    usedIn: "Credit health",
    definition:
      "Credits purchased but never redeemed before expiry. Net sales were already counted at purchase; breakage means lower delivery costs than if all credits were used.",
  },
  {
    term: "Outstanding credits",
    category: "products",
    usedIn: "Safe Pack Sales, credit health",
    definition:
      "Credits sold to customers not yet redeemed — a capacity obligation until expiry or use.",
  },
  {
    term: "Safe Pack Sales status",
    category: "products",
    usedIn: "Pack Designer",
    definition:
      "Comfortable / Tight / Overcommitted — compares expected redemptions (existing + new packs) against eligible capacity during the validity window.",
    notTheSameAs: "A precise behavioural forecast. Based on planning assumptions until real redemption data exists.",
  },
  {
    term: "Private session",
    category: "products",
    usedIn: "Mix, capacity, P&L",
    definition:
      "One-to-one reformer session with separate economics from group credits. Counts in demand mix but consumes capacity and instructor time on its own terms.",
  },
  {
    term: "Standing Spot",
    category: "products",
    usedIn: "Access Products → Standing",
    definition:
      "Optional reserved reformer at fixed class times. Removes flexible inventory from those slots. Modeled separately from the 100% base demand mix.",
  },
  {
    term: "Standby",
    category: "products",
    usedIn: "Access Products → Standby",
    definition:
      "Optional last-minute access to empty seats at a discount. Incremental contribution model — can cannibalise full-price sales if not careful.",
  },
  {
    term: "Cash collected",
    category: "cash",
    usedIn: "Cash Flow, payback",
    definition:
      "Money received when customers pay — typically full customer price incl. GST at pack purchase. Timing may differ from when services are delivered.",
    notTheSameAs: "Net sales timing in P&L for prepaid packs (planning counts net sales at purchase).",
  },
  {
    term: "Net sales at purchase (packs)",
    category: "cash",
    usedIn: "P&L, flexible packs",
    definition:
      "Own-ed planning convention: full net pack price counts as net sales when sold, not spread over redemption. Simplifies founder decisions on pricing and capacity.",
    notTheSameAs: "Revenue recognition accounting that defers unearned portions — not used in MVP planning.",
  },
  {
    term: "Operating cash flow",
    category: "cash",
    usedIn: "Cash Flow, payback",
    definition:
      "Cash in minus cash out from operations in a month — includes prepaid pack timing, rent, salaries, and variable costs.",
  },
  {
    term: "Launch investment",
    category: "investment",
    usedIn: "Assumptions → Capex, payback",
    definition:
      "Total cash needed to open: equipment, fit-out, deposits, working capital, and pre-opening costs before the studio generates sustainable cash.",
  },
  {
    term: "Payback month",
    category: "investment",
    usedIn: "Payback, Optimise",
    definition:
      "First month cumulative operating cash covers launch investment. Planning estimate — depends on ramp-up and occupancy assumptions.",
  },
  {
    term: "Contribution break-even occupancy",
    aliases: ["Break-even occupancy"],
    category: "investment",
    usedIn: "Break-even, Home",
    definition:
      "Minimum % of reformer spots that must be occupied (delivered) for total contribution to cover monthly fixed operating costs.",
    formula:
      "Fixed operating costs ÷ contribution per occupied spot ÷ monthly available spots × 100",
    notTheSameAs:
      "EBITDA break-even (higher threshold) or net profit break-even (includes depreciation, interest, tax).",
  },
  {
    term: "EBITDA break-even occupancy",
    category: "investment",
    usedIn: "Break-even",
    definition: "Occupancy at which EBITDA crosses zero — fixed costs fully covered at operating level.",
  },
  {
    term: "Incremental contribution",
    category: "planning",
    usedIn: "Standby, Private opportunity cost, Optimise",
    definition:
      "Extra contribution from an additional session or product after direct costs — used to compare optional strategies.",
  },
  {
    term: "Opportunity cost (Private)",
    category: "planning",
    usedIn: "Private economics",
    definition:
      "Net sales forgone from group spots not available because reformers/time are used for Private — helps price Private above group equivalent.",
  },
  {
    term: "Scenario / Base Case",
    category: "planning",
    usedIn: "Scenarios, Optimise",
    definition:
      "A saved set of assumptions (occupancy, prices, costs) compared side-by-side. Base Case is the primary planning reference.",
  },
  {
    term: "Optimise target profit",
    category: "planning",
    usedIn: "Optimise",
    definition:
      "Solver that finds how much to change occupancy, pricing, Private sessions, or fixed costs to reach a target planning net profit.",
  },
  {
    term: "Committed monthly revenue (Standing)",
    aliases: ["Capacity reservation value"],
    category: "products",
    usedIn: "Standing Spot",
    definition:
      "Net sales from active Standing Spot reservations this month — price for delivered reserved classes, not inherently more guaranteed than prepaid pack cash.",
  },
  {
    term: "Flexible inventory sacrificed",
    category: "products",
    usedIn: "Standing Spot",
    definition:
      "Reformer spots permanently reserved for Standing members, removed from the pool flexible credit bookers can use at that time.",
  },
  {
    term: "Uncommitted remaining capacity",
    category: "capacity",
    usedIn: "Credit health",
    definition:
      "Physical capacity minus expected occupied capacity — open spots credit-holders could potentially book.",
  },
];

const CURRENT_DEFINITIONS:Record<string,string>={
 'Net sales (ex-GST)':'Sales from actual modeled pack purchases plus explicitly supplied paid separate bookings, excluding output GST. Not the same as earned service value.',
 'Customer pays (incl. GST)':'Net purchase price plus configured output GST. The tax rate is a comparison input, not verified statutory advice.',
 'Service demand mix':'The current8/16pack mix is a NEW-customer split. Monthly purchases and delivered visits can have different proportions. Separate paid drop-ins and privates are explicit inputs.',
 'Expected redemption':'No fixed redemption haircut is assumed in the corrected model. Desired use, expiry, churn and renewal delay determine credits attended or left. Member no-shows are unknown, not silently zero measured facts.',
 'Breakage':'Unused credits that naturally expire. No forced10%credits are withheld from usability in the corrected engine. Sale, earned service value and obligations remain separate.',
 'Safe Pack Sales status':'No safe-sales guarantee is made. Monthly capacity screens flag planning breaches; passing them does not establish that returning customers fit their preferred slots.',
 'Private session':'A separately paid one-to-one booking. Explicit paid and attended counts drive receipt and visit costs. Spare private slots do not automatically sell.',
 'Standing Spot':'Optional reserved recurring-slot concept. Unit-economics tests do not activate it in the corrected working forecast or imply committed customer demand.',
 'Standby':'Optional last-minute empty-seat concept. Unit-economics tests do not activate revenue or establish incremental customers; cannibalisation and terms remain unresolved.',
 'Payback month':'For each cash-flow view, the first month cumulative dated receipts recover that view\'s initial outflow. Partner/founder payback uses distributions only; salary and terminal asset values are not added.',
 'Scenario / Base Case':'A captured set of explicit customer, renewal, paid-demand and operating assumptions. Base is a comparison case, not a guaranteed midpoint or validated forecast.',
 'Optimise target profit':'A full-redemption contribution threshold plus explicit acquisition what-if. Not a claimed global optimizer, buyer quota or physically executable plan.',
 'Committed monthly revenue (Standing)':'An optional product concept, not included or guaranteed revenue in the current working forecast.',
 'Net sales / credit':'Purchase price divided by pack credits. It is a purchase-value ratio, not fresh revenue every time a prepaid session is attended.',
 'Weighted net sales / occupied spot':'A unit-economics ratio only. The corrected forecast derives pack receipts from owned customer purchases, not occupied spots times weighted revenue.',
 'Eligible capacity (pack safety)':'A coarse capacity screen within a validity window. Without customer time preferences, existing bookings and no-shows it cannot prove slots are available.',
 'Planning net profit':'Sale-basis net sales less operating costs and comparison tax, plus separately shown FD interest and less depreciation. It is not statutory accrual profit.',
 'Uncommitted remaining capacity':'Theoretical spare seats are not sales and do not prove preferred-slot availability for pack holders.'
};
export const FINANCE_DICTIONARY:DictionaryEntry[]=[...EARLIER_DICTIONARY.map(e=>CURRENT_DEFINITIONS[e.term]?{...e,definition:CURRENT_DEFINITIONS[e.term],example:undefined,formula:undefined,notTheSameAs:undefined}:e),
 {term:'Monthly pack buyers',category:'products',aliases:['fresh payers','buyers'],definition:'Expected distinct customers buying at least one pack in a month. Multiple purchases by one cohort do not create additional buyers. Summed monthly buyers are not annual unique people.'},
 {term:'Valid-pack holders',category:'products',aliases:['active holders','valid customers'],definition:'Expected retained customers currently entitled to service from unexpired remaining credits. A valid16pack customer can attend without buying again this month.'},
 {term:'Retained customers between packs',category:'planning',aliases:['renewal gap','lapsed'],definition:'Customers not permanently churned but temporarily without a valid pack while awaiting the explicitly assumed renewal date. Not NEW acquisition.'},
 {term:'Service-earned revenue',category:'profit',definition:'Value recognized as owned credits are attended, forfeited or naturally expire, plus eligible separate service receipts. Different timing from purchase cash; never added on top of sales again.'},
 {term:'Capacity-infeasible scenario',category:'capacity',definition:'Demand exceeds a configured planning screen. Its unconstrained financial outputs are diagnostics, not an attainable operating forecast.'}
];

/** @deprecated Use FINANCE_DICTIONARY — kept for existing imports */
export const FINANCE_TERMINOLOGY = FINANCE_DICTIONARY.map(({ term, definition }) => ({
  term,
  definition,
}));

export function searchDictionary(query: string): DictionaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FINANCE_DICTIONARY;
  return FINANCE_DICTIONARY.filter(
    (e) =>
      e.term.toLowerCase().includes(q) ||
      e.aliases?.some((a) => a.toLowerCase().includes(q)) ||
      e.definition.toLowerCase().includes(q)
  );
}
