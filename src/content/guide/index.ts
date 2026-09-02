import type { GuideGroup, GuideSection } from "./types";
import { gettingStartedSections } from "./getting-started";
import { mathSections } from "./math";
import { profitViewsSection } from "./profit-views";
import { serviceMixVsSalesPlanSection } from "./service-mix-sales-plan";
import { workspaceSections } from "./workspace";
import {
  usingOwnedSections,
  troubleshootingSections,
} from "./using-owned";
import { exportFinancialModelSection } from "./service-mix-sales-plan";

export const GUIDE_GROUPS: GuideGroup[] = [
  { category: "Getting Started", sections: gettingStartedSections },
  { category: "Math", sections: [profitViewsSection, serviceMixVsSalesPlanSection, ...mathSections] },
  { category: "Workspace", sections: workspaceSections },
  { category: "Using Own-ed", sections: [...usingOwnedSections, exportFinancialModelSection] },
  { category: "Troubleshooting", sections: troubleshootingSections },
];

/** Flat list — single source of truth for index and search */
export const ALL_GUIDE_SECTIONS: GuideSection[] = GUIDE_GROUPS.flatMap(
  (g) => g.sections
);

export function getGuideSection(id: string): GuideSection | undefined {
  return ALL_GUIDE_SECTIONS.find((s) => s.id === id);
}

export { GUIDE_VERSION } from "./types";
export type { GuideSection, GuideGroup, GuideCategory } from "./types";
