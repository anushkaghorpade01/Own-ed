import { searchGuide } from "@/lib/guide/search";
import { searchDictionary } from "@/lib/finance/finance-dictionary";
import {
  CAPEX_FIELDS,
  DEPOSIT_FIELDS,
  FINANCING_FIELDS,
  TAX_FIELDS,
} from "@/lib/finance/assumption-fields";
import type { AppState } from "@/lib/store/app-state";

export type GlobalSearchCategory =
  | "Page"
  | "Guide"
  | "Dictionary"
  | "Assumption"
  | "Studio"
  | "Scenario"
  | "Library"
  | "Decision"
  | "Question";

export interface GlobalSearchResult {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
}

interface PageEntry {
  title: string;
  href: string;
  group: string;
  keywords: string[];
}

/** Every navigable page + synonyms founders might search */
const APP_PAGES: PageEntry[] = [
  { title: "Home", href: "/", group: "Workspace", keywords: ["dashboard", "overview", "home"] },
  { title: "Math overview", href: "/math", group: "Math", keywords: ["math", "model", "finance"] },
  {
    title: "Assumptions",
    href: "/math/assumptions",
    group: "Math",
    keywords: [
      "assumptions",
      "rent",
      "salary",
      "occupancy",
      "capex",
      "tax",
      "loan",
      "deposit",
      "ramp",
      "reformers",
      "schedule",
      "gst",
    ],
  },
  {
    title: "Scenario Analysis",
    href: "/math/scenarios",
    group: "Math",
    keywords: ["scenario", "scenarios", "compare", "what if", "base case"],
  },
  {
    title: "Sales & Client Target",
    href: "/math/sales-target",
    group: "Math",
    keywords: ["sales", "clients", "target", "profit target", "month 8", "signups"],
  },
  {
    title: "Optimise",
    href: "/math/optimise",
    group: "Math",
    keywords: ["optimise", "optimize", "solver", "target profit"],
  },
  {
    title: "Capacity",
    href: "/math/capacity",
    group: "Math",
    keywords: [
      "capacity",
      "occupancy",
      "utilisation",
      "utilization",
      "reformers",
      "classes",
      "schedule",
      "spots",
      "seats",
      "booked",
    ],
  },
  {
    title: "Access Products",
    href: "/math/access-products",
    group: "Math",
    keywords: ["access", "products", "packs", "credits", "drop-in", "private"],
  },
  {
    title: "Flexible Credits",
    href: "/math/access-products/flexible",
    group: "Math",
    keywords: ["flexible", "credits", "pack", "8 pack", "16 pack"],
  },
  {
    title: "Pack Designer",
    href: "/math/access-products/pack-designer",
    group: "Math",
    keywords: ["pack designer", "pack design", "credits pack"],
  },
  {
    title: "Standing Spots",
    href: "/math/access-products/standing",
    group: "Math",
    keywords: ["standing", "standing spot"],
  },
  {
    title: "Standby",
    href: "/math/access-products/standby",
    group: "Math",
    keywords: ["standby", "waitlist"],
  },
  {
    title: "Service Demand Mix",
    href: "/math/access-products/mix",
    group: "Math",
    keywords: ["service mix", "demand mix", "product mix", "booking mix"],
  },
  {
    title: "Credit Health",
    href: "/math/access-products/credit-health",
    group: "Math",
    keywords: ["credit health", "liability", "outstanding credits", "coverage ratio", "eligible coverage"],
  },
  {
    title: "Pricing",
    href: "/math/pricing",
    group: "Math",
    keywords: ["pricing", "price", "gst", "net sales", "private price"],
  },
  {
    title: "Unit Economics",
    href: "/math/unit-economics",
    group: "Math",
    keywords: ["unit economics", "contribution", "margin", "per seat", "per spot"],
  },
  {
    title: "Monthly P&L",
    href: "/math/pl",
    group: "Math",
    keywords: ["p&l", "pl", "profit", "loss", "ebitda", "net profit", "depreciation", "income tax"],
  },
  {
    title: "Cash Flow",
    href: "/math/cash-flow",
    group: "Math",
    keywords: ["cash flow", "cash", "bank", "funding", "liquidity", "working capital"],
  },
  {
    title: "Break-even",
    href: "/math/break-even",
    group: "Math",
    keywords: ["break-even", "breakeven", "break even"],
  },
  {
    title: "Investment recovery",
    href: "/math/payback",
    group: "Math",
    keywords: ["payback", "investment", "recovery", "roi", "launch investment"],
  },
  {
    title: "Finance Dictionary",
    href: "/math/dictionary",
    group: "Math",
    keywords: ["dictionary", "glossary", "terms", "definitions"],
  },
  { title: "Actuals", href: "/math/actuals", group: "Math", keywords: ["actuals", "actual"] },
  { title: "Snapshots", href: "/math/snapshots", group: "Math", keywords: ["snapshots", "snapshot"] },
  { title: "Schedule", href: "/math/schedule", group: "Math", keywords: ["schedule", "timetable", "classes per day"] },
  { title: "Space", href: "/space", group: "Workspace", keywords: ["space", "mood board", "interior", "design"] },
  {
    title: "Studios",
    href: "/studios",
    group: "Workspace",
    keywords: ["studios", "competitor", "competitors", "benchmark", "research"],
  },
  { title: "Programming", href: "/programming", group: "Workspace", keywords: ["programming", "class types", "curriculum"] },
  { title: "Product", href: "/product", group: "Workspace", keywords: ["product", "concepts", "features"] },
  { title: "Brand", href: "/brand", group: "Workspace", keywords: ["brand", "logo", "copy", "references"] },
  { title: "Roadmap", href: "/roadmap", group: "Workspace", keywords: ["roadmap", "tasks", "launch", "todo"] },
  { title: "Library", href: "/library", group: "Workspace", keywords: ["library", "notes", "links", "inbox"] },
  { title: "Guide", href: "/guide", group: "Help", keywords: ["guide", "help", "how to", "documentation"] },
  { title: "Data & backups", href: "/settings/data", group: "Settings", keywords: ["backup", "export", "import", "data", "save"] },
];

