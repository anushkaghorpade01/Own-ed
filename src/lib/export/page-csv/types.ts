export interface PageCsvExport {
  pageTitle: string;
  pathname: string;
  headers: string[];
  rows: (string | number | null)[][];
}

export interface PageCsvBuildInput {
  assumptions: import("@/lib/finance/schemas").FinanceAssumptions;
  scenarios?: import("@/lib/finance/schemas").Scenario[];
}

export interface PageCsvRoute {
  /** Longest-prefix or exact match against normalized pathname */
  test: (pathname: string) => boolean;
  pageTitle: string;
  build: (input: PageCsvBuildInput) => PageCsvExport;
}
