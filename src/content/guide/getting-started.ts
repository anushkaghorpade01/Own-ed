import type { GuideSection } from "./types";

export const gettingStartedSections: GuideSection[] = [
  {
    id: "start-here",
    title: "Start here",
    category: "Getting Started",
    keywords: ["start", "begin", "first time", "new", "overview"],
    aliases: ["getting started", "onboarding"],
    body: [
      "Own-ed helps you plan a boutique Pilates studio before you open — and stress-test the numbers as decisions change.",
      "You set assumptions (rent, pricing, schedule). Own-ed calculates profit, cash, break-even, and what you need to sell to hit a target.",
      "Nothing here is accounting advice. Use it to think clearly, then confirm tax and structure with your CA.",
    ],
    related: [
      { id: "five-minute-setup", label: "5-minute setup" },
      { id: "how-owned-thinks", label: "How Own-ed thinks" },
    ],
  },
  {
    id: "what-owned-is",
    title: "What Own-ed is",
    category: "Getting Started",
    keywords: ["what is", "purpose", "planning", "founder"],
    body: [
      "Own-ed is a founder planning workspace — not a booking system, not a CRM, not your books.",
      "Math pages model economics. Space, Brand, and Studios hold your research and decisions. Everything saves locally on your device.",
    ],
  },
  {
    id: "five-minute-setup",
    title: "The 5-minute setup",
    category: "Getting Started",
    keywords: ["setup", "order", "first steps", "quick start"],
    aliases: ["5 minute", "five minute"],
    body: [
      "1. Set core assumptions — rent, staff, setup investment, tax.",
      "2. Set product pricing — drop-in, packs, private (net ex-GST).",
      "3. Check capacity — reformers, classes per day, occupancy.",
      "4. Set service demand mix — how occupied bookings split across products.",
      "5. Open P&L — does the base case make sense?",
      "6. Set a target monthly net profit on Sales & Client Target.",
      "7. See required sales, clients, and whether capacity can deliver.",
      "8. Test a scenario — e.g. higher rent or lower occupancy.",
    ],
    related: [
      { id: "assumptions", label: "Assumptions" },
      { id: "sales-client-target", label: "Sales & Client Target" },
    ],
  },
  {
    id: "how-owned-thinks",
    title: "How Own-ed thinks",
    category: "Getting Started",
    keywords: ["flow", "logic", "upstream", "downstream", "model"],
    body: [
      "Assumptions → Pricing → Capacity → Service / sales mix → Revenue & costs → Profit → Cash → Payback.",
      "For targets: Target profit → Sales required → Clients required → Expected bookings → Capacity check.",
      "Change something upstream and downstream pages update. Example: higher rent flows to P&L, break-even, sales target, and payback.",
    ],
    related: [
      { id: "you-vs-owned", label: "What you set vs what Own-ed calculates" },
      { id: "dont-confuse", label: "Don't confuse these" },
    ],
  },
];
