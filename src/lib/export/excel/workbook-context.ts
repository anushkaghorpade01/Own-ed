import type { FinancialExportModel } from "../types";
import type { ExportCellRegistry } from "./cell-registry";

export type WorkbookWriteContext = {
  data: FinancialExportModel;
  registry: ExportCellRegistry;
  mode: "full" | "quick";
};

export const SHEET = {
  assumptions: "ASSUMPTIONS",
  monthlyPl: "MONTHLY P&L",
  yearlyPl: "YEARLY P&L",
  cashFlow: "CASH FLOW",
  summary: "SUMMARY",
} as const;
