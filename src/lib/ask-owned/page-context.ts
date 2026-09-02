import type { OwnedPageContext } from "./types";

const DEFAULT: OwnedPageContext = {
  route: "/",
  title: "Own-ed",
  guideSectionIds: ["getting-started"],
  suggestedQuestions: [
    "What is net sales?",
    "Why is profit different from cash?",
    "When do I recover my investment?",
  ],
};

const REGISTRY: Array<{ test: (p: string) => boolean; ctx: OwnedPageContext }> = [
  {
    test: (p) => p.startsWith("/math/pl"),
    ctx: {
      route: "/math/pl",
      title: "Monthly P&L",
      guideSectionIds: ["pl", "profit-views"],
      suggestedQuestions: [
        "Why is this profit different from Month 8?",
        "What is depreciation?",
        "What is contribution?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/cash-flow"),
    ctx: {
      route: "/math/cash-flow",
      title: "Cash Flow & Bank Cash",
      guideSectionIds: ["cash-flow", "dont-confuse"],
      suggestedQuestions: [
        "Why is cash different from profit?",
        "Why does cash go negative?",
        "How much funding do I need?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/payback"),
    ctx: {
      route: "/math/payback",
      title: "Investment Recovery",
      guideSectionIds: ["payback"],
      suggestedQuestions: [
        "When do I recover my investment?",
        "What does this graph mean?",
        "What does the zero line mean?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/sales-target"),
    ctx: {
      route: "/math/sales-target",
      title: "Sales & Client Target",
      guideSectionIds: ["sales-client-target", "profit-views"],
      suggestedQuestions: [
        "How many clients do I need?",
        "Why is my forecast profit different from my sales plan?",
        "What is steady-state?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/capacity"),
    ctx: {
      route: "/math/capacity",
      title: "Capacity",
      guideSectionIds: ["capacity"],
      suggestedQuestions: [
        "What does occupancy mean?",
        "How many reformer spots do I have?",
        "At 75% occupancy, how many full 3/3 classes is that?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/unit-economics"),
    ctx: {
      route: "/math/unit-economics",
      title: "Unit Economics",
      guideSectionIds: ["unit-economics", "service-demand-mix"],
      suggestedQuestions: [
        "How is this number calculated?",
        "What is contribution margin?",
        "What is blended net sales?",
      ],
    },
  },
  {
    test: (p) => p.startsWith("/math/break-even"),
    ctx: {
      route: "/math/break-even",
      title: "Break-even",
      guideSectionIds: ["break-even"],
      suggestedQuestions: ["What is break-even?", "How many clients do I need?"],
    },
  },
  {
    test: (p) => p.startsWith("/math/pricing"),
    ctx: {
      route: "/math/pricing",
      title: "Pricing",
      guideSectionIds: ["pricing"],
      suggestedQuestions: ["What is net sales?", "What if Private is ₹4,500?"],
    },
  },
  {
    test: (p) => p.startsWith("/math/access-products/mix"),
    ctx: {
      route: "/math/access-products/mix",
      title: "Service Demand Mix",
      guideSectionIds: ["service-demand-mix"],
      suggestedQuestions: ["What is service demand mix?", "How is blended net sales calculated?"],
    },
  },
  {
    test: (p) => p.startsWith("/math/assumptions"),
    ctx: {
      route: "/math/assumptions",
      title: "Assumptions",
      guideSectionIds: ["assumptions"],
      suggestedQuestions: ["What can I change here?", "What is occupancy?"],
    },
  },
  {
    test: (p) => p.startsWith("/math"),
    ctx: {
      route: "/math",
      title: "Math",
      guideSectionIds: ["math-overview"],
      suggestedQuestions: [
        "Why is profit different from cash?",
        "What is net sales?",
        "When do I recover my investment?",
      ],
    },
  },
];

export function getOwnedPageContext(pathname: string): OwnedPageContext {
  const hit = REGISTRY.find((r) => r.test(pathname));
  return hit?.ctx ?? DEFAULT;
}
