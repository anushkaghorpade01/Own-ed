import type { GuideSection } from "./types";

export const serviceMixVsSalesPlanSection: GuideSection = {
  id: "service-mix-vs-sales-plan",
  title: "Service demand mix vs sales plan vs capacity",
  category: "Math",
  keywords: [
    "service demand mix",
    "sales plan",
    "capacity",
    "bookings",
    "credits",
    "what-if",
    "feasibility",
  ],
  aliases: [
    "mix vs plan",
    "sales plan match mix",
    "why credits",
    "delivery check",
  ],
  body: [
    "OWNED separates three related ideas. They are not interchangeable.",
    "SERVICE DEMAND MIX — What I expect. Your forecast assumption for where occupied bookings are expected to come from. OWNED uses it to build the forecast.",
    "YOUR SALES PLAN — What I want to test. Enter any combination of Drop-Ins, packs and Private sessions. It does not have to match the forecast mix.",
    "CAPACITY CHECK — Can I actually deliver it? OWNED checks whether reformers, schedule and instructor time can service the demand your plan creates.",
    "Sales are not bookings. One 8-Pack sale creates 8 credits. One Drop-In creates 1 credit. One Private session is 1 session.",
    "Pack net sales count commercially when sold. Credits matter for capacity and delivery timing — they do not reduce the net sales value of a pack already sold.",
    "Capacity feasibility is not customer demand. OWNED can check physical delivery; it cannot guarantee customers will buy your plan.",
  ],
  payAttention: [
    "Changing Service Demand Mix does not change an already-entered manual Sales Plan.",
    "Suggest from service mix loads a starting point — edit freely afterward.",
  ],
  related: [
    { id: "sales-client-target", label: "Sales & Client Target" },
    { id: "service-demand-mix", label: "Service demand mix" },
    { id: "credits", label: "Credits" },
    { id: "dont-confuse", label: "Don't confuse sales & bookings" },
  ],
};

export const exportFinancialModelSection: GuideSection = {
  id: "export-financial-model",
  title: "Exporting your financial model",
  category: "Using Own-ed",
  keywords: ["export", "excel", "download", "workbook", "spreadsheet", "csv"],
  aliases: ["export excel", "financial model export"],
  body: [
    "Full Financial Model — a complete Excel workbook for founder, advisor, CA or investor review.",
    "Quick Financial Summary — core pages only: Read Me, Summary, Assumptions, Monthly P&L, Yearly P&L, Cash Flow.",
    "Current Page CSV — raw table data for the section you are viewing (no styled reporting).",
    "The Excel file is a snapshot of OWNED at the time you export. Changing the Excel file does not change OWNED.",
    "OWNED remains the source model. The export uses the same canonical finance engine calculations.",
  ],
  related: [
    { id: "you-vs-owned", label: "What you set vs what OWNED calculates" },
    { id: "pl", label: "P&L" },
    { id: "cash-flow", label: "Cash Flow" },
  ],
};
