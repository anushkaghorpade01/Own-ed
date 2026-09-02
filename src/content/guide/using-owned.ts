import type { GuideSection } from "./types";

export const usingOwnedSections: GuideSection[] = [
  {
    id: "ask-owned",
    title: "Ask OWNED",
    category: "Using Own-ed",
    keywords: ["ask", "assistant", "help", "local", "offline", "what-if"],
    aliases: ["ask owned", "local assistant"],
    body: [
      "Ask OWNED is a local model assistant. It uses OWNED's calculations and Guide to explain numbers, answer common questions, and run temporary what-if checks.",
      "It does not send your data to an external AI service. Everything runs on this device using your current assumptions and the finance engine.",
      "If Ask OWNED cannot answer confidently, it will say so and point you to the Guide or suggested questions.",
      "What-if checks preview changes without saving. Use Apply to assumptions only when you want to keep a change.",
    ],
  },
  {
    id: "you-vs-owned",
    title: "What you set vs what Own-ed calculates",
    category: "Using Own-ed",
    keywords: ["control", "input", "output", "calculate", "set"],
    body: [
      "You set: rent, pricing (net ex-GST), reformers and classes, service demand mix, operating costs, target profit, cost escalation, setup investment.",
      "Own-ed calculates: net sales, contribution, EBITDA, net profit, break-even occupancy, cash timing, payback month, required sales and clients, implied occupancy, scenario comparisons.",
    ],
  },
  {
    id: "dont-confuse",
    title: "Don't confuse these",
    category: "Using Own-ed",
    keywords: ["confuse", "difference", "vs", "compare", "profit cash", "gst"],
    aliases: ["profit vs cash", "why is profit different from cash"],
    body: [
      "Customer price vs net sales — customer pays GST inclusive; model uses net ex-GST.",
      "Profit vs cash — profit is accrual-style monthly P&L; cash includes timing, prepayment, and investment.",
      "Sales vs bookings — a pack sale is one sale; redemptions are many bookings over time.",
      "Clients vs transactions — one client can buy multiple products or book many sessions.",
      "Credits sold vs credits used — sold when purchased; used when redeemed on schedule.",
      "Physical classes vs occupied reformer spots — one class can have multiple reformers occupied.",
    ],
  },
  {
    id: "smoke-tests",
    title: "How do I know Own-ed is working?",
    category: "Using Own-ed",
    keywords: ["test", "verify", "working", "smoke", "check"],
    aliases: ["how to test"],
    body: [
      "Test 1 — Rent: change rent on Assumptions → P&L, break-even, and sales target should shift → refresh → rent persists.",
      "Test 2 — 8-pack price: change price → Unit Economics and P&L update → refresh → price persists.",
      "Test 3 — Target profit: change on Sales & Client Target → required sales and clients change.",
      "Test 4 — Private: change private price or mix → revenue, contribution, and capacity-related outputs update.",
      "Test 5 — Local save: add a Brand item or note → refresh → it still exists (header shows Saved locally).",
    ],
    related: [{ id: "saving", label: "Saving & backups" }],
  },
  {
    id: "saving",
    title: "Where is my work saved?",
    category: "Using Own-ed",
    keywords: ["save", "saved", "local", "backup", "indexeddb", "browser", "device", "folder"],
    aliases: ["where are my images saved", "persistence", "storage"],
    body: [
      "Own-ed automatically saves your working data locally in this browser on this device — no cloud account required.",
      "The header shows Local and Saved locally with a timestamp. Edits debounce and save without a Save button.",
      "Optional: connect an Own-ed folder (Settings → Data) to mirror JSON backups and uploaded files. Google sync is optional backup only.",
    ],
    related: [{ id: "backups", label: "Backups" }],
  },
  {
    id: "backups",
    title: "Backups",
    category: "Using Own-ed",
    keywords: ["backup", "export", "import", "restore", "folder", "json"],
    body: [
      "Settings → Data & Backups: Export backup downloads owned-backup-v1 JSON. Import replaces or merges after confirmation.",
      "Choose folder creates Own-ed/ with data/, brand/, space/, and backups/ subfolders on your computer (Chrome/Edge).",
      "Clear local data removes browser storage only — folder files are not deleted unless you choose to.",
    ],
  },
  {
    id: "monthly-routine",
    title: "A simple monthly routine",
    category: "Using Own-ed",
    keywords: ["monthly", "routine", "review", "process", "habit"],
    body: [
      "1. Update actual costs in Assumptions when bills change.",
      "2. Check current P&L at planned occupancy.",
      "3. Compare net profit to your target on Sales & Client Target.",
      "4. Note the sales/client gap and capacity status.",
      "5. Run a scenario before any major pricing, rent, or capacity decision.",
    ],
  },
];

export const troubleshootingSections: GuideSection[] = [
  {
    id: "when-wrong",
    title: "When a number looks wrong",
    category: "Troubleshooting",
    keywords: ["wrong", "bug", "incorrect", "fix", "troubleshoot", "issue"],
    aliases: ["number looks wrong", "error"],
    body: [
      "1. Check Assumptions — rent, occupancy, mix, and pricing are the usual culprits.",
      "2. Open How is this calculated? on the page if available.",
      "3. Change one input and confirm the output moves in the expected direction.",
      "4. Check units — net vs gross, monthly vs per-session, per pack vs per credit.",
      "5. Use Ask OWNED or the Finance Dictionary if a definition or formula is unclear.",
    ],
    related: [{ id: "dictionary", label: "Finance Dictionary" }],
  },
];