const ASSUMPTION_FIELDS: Array<{ label: string; keywords?: string[] }> = [
  { label: "Booked occupancy", keywords: ["occupancy", "booked", "utilisation"] },
  { label: "Attended occupancy", keywords: ["attended", "no-show", "noshow"] },
  { label: "Reformers", keywords: ["reformers", "equipment"] },
  { label: "Max group class size", keywords: ["class size", "group size"] },
  { label: "Rent", keywords: ["rent"] },
  { label: "Owner instructor salary", keywords: ["owner salary", "instructor salary"] },
  { label: "Income tax rate", keywords: ["tax", "income tax"] },
  ...CAPEX_FIELDS.map((f) => ({ label: f.label, keywords: [f.label.toLowerCase(), f.key] })),
  ...FINANCING_FIELDS.map((f) => ({ label: f.label, keywords: [f.label.toLowerCase()] })),
  ...DEPOSIT_FIELDS.map((f) => ({ label: f.label, keywords: [f.label.toLowerCase(), "deposit"] })),
  ...TAX_FIELDS.map((f) => ({ label: f.label, keywords: [f.label.toLowerCase()] })),
];

function normalize(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function scoreTextMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = normalize(query);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;
  const words = q.split(" ");
  if (words.every((w) => t.includes(w))) return 60;
  return 0;
}

function mergeResult(map: Map<string, GlobalSearchResult>, result: GlobalSearchResult) {
  const existing = map.get(result.id);
  if (!existing || result.score > existing.score) {
    map.set(result.id, result);
  }
}

