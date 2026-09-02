import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import { createSampleScenarios } from "@/lib/finance/sample-data";
import { buildFinancialExportModel, validateExportModel } from "@/lib/export/build-export-model";
import { exportToExcel } from "@/lib/export/excel/write-workbook";
import { runFinanceModel } from "@/lib/finance/run-model";
import { getMonthForecastProfit } from "@/lib/finance/engine/sales-client-target";

describe("Financial export", () => {
  const assumptions = createSampleAssumptions();
  const scenarios = createSampleScenarios(assumptions);

  it("builds export model from canonical engine", () => {
    const model = buildFinancialExportModel({ assumptions, scenarios });
    expect(model.metadata.engineVersion).toBeTruthy();
    expect(model.model.pl.netProfit).toBeDefined();
    expect(model.healthChecks.length).toBeGreaterThan(0);
  });

  it("full workbook contains expected sheets", async () => {
    const model = buildFinancialExportModel({ assumptions, scenarios });
    const buffer = await exportToExcel(model, "full");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const names = wb.worksheets.map((s) => s.name);
    expect(names).toContain("READ ME");
    expect(names).toContain("SUMMARY");
    expect(names).toContain("ASSUMPTIONS");
    expect(names).toContain("MONTHLY P&L");
    expect(names).toContain("SERVICE MIX");
    expect(names).toContain("MODEL CHECKS");
  });

  it("summary forecast profit matches canonical engine", async () => {
    const prefs = assumptions.salesTargetPreferences!;
    const month = prefs.targetMonth ?? 8;
    const model = buildFinancialExportModel({ assumptions, scenarios, selectedMonth: month });
    const forecast = getMonthForecastProfit(assumptions, month);
    expect(model.salesTarget.forecastProfit).toBeCloseTo(forecast.toNumber(), 0);
  });

  it("year 1 P&L reconciles to months 1–12", () => {
    const model = buildFinancialExportModel({ assumptions });
    const year1Monthly = model.model.monthlyProjection
      .filter((m) => m.month >= 1 && m.month <= 12)
      .reduce((s, m) => s + m.pl.netProfit.toNumber(), 0);
    const year1Annual = model.model.yearlyPL.years[0]?.netProfit.toNumber() ?? 0;
    expect(year1Monthly).toBeCloseTo(year1Annual, 0);
  });

  it("custom sales plan quantities export separately from forecast mix", () => {
    const customQty = { "drop-in": 6, "8-pack": 15, "16-pack": 3, private: 2 };
    const withPlan = {
      ...assumptions,
      salesTargetPreferences: {
        ...assumptions.salesTargetPreferences!,
        customSalesQuantitiesByProductId: customQty,
      },
    };
    const model = buildFinancialExportModel({ assumptions: withPlan });
    expect(model.salesTarget.planQuantities["drop-in"]).toBe(6);
    expect(model.salesTarget.planQuantities["8-pack"]).toBe(15);
    const mixTotal = model.serviceMix.forecastMix.reduce((s, r) => s + r.bookingMixPct, 0);
    expect(mixTotal).toBeCloseTo(100, 0);
  });

  it("rent change flows through export model", () => {
    const base = buildFinancialExportModel({ assumptions });
    const higherRent = buildFinancialExportModel({
      assumptions: { ...assumptions, rent: assumptions.rent + 50_000 },
    });
    expect(higherRent.model.pl.netProfit.toNumber()).toBeLessThan(
      base.model.pl.netProfit.toNumber()
    );
    expect(higherRent.assumptions.rent).toBe(assumptions.rent + 50_000);
  });

  it("constraint warnings do not block export validation", () => {
    const model = buildFinancialExportModel({ assumptions, scenarios });
    const { blocking, warnings } = validateExportModel(model);
    expect(blocking).toEqual([]);
    const constraintFails = model.healthChecks.filter(
      (c) => !c.passed && c.id.startsWith("constraint-")
    );
    if (constraintFails.length > 0) {
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes("Peak slots") || w.includes("credits"))).toBe(true);
    }
  });

  it("quick export has fewer sheets than full", async () => {
    const model = buildFinancialExportModel({ assumptions });
    const full = await exportToExcel(model, "full");
    const quick = await exportToExcel(model, "quick");
    const wbFull = new ExcelJS.Workbook();
    const wbQuick = new ExcelJS.Workbook();
    await wbFull.xlsx.load(full);
    await wbQuick.xlsx.load(quick);
    expect(wbFull.worksheets.length).toBeGreaterThan(wbQuick.worksheets.length);
  });

  it("exports Excel formulas and cross-sheet links", async () => {
    const model = buildFinancialExportModel({ assumptions, scenarios });
    const buffer = await exportToExcel(model, "quick");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const formulaOf = (cell: ExcelJS.Cell) => {
      const v = cell.value;
      if (v && typeof v === "object" && "formula" in v) return (v as { formula: string }).formula;
      return cell.formula;
    };

    const monthly = wb.getWorksheet("MONTHLY P&L")!;
    expect(formulaOf(monthly.getCell(4, 2))).toMatch(/B2-B3/);

    const yearly = wb.getWorksheet("YEARLY P&L")!;
    expect(formulaOf(yearly.getCell(2, 2))).toMatch(/SUM\('MONTHLY P&L'!B2:M2\)/);

    const summary = wb.getWorksheet("SUMMARY")!;
    let reformersFormula: string | undefined;
    let year1SalesFormula: string | undefined;
    summary.eachRow((r) => {
      const label = String(r.getCell(1).value ?? "");
      const f = formulaOf(r.getCell(2));
      if (label === "Reformers") reformersFormula = f;
      if (label === "Year 1 net sales") year1SalesFormula = f;
    });
    expect(reformersFormula).toMatch(/ASSUMPTIONS/);
    expect(year1SalesFormula).toMatch(/YEARLY P&L/);
  });
});
