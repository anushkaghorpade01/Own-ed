import { describe, it, expect } from "vitest";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { createSampleScenarios } from "@/lib/finance/sample-data";
import {
  buildPageCsvExport,
  pageCsvExportSupported,
  serializeCsvTable,
  escapeCsvField,
  buildPageCsvFilename,
} from "@/lib/export/page-csv";

describe("Page CSV export", () => {
  const assumptions = createSampleAssumptions();
  const scenarios = createSampleScenarios(assumptions);

  it("supports key math pages", () => {
    expect(pageCsvExportSupported("/math/pl")).toBe(true);
    expect(pageCsvExportSupported("/math/cash-flow")).toBe(true);
    expect(pageCsvExportSupported("/math/sales-target")).toBe(true);
    expect(pageCsvExportSupported("/math/scenarios")).toBe(true);
    expect(pageCsvExportSupported("/guide")).toBe(false);
    expect(pageCsvExportSupported("/")).toBe(false);
  });

  it("builds P&L CSV with planning net profit row", () => {
    const exp = buildPageCsvExport("/math/pl", { assumptions })!;
    expect(exp.headers).toEqual(["Line item", "Amount (INR)"]);
    const profitRow = exp.rows.find((r) => r[0] === "Planning net profit");
    expect(profitRow).toBeDefined();
    expect(typeof profitRow![1]).toBe("number");
  });

  it("builds cash flow CSV with 36 months", () => {
    const exp = buildPageCsvExport("/math/cash-flow", { assumptions })!;
    expect(exp.rows.length).toBeGreaterThanOrEqual(36);
    expect(exp.headers).toContain("Bank cash");
  });

  it("builds sales target with custom plan quantities", () => {
    const withPlan = {
      ...assumptions,
      salesTargetPreferences: {
        ...assumptions.salesTargetPreferences!,
        customSalesQuantitiesByProductId: {
          "drop-in": 6,
          "8-pack": 15,
          "16-pack": 3,
          "private-session": 2,
        },
      },
    };
    const exp = buildPageCsvExport("/math/sales-target", { assumptions: withPlan })!;
    const dropIn = exp.rows.find((r) => String(r[0]).toLowerCase().includes("drop-in"));
    expect(dropIn?.[2]).toBe(6);
  });

  it("builds scenario comparison when scenarios exist", () => {
    const exp = buildPageCsvExport("/math/scenarios", { assumptions, scenarios })!;
    expect(exp.headers.length).toBeGreaterThan(1);
    expect(exp.rows.some((r) => r[0] === "Net profit")).toBe(true);
  });

  it("escapes CSV fields with commas and quotes", () => {
    expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(serializeCsvTable(["A", "B"], [["x", 1]])).toBe("A,B\r\nx,1");
  });

  it("filename is descriptive", () => {
    const exp = buildPageCsvExport("/math/pl", { assumptions })!;
    expect(buildPageCsvFilename(exp)).toMatch(/^OWNED_Profit_and_Loss_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("rent change reflects in assumptions CSV", () => {
    const base = buildPageCsvExport("/math/assumptions", { assumptions })!;
    const higher = buildPageCsvExport("/math/assumptions", {
      assumptions: { ...assumptions, rent: assumptions.rent + 50_000 },
    })!;
    const baseRent = base.rows.find((r) => r[1] === "Rent")?.[2];
    const highRent = higher.rows.find((r) => r[1] === "Rent")?.[2];
    expect(highRent).toBe((baseRent as number) + 50_000);
  });
});