export function searchGlobal(query: string, state: AppState): GlobalSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const map = new Map<string, GlobalSearchResult>();

  for (const page of APP_PAGES) {
    let score = scoreTextMatch(page.title, q);
    for (const kw of page.keywords) {
      score = Math.max(score, scoreTextMatch(kw, q));
      if (kw.includes(q) || q.includes(kw)) score = Math.max(score, 75);
    }
    if (score > 0) {
      mergeResult(map, {
        id: `page:${page.href}`,
        category: "Page",
        title: page.title,
        subtitle: page.group,
        href: page.href,
        score,
      });
    }
  }

  for (const field of ASSUMPTION_FIELDS) {
    let score = scoreTextMatch(field.label, q);
    for (const kw of field.keywords ?? []) {
      score = Math.max(score, scoreTextMatch(kw, q));
    }
    if (score > 0) {
      mergeResult(map, {
        id: `assumption:${field.label}`,
        category: "Assumption",
        title: field.label,
        subtitle: "Assumptions",
        href: "/math/assumptions",
        score: score - 5,
      });
    }
  }

  for (const hit of searchGuide(q).slice(0, 8)) {
    mergeResult(map, {
      id: `guide:${hit.section.id}`,
      category: "Guide",
      title: hit.section.title,
      subtitle: hit.snippet.slice(0, 80) + (hit.snippet.length > 80 ? "…" : ""),
      href: `/guide#${hit.section.id}`,
      score: hit.score,
    });
  }

  for (const entry of searchDictionary(q).slice(0, 8)) {
    const score = Math.max(
      scoreTextMatch(entry.term, q),
      ...(entry.aliases?.map((a) => scoreTextMatch(a, q)) ?? []),
      scoreTextMatch(entry.definition, q) * 0.8
    );
    if (score > 0) {
      mergeResult(map, {
        id: `dict:${entry.term}`,
        category: "Dictionary",
        title: entry.term,
        subtitle: entry.definition.slice(0, 90) + (entry.definition.length > 90 ? "…" : ""),
        href: "/math/dictionary",
        score: Math.round(score * 0.95),
      });
    }
  }

  state.studios.forEach((s) => {
    const hay = [s.name, s.location, s.notes, s.liked].filter(Boolean).join(" ");
    const score = scoreTextMatch(hay, q);
    if (score > 0) {
      mergeResult(map, {
        id: `studio:${s.id}`,
        category: "Studio",
        title: s.name,
        subtitle: s.location || "Competitor research",
        href: "/studios",
        score,
      });
    }
  });

  state.scenarios.forEach((s) => {
    const score = scoreTextMatch(s.name, q);
    if (score > 0) {
      mergeResult(map, {
        id: `scenario:${s.id}`,
        category: "Scenario",
        title: s.name,
        subtitle: s.description || "Scenario",
        href: "/math/scenarios",
        score,
      });
    }
  });

  state.libraryItems.forEach((l) => {
    const score = Math.max(scoreTextMatch(l.title, q), scoreTextMatch(l.tags.join(" "), q));
    if (score > 0) {
      mergeResult(map, {
        id: `library:${l.id}`,
        category: "Library",
        title: l.title,
        subtitle: l.type,
        href: "/library",
        score: score - 10,
      });
    }
  });

  state.decisions.forEach((d) => {
    const score = Math.max(scoreTextMatch(d.title, q), scoreTextMatch(d.decision, q));
    if (score > 0) {
      mergeResult(map, {
        id: `decision:${d.id}`,
        category: "Decision",
        title: d.title,
        subtitle: "Decision log",
        href: "/",
        score: score - 15,
      });
    }
  });

  state.questions.forEach((item) => {
    const score = scoreTextMatch(item.question, q);
    if (score > 0) {
      mergeResult(map, {
        id: `question:${item.id}`,
        category: "Question",
        title: item.question,
        subtitle: "Open question",
        href: "/",
        score: score - 15,
      });
    }
  });

  return [...map.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 20);
}

export const POPULAR_SEARCHES = [
  "occupancy",
  "rent",
  "P&L",
  "cash flow",
  "break-even",
  "payback",
  "pricing",
  "assumptions",
];

export const CATEGORY_ORDER: GlobalSearchCategory[] = [
  "Page",
  "Assumption",
  "Guide",
  "Dictionary",
  "Studio",
  "Scenario",
  "Library",
  "Decision",
  "Question",
];

export function groupSearchResults(results: GlobalSearchResult[]): Array<{
  category: GlobalSearchCategory;
  items: GlobalSearchResult[];
}> {
  const groups = new Map<GlobalSearchCategory, GlobalSearchResult[]>();
  for (const r of results) {
    const list = groups.get(r.category) ?? [];
    list.push(r);
    groups.set(r.category, list);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}
