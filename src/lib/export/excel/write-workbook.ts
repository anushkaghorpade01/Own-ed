import ExcelJS from "exceljs";
import type { FinancialExportModel } from "../types";
import { exportNum, exportWholePct } from "../decimal";
import { ExportCellRegistry, colLetter } from "./cell-registry";
import { SHEET, type WorkbookWriteContext } from "./workbook-context";
import {
  FONT,
  FORMATS,
  COLORS,
  applyCurrencyCell,
  applyPercentCell,
  applyFormulaCell,
  applyLinkCell,
  enableAutoFilter,
  formatExportDate,
  hideGridlines,
  setColumnWidths,
  setLandscapePrint,
  styleHeaderRow,
  writeLabelValue,
  writeSectionTitle,
} from "./styles";
import {
  CAPEX_FIELDS,
  FINANCING_FIELDS,
} from "@/lib/finance/assumption-fields";
import { getCoreSalesProducts } from "@/lib/finance/engine/sales-client-target";
import {
  analyzeFlexiblePack,
  resolvePackRules,
} from "@/lib/finance/engine/flexible-packs";
import { productNetPrice } from "@/lib/finance/engine/product-pricing";
import { privateContributionPerSession } from "@/lib/finance/engine/private-economics";
import { getSalesPlanProductLabel } from "@/lib/finance/sales-plan-labels";

function writeReadMe(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("READ ME");
  hideGridlines(sheet);
  setColumnWidths(sheet, [48, 40]);

  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = "OWNED Financial Model Export";
  sheet.getCell("A1").font = { name: FONT, size: 16, bold: true };

  let row = 3;
  const lines = [
    "What this workbook is",
    "A snapshot of the current OWNED planning model.",
    "",
    "Important",
    "This workbook contains planning outputs, not audited financial statements.",
    "",
    `Scenario: ${data.metadata.scenarioName}`,
    `Selected month: Month ${data.metadata.selectedMonth}`,
    `Export date: ${formatExportDate(data.metadata.exportDate)}`,
    `OWNED version: ${data.metadata.engineVersion} / ${data.metadata.formulaVersion}`,
    "",
    "Value types",
    "FOUNDER INPUT — a value entered by you",
    "CALCULATED — an output derived by OWNED",
    "PLANNING DEFAULT — a default assumption to review",
    "",
    "Key reminders",
    "Profit is not cash.",
    "Founder funding is not profit.",
    "Initial investment is tracked separately from monthly P&L.",
    "",
    "This workbook is a snapshot.",
    "OWNED remains the source model.",
    "Changes made directly inside this Excel workbook do not flow back into OWNED.",
    "",
    "Formulas in this workbook",
    "Light blue cells contain Excel formulas — totals, roll-ups and cross-sheet links.",
    "White / beige cells are OWNED engine outputs (monthly projection, cash flow, pack economics).",
    "Editing an assumption cell recalculates linked summary and P&L roll-ups in Excel.",
    "Complex timing (ramp-up, credits, funding) remains engine-calculated — re-export from OWNED to refresh those.",
  ];

  for (const line of lines) {
    sheet.getCell(row, 1).value = line;
    sheet.getCell(row, 1).font = {
      name: FONT,
      size: line.endsWith(":") || line === "Important" || line === "Key reminders" ? 11 : 10,
      bold: line.endsWith(":") || line === "Important" || line === "Key reminders",
    };
    sheet.getCell(row, 1).alignment = { wrapText: true };
    row++;
  }
}

function writeSummary(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet(SHEET.summary);
  hideGridlines(sheet);
  setColumnWidths(sheet, [36, 22, 40]);
  const { model, assumptions, salesTarget, metadata } = data;
  const monthCol = metadata.selectedMonth + 1;

  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = "OWNED — FINANCIAL MODEL SUMMARY";
  sheet.getCell("A1").font = { name: FONT, size: 16, bold: true };

  let row = 3;
  writeSectionTitle(sheet, row, "Model context", 3);
  row++;
  writeLabelValue(sheet, row++, "Scenario", metadata.scenarioName);
  writeLabelValue(sheet, row++, "Selected month", `Month ${metadata.selectedMonth}`);
  writeLabelValue(sheet, row++, "Export date", formatExportDate(metadata.exportDate));
  row++;

  writeSectionTitle(sheet, row, "Business setup", 3);
  row++;
  sheet.getCell(row, 1).value = "Reformers";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("input.reformers"), FORMATS.count);
  sheet.getCell(row, 3).value = "Linked to ASSUMPTIONS";
  row++;
  writeLabelValue(sheet, row++, "Classes/week", exportNum(model.capacity.weeklyClasses), {
    valueType: "CALCULATED",
  });
  writeLabelValue(
    sheet,
    row++,
    "Available monthly reformer spots",
    exportNum(model.capacity.monthlyAvailableSeats),
    { valueType: "CALCULATED" }
  );
  sheet.getCell(row, 1).value = "Target occupancy";
  const occRef = registry.absRef("input.target_occupancy_pct");
  if (occRef) {
    applyFormulaCell(sheet.getCell(row, 2), `${occRef}/100`, FORMATS.percent);
  } else {
    applyPercentCell(sheet.getCell(row, 2), assumptions.projectedBookedOccupancyPct);
  }
  sheet.getCell(row, 3).value = "Linked to ASSUMPTIONS";
  row++;
  row++;

  writeSectionTitle(sheet, row, "Financial summary", 3);
  row++;
  sheet.getCell(row, 1).value = `Month ${metadata.selectedMonth} forecast net sales`;
  applyLinkCell(
    sheet.getCell(row, 2),
    registry.cellRef("monthly.net_sales", monthCol),
    FORMATS.currency
  );
  sheet.getCell(row, 3).value = "Linked to MONTHLY P&L";
  row++;
  sheet.getCell(row, 1).value = `Month ${metadata.selectedMonth} forecast planning net profit`;
  applyLinkCell(
    sheet.getCell(row, 2),
    registry.cellRef("monthly.net_profit", monthCol),
    FORMATS.currency
  );
  sheet.getCell(row, 3).value = "Linked to MONTHLY P&L";
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Steady-state monthly net sales",
    exportNum(model.pl.netRevenue),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED", notes: "Engine steady-state" }
  );
  writeLabelValue(
    sheet,
    row++,
    "Steady-state planning net profit",
    exportNum(model.pl.netProfit),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED", notes: "Engine steady-state" }
  );
  sheet.getCell(row, 1).value = "Year 1 net sales";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("yearly.net_sales.y1"), FORMATS.currency);
  sheet.getCell(row, 3).value = "Linked to YEARLY P&L";
  row++;
  sheet.getCell(row, 1).value = "Year 1 planning net profit";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("yearly.net_profit.y1"), FORMATS.currency);
  sheet.getCell(row, 3).value = "Linked to YEARLY P&L";
  row++;
  row++;

  writeSectionTitle(sheet, row, "Three profit views", 3);
  row++;
  sheet.getCell(row, 1).value = "Selected month forecast profit";
  applyLinkCell(
    sheet.getCell(row, 2),
    registry.cellRef("monthly.net_profit", monthCol),
    FORMATS.currency
  );
  sheet.getCell(row, 3).value = "Monthly projection";
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Steady-state monthly profit",
    exportNum(model.pl.netProfit),
    { valueFormat: FORMATS.currency, notes: "At target occupancy" }
  );
  writeLabelValue(
    sheet,
    row++,
    "Your sales plan profit",
    exportNum(salesTarget.planSolution.planningNetProfit),
    { valueFormat: FORMATS.currency, notes: "From manual quantities entered" }
  );
  sheet.getCell(row, 1).value =
    "These are three views of Planning Net Profit using different inputs/timeframes.";
  sheet.getCell(row, 1).font = { name: FONT, size: 9, italic: true };
  sheet.getCell(row, 1).alignment = { wrapText: true };
  row += 2;

  writeSectionTitle(sheet, row, "Break-even", 3);
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Break-even occupancy",
    exportWholePct(exportNum(model.breakEven.contributionBreakEven.breakEvenOccupancyPct)!),
    { valueFormat: FORMATS.percent, valueType: "CALCULATED" }
  );
  row++;

  writeSectionTitle(sheet, row, "Funding", 3);
  row++;
  const health = model.cashFlow.cashHealth;
  writeLabelValue(
    sheet,
    row++,
    "Launch investment",
    exportNum(model.cashFlow.launch.paybackInvestmentBase),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED" }
  );
  sheet.getCell(row, 1).value = "Founder funding planned";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("input.founder_equity"), FORMATS.currency);
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Minimum funding required",
    exportNum(health.minimumTotalFundingRequired),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED" }
  );
  writeLabelValue(sheet, row++, "Funding gap", exportNum(health.fundingGap), {
    valueFormat: FORMATS.currency,
    valueType: "CALCULATED",
  });
  row++;

  writeSectionTitle(sheet, row, "Payback", 3);
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Investment hurdle",
    exportNum(model.cashFlow.launch.paybackInvestmentBase),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED" }
  );
  writeLabelValue(
    sheet,
    row++,
    "Expected payback month",
    model.payback.paybackMonth ?? "N/A"
  );
  const lastMonth = model.cashFlow.monthly[model.cashFlow.monthly.length - 1];
  writeLabelValue(
    sheet,
    row++,
    "Final-month recovery position",
    exportNum(lastMonth?.recoveryPosition),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED" }
  );
  row++;

  writeSectionTitle(sheet, row, "Target", 3);
  row++;
  writeLabelValue(sheet, row++, "Target monthly profit", salesTarget.targetProfit, {
    valueFormat: FORMATS.currency,
    valueType: "FOUNDER INPUT",
  });
  sheet.getCell(row, 1).value = "Forecast profit";
  applyLinkCell(
    sheet.getCell(row, 2),
    registry.cellRef("monthly.net_profit", monthCol),
    FORMATS.currency
  );
  row++;
  writeLabelValue(
    sheet,
    row++,
    salesTarget.gapOrSurplus >= 0 ? "Surplus to target" : "Gap to target",
    Math.abs(salesTarget.gapOrSurplus),
    { valueFormat: FORMATS.currency, valueType: "CALCULATED" }
  );
}

function writeAssumptions(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet(SHEET.assumptions);
  setColumnWidths(sheet, [18, 32, 16, 12, 16, 24, 28]);
  const headers = ["CATEGORY", "ASSUMPTION", "VALUE", "UNIT", "TYPE", "SOURCE / BASIS", "NOTES"];
  headers.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h;
  });
  styleHeaderRow(sheet, 1, headers.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  enableAutoFilter(sheet, 1, headers.length);

  const a = data.assumptions;
  let row = 2;
  const push = (
    category: string,
    assumption: string,
    value: string | number,
    unit: string,
    type: "FOUNDER INPUT" | "CALCULATED" | "PLANNING DEFAULT",
    source: string,
    registryKey?: string,
    notes?: string
  ) => {
    sheet.getCell(row, 1).value = category;
    sheet.getCell(row, 2).value = assumption;
    sheet.getCell(row, 3).value = value;
    sheet.getCell(row, 4).value = unit;
    sheet.getCell(row, 5).value = type;
    sheet.getCell(row, 6).value = source;
    sheet.getCell(row, 7).value = notes ?? "";
    for (let c = 1; c <= 7; c++) {
      sheet.getCell(row, c).font = { name: FONT, size: 10 };
      sheet.getCell(row, c).alignment = { wrapText: c <= 2 || c >= 6 };
    }
    if (typeof value === "number" && unit.includes("₹")) {
      sheet.getCell(row, 3).numFmt = FORMATS.currency;
    }
    if (registryKey) {
      registry.registerCell(SHEET.assumptions, row, 3, registryKey);
      if (type === "FOUNDER INPUT") {
        sheet.getCell(row, 3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.inputFill },
        };
      }
    }
    row++;
  };

  push("Studio Setup", "Reformers", a.reformers, "count", "FOUNDER INPUT", "Founder input", "input.reformers");
  push("Studio Setup", "Operating days/week", a.operatingDaysPerWeek, "days", "FOUNDER INPUT", "Founder input", "input.operating_days");
  push("Operating Costs", "Rent", a.rent, "₹/month", "FOUNDER INPUT", "Founder input", "input.rent");
  push("Occupancy", "Target booked occupancy", a.projectedBookedOccupancyPct, "%", "FOUNDER INPUT", "Founder input", "input.target_occupancy_pct");
  push("Tax", "Income tax rate", a.incomeTaxRatePct, "%", "PLANNING DEFAULT", "Planning default", "input.income_tax_rate");
  push("Financing", "Founder funding planned", a.founderEquity, "₹", "FOUNDER INPUT", "Founder input", "input.founder_equity");
  push("Financing", "Loan principal", a.loanAmount, "₹", "FOUNDER INPUT", "Founder input", "input.loan_amount");

  for (const f of CAPEX_FIELDS) {
    const val = (a as Record<string, unknown>)[f.key];
    if (typeof val === "number" && val !== 0) {
      push("Launch Capex", f.label, val, "₹", "FOUNDER INPUT", "Founder input");
    }
  }
  for (const f of FINANCING_FIELDS) {
    const val = (a as Record<string, unknown>)[f.key];
    if (val != null && val !== "" && val !== 0) {
      push("Financing", f.label, val as number | string, f.suffix ?? "", "FOUNDER INPUT", "Founder input");
    }
  }
}

function writeProductsPricing(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("PRODUCTS & PRICING");
  const headers = [
    "PRODUCT",
    "PRODUCT TYPE",
    "CREDITS",
    "VALIDITY",
    "NET SALES PRICE EX GST",
    "NET / CREDIT OR SESSION",
    "GST RATE",
    "CUSTOMER PRICE INC GST",
    "DIRECT COST / DELIVERY",
    "CONTRIBUTION / BOOKING",
    "CONTRIBUTION MARGIN",
    "ACTIVE?",
  ];
  setColumnWidths(sheet, [20, 14, 10, 14, 18, 18, 12, 18, 18, 18, 16, 10]);
  headers.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h;
  });
  styleHeaderRow(sheet, 1, headers.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  enableAutoFilter(sheet, 1, headers.length);

  let row = 2;
  for (const p of data.assumptions.products.filter((pr) => pr.lifecycle !== "archived")) {
    const net = productNetPrice(p, data.assumptions);
    let direct = 0;
    let contribution = 0;
    let validity = "—";
    let netPer = exportNum(net) ?? 0;

    if (p.type === "credit_pack" || p.type === "drop_in") {
      const econ = analyzeFlexiblePack(p, data.assumptions);
      direct = exportNum(econ.expectedVariableCost) ?? 0;
      contribution = exportNum(econ.expectedContribution) ?? 0;
      const rules = resolvePackRules(p);
      validity = `${rules.validityValue} ${rules.validityUnit}`;
      if (p.creditsIncluded > 0) netPer = exportNum(net.dividedBy(p.creditsIncluded)) ?? netPer;
    } else if (p.type === "private") {
      contribution = exportNum(privateContributionPerSession(data.assumptions)) ?? 0;
      direct = netPer - contribution;
      validity = "Per session";
    }

    const gstRate =
      p.gstFollowsGlobal && data.assumptions.gstRegistered
        ? `${data.assumptions.gstRatePct}%`
        : p.gstTreatment;

    sheet.getCell(row, 1).value = p.name;
    sheet.getCell(row, 2).value = p.type;
    sheet.getCell(row, 3).value = p.creditsIncluded || (p.type === "private" ? 1 : 0);
    sheet.getCell(row, 4).value = validity;
    applyCurrencyCell(sheet.getCell(row, 5), exportNum(net));
    applyCurrencyCell(sheet.getCell(row, 6), netPer);
    sheet.getCell(row, 7).value = gstRate;
    applyCurrencyCell(sheet.getCell(row, 8), p.price);
    applyCurrencyCell(sheet.getCell(row, 9), direct);
    applyCurrencyCell(sheet.getCell(row, 10), contribution);
    applyFormulaCell(sheet.getCell(row, 11), `IF(E${row}=0,"",J${row}/E${row})`, FORMATS.percent);
    sheet.getCell(row, 12).value = p.lifecycle !== "archived" ? "Yes" : "No";
    row++;
  }
}

function writeCapacitySchedule(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet("CAPACITY & SCHEDULE");
  setColumnWidths(sheet, [32, 18]);
  const cap = data.model.capacity;
  const a = data.assumptions;

  let row = 1;
  writeSectionTitle(sheet, row, "Capacity summary", 2);
  row++;
  sheet.getCell(row, 1).value = "Reformers";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("input.reformers"), FORMATS.count);
  row++;
  writeLabelValue(sheet, row++, "Operating days/week", a.operatingDaysPerWeek);
  writeLabelValue(sheet, row++, "Physical classes/week", exportNum(cap.weeklyClasses));
  writeLabelValue(sheet, row++, "Available reformer spots/week", exportNum(cap.weeklyAvailableSeats));
  writeLabelValue(sheet, row++, "Available reformer spots/month", exportNum(cap.monthlyAvailableSeats));
  sheet.getCell(row, 1).value = "Target occupancy";
  const occRef = registry.absRef("input.target_occupancy_pct");
  if (occRef) {
    applyFormulaCell(sheet.getCell(row, 2), `${occRef}/100`, FORMATS.percent);
  } else {
    applyPercentCell(sheet.getCell(row, 2), a.projectedBookedOccupancyPct);
  }
  row++;
  row++;

  if (a.schedule.length > 0) {
    writeSectionTitle(sheet, row, "Schedule", 7);
    row++;
    const schedHeaders = ["DAY", "TIME", "SESSION TYPE", "REFORMERS", "CAPACITY", "PEAK/OFF", "INSTRUCTOR", "STATUS"];
    schedHeaders.forEach((h, i) => {
      sheet.getCell(row, i + 1).value = h;
    });
    styleHeaderRow(sheet, row, schedHeaders.length);
    row++;
    for (const slot of a.schedule) {
      sheet.getCell(row, 1).value = slot.day;
      sheet.getCell(row, 2).value = `${slot.startTime} (${slot.durationMinutes} min)`;
      sheet.getCell(row, 3).value = slot.classType;
      applyLinkCell(sheet.getCell(row, 4), registry.absRef("input.reformers"), FORMATS.count);
      sheet.getCell(row, 5).value = slot.capacity;
      sheet.getCell(row, 6).value = slot.peakOffPeak;
      sheet.getCell(row, 7).value = slot.instructor ?? "—";
      sheet.getCell(row, 8).value = slot.status;
      row++;
    }
  }
}

function writeServiceMix(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("SERVICE MIX");
  setColumnWidths(sheet, [28, 18, 18, 18]);
  let row = 1;

  writeSectionTitle(sheet, row, "FORECAST — WHAT I EXPECT", 2);
  row++;
  sheet.getCell(row, 1).value = "Service";
  sheet.getCell(row, 2).value = "Booking mix %";
  styleHeaderRow(sheet, row, 2);
  row++;
  for (const m of data.serviceMix.forecastMix) {
    sheet.getCell(row, 1).value = m.service;
    applyPercentCell(sheet.getCell(row, 2), m.bookingMixPct);
    row++;
  }
  row++;

  writeSectionTitle(sheet, row, "SALES PLAN — WHAT I WANT TO TEST", 3);
  row++;
  sheet.getCell(row, 1).value = "Product";
  sheet.getCell(row, 2).value = "Quantity sold";
  sheet.getCell(row, 3).value = "Net sales";
  styleHeaderRow(sheet, row, 3);
  row++;
  for (const s of data.serviceMix.salesPlan) {
    sheet.getCell(row, 1).value = s.product;
    sheet.getCell(row, 2).value = s.quantitySold;
    applyCurrencyCell(sheet.getCell(row, 3), s.netSales);
    row++;
  }
  row++;

  writeSectionTitle(sheet, row, "CAPACITY — CAN I DELIVER IT?", 2);
  row++;
  const c = data.serviceMix.capacity;
  writeLabelValue(sheet, row++, "Credits created", c.creditsCreated);
  writeLabelValue(sheet, row++, "Expected delivery demand", c.expectedDeliveryDemand);
  writeLabelValue(sheet, row++, "Existing outstanding demand", c.existingOutstandingDemand);
  writeLabelValue(sheet, row++, "Available capacity", c.availableCapacity);
  writeLabelValue(sheet, row++, "Implied occupancy", c.impliedOccupancyPct / 100, {
    valueFormat: FORMATS.percent,
  });
  writeLabelValue(sheet, row++, "Feasibility", c.status.toUpperCase().replace("_", " "));
  row++;

  if (data.serviceMix.impliedDeliveryMix.length > 0) {
    writeSectionTitle(sheet, row, "IMPLIED DELIVERY MIX (YOUR PLAN)", 3);
    row++;
    sheet.getCell(row, 1).value = "Service";
    sheet.getCell(row, 2).value = "Expected delivery demand";
    sheet.getCell(row, 3).value = "Mix %";
    styleHeaderRow(sheet, row, 3);
    row++;
    for (const m of data.serviceMix.impliedDeliveryMix) {
      sheet.getCell(row, 1).value = m.productName;
      sheet.getCell(row, 2).value = exportNum(m.deliveryDemand);
      applyPercentCell(sheet.getCell(row, 3), exportNum(m.mixPct));
      row++;
    }
  }
}

function writeUnitEconomics(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("UNIT ECONOMICS");
  setColumnWidths(sheet, [24, 16, 16, 16, 14, 14, 18, 18]);
  const wr = data.model.revenue.weightedRevenue;
  const headers = [
    "SERVICE",
    "NET SALES / BOOKING",
    "DIRECT COST / BOOKING",
    "CONTRIBUTION / BOOKING",
    "CONTRIBUTION MARGIN",
    "BOOKING MIX",
    "WEIGHTED NET SALES IMPACT",
    "WEIGHTED CONTRIBUTION IMPACT",
  ];
  headers.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h;
  });
  styleHeaderRow(sheet, 1, headers.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  let row = 2;
  for (const r of wr.serviceBookingBreakdown) {
    const net = exportNum(r.netSalesPerOccupiedBooking) ?? 0;
    const contrib = exportNum(r.contributionPerOccupiedBooking) ?? 0;
    sheet.getCell(row, 1).value = r.product.name;
    applyCurrencyCell(sheet.getCell(row, 2), net);
    applyCurrencyCell(sheet.getCell(row, 3), net > 0 ? net - contrib : null);
    applyCurrencyCell(sheet.getCell(row, 4), contrib);
    applyFormulaCell(sheet.getCell(row, 5), `IF(B${row}=0,"",D${row}/B${row})`, FORMATS.percent);
    applyPercentCell(sheet.getCell(row, 6), exportNum(r.serviceBookingMixPct));
    applyCurrencyCell(sheet.getCell(row, 7), exportNum(r.weightedNetSalesImpact));
    applyCurrencyCell(sheet.getCell(row, 8), exportNum(r.weightedContributionImpact));
    row++;
  }
}

function writeMonthlyPL(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet(SHEET.monthlyPl);
  setLandscapePrint(sheet);
  const months = data.model.monthlyProjection;
  const monthCount = months.length;
  setColumnWidths(sheet, [28, ...Array(monthCount).fill(13)]);

  sheet.getCell(1, 1).value = "LINE ITEM";
  for (let m = 0; m < monthCount; m++) {
    sheet.getCell(1, m + 2).value = `Month ${months[m]!.month}`;
  }
  styleHeaderRow(sheet, 1, monthCount + 1);
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  type RowKind = "engine" | "formula";
  const lineItems: Array<{
    label: string;
    key: string;
    kind: RowKind;
    get?: (m: (typeof months)[0]) => number | null;
    formula?: (col: number) => string;
    bold?: boolean;
    percent?: boolean;
  }> = [
    {
      label: "NET SALES",
      key: "monthly.net_sales",
      kind: "engine",
      get: (m) => exportNum(m.pl.netRevenue),
      bold: true,
    },
    {
      label: "Direct costs",
      key: "monthly.direct_costs",
      kind: "engine",
      get: (m) => exportNum(m.directCosts.totalDirectCosts),
    },
    {
      label: "Gross profit / contribution",
      key: "monthly.gross_profit",
      kind: "formula",
      formula: (col) => {
        const ns = registry.localRef("monthly.net_sales", col);
        const dc = registry.localRef("monthly.direct_costs", col);
        return ns && dc ? `${ns}-${dc}` : "0";
      },
      bold: true,
    },
    {
      label: "Operating expenses",
      key: "monthly.operating_expenses",
      kind: "engine",
      get: (m) => exportNum(m.operatingExpenses.totalOperatingExpenses),
    },
    {
      label: "EBITDA",
      key: "monthly.ebitda",
      kind: "formula",
      formula: (col) => {
        const gp = registry.localRef("monthly.gross_profit", col);
        const opex = registry.localRef("monthly.operating_expenses", col);
        return gp && opex ? `${gp}-${opex}` : "0";
      },
      bold: true,
    },
    {
      label: "Depreciation",
      key: "monthly.depreciation",
      kind: "engine",
      get: (m) => exportNum(m.pl.depreciation),
    },
    {
      label: "Interest",
      key: "monthly.interest",
      kind: "engine",
      get: (m) => exportNum(m.pl.interestExpense),
    },
    {
      label: "Tax",
      key: "monthly.tax",
      kind: "engine",
      get: (m) => exportNum(m.pl.incomeTax),
    },
    {
      label: "Planning net profit",
      key: "monthly.net_profit",
      kind: "formula",
      formula: (col) => {
        const e = registry.localRef("monthly.ebitda", col);
        const d = registry.localRef("monthly.depreciation", col);
        const i = registry.localRef("monthly.interest", col);
        const t = registry.localRef("monthly.tax", col);
        return e && d && i && t ? `${e}-${d}-${i}-${t}` : "0";
      },
      bold: true,
    },
    {
      label: "Net profit margin %",
      key: "monthly.net_margin",
      kind: "formula",
      formula: (col) => {
        const np = registry.localRef("monthly.net_profit", col);
        const ns = registry.localRef("monthly.net_sales", col);
        return np && ns ? `IF(${ns}=0,"",${np}/${ns})` : "0";
      },
      percent: true,
    },
  ];

  let row = 2;
  for (const item of lineItems) {
    sheet.getCell(row, 1).value = item.label;
    sheet.getCell(row, 1).font = { name: FONT, size: 10, bold: !!item.bold };
    registry.registerRow(SHEET.monthlyPl, row, item.key);

    for (let m = 0; m < monthCount; m++) {
      const col = m + 2;
      const cell = sheet.getCell(row, col);
      if (item.kind === "formula" && item.formula) {
        applyFormulaCell(cell, item.formula(col), item.percent ? FORMATS.percent : FORMATS.currency);
      } else if (item.get) {
        const val = item.get(months[m]!);
        if (item.percent) applyPercentCell(cell, val);
        else applyCurrencyCell(cell, val);
      }
    }
    row++;
  }
}

function writeYearlyPL(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet(SHEET.yearlyPl);
  setLandscapePrint(sheet);
  const years = data.model.yearlyPL.years;
  const monthCount = data.model.monthlyProjection.length;
  const yearCount = years.length;
  const yoyCount = Math.max(0, yearCount - 1);
  setColumnWidths(sheet, [28, ...Array(yearCount).fill(16), ...Array(yoyCount).fill(14)]);

  const headers = [
    "LINE ITEM",
    ...years.map((y) => `YEAR ${y.year}`),
    ...years.slice(1).map((_, i) => `YOY Y${i + 2} %`),
  ];
  headers.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h;
  });
  styleHeaderRow(sheet, 1, headers.length);
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  const fields: Array<{ label: string; monthlyKey: string; yearlyKeyY1: string; bold?: boolean }> = [
    { label: "Net sales", monthlyKey: "monthly.net_sales", yearlyKeyY1: "yearly.net_sales.y1" },
    { label: "Direct costs", monthlyKey: "monthly.direct_costs", yearlyKeyY1: "yearly.direct_costs.y1" },
    { label: "Gross profit", monthlyKey: "monthly.gross_profit", yearlyKeyY1: "yearly.gross_profit.y1", bold: true },
    { label: "Operating expenses", monthlyKey: "monthly.operating_expenses", yearlyKeyY1: "yearly.operating_expenses.y1" },
    { label: "EBITDA", monthlyKey: "monthly.ebitda", yearlyKeyY1: "yearly.ebitda.y1", bold: true },
    { label: "Planning net profit", monthlyKey: "monthly.net_profit", yearlyKeyY1: "yearly.net_profit.y1", bold: true },
  ];

  const yearRanges = years.map((y, i) => ({
    col: i + 2,
    start: y.startMonth + 1,
    end: Math.min(y.endMonth + 1, monthCount + 1),
  }));

  let row = 2;
  for (const f of fields) {
    sheet.getCell(row, 1).value = f.label;
    sheet.getCell(row, 1).font = { name: FONT, size: 10, bold: !!f.bold };
    const monthlyRow = registry.row(f.monthlyKey);
    if (monthlyRow) {
      for (const yr of yearRanges) {
        if (yr.start <= yr.end) {
          applyFormulaCell(
            sheet.getCell(row, yr.col),
            registry.sumRange(SHEET.monthlyPl, monthlyRow, yr.start, yr.end),
            FORMATS.currency
          );
        }
      }
      registry.registerCell(SHEET.yearlyPl, row, 2, f.yearlyKeyY1);
      for (let y = 1; y < yearCount; y++) {
        const priorCol = colLetter(y + 1);
        const currentCol = colLetter(y + 2);
        const yoyCol = yearCount + 1 + y;
        applyFormulaCell(
          sheet.getCell(row, yoyCol),
          `IF(${priorCol}${row}=0,"", (${currentCol}${row}-${priorCol}${row})/ABS(${priorCol}${row}))`,
          FORMATS.percent
        );
      }
    } else {
      for (let y = 0; y < yearCount; y++) {
        const keyMap: Record<string, keyof (typeof years)[0]> = {
          "monthly.net_sales": "netRevenue",
          "monthly.direct_costs": "directCosts",
          "monthly.gross_profit": "grossProfit",
          "monthly.operating_expenses": "operatingExpenses",
          "monthly.ebitda": "ebitda",
          "monthly.net_profit": "netProfit",
        };
        applyCurrencyCell(
          sheet.getCell(row, y + 2),
          exportNum(years[y]![keyMap[f.monthlyKey] as keyof (typeof years)[0]] as never)
        );
      }
    }
    row++;
  }
}

function writeCashFlow(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("CASH FLOW");
  setLandscapePrint(sheet);
  const monthly = data.model.cashFlow.monthly;
  setColumnWidths(sheet, [28, ...Array(monthly.length).fill(13)]);

  sheet.getCell(1, 1).value = "LINE ITEM";
  monthly.forEach((m, i) => {
    sheet.getCell(1, i + 2).value = `Month ${m.month}`;
  });
  styleHeaderRow(sheet, 1, monthly.length + 1);
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  const rows: Array<{ label: string; get: (m: (typeof monthly)[0]) => number | null }> = [
    { label: "Opening bank cash", get: (m) => exportNum(m.bankCashMovements?.openingBankBeforeMonth) },
    { label: "Total cash inflows", get: (m) => exportNum(m.cashInflows) },
    { label: "Total cash outflows", get: (m) => exportNum(m.cashOutflows) },
    { label: "Net cash movement", get: (m) => exportNum(m.netCashFlow) },
    { label: "Ending bank cash", get: (m) => exportNum(m.bankCashBalance) },
  ];

  let row = 2;
  for (const r of rows) {
    sheet.getCell(row, 1).value = r.label;
    monthly.forEach((m, i) => applyCurrencyCell(sheet.getCell(row, i + 2), r.get(m)));
    row++;
  }
}

function writeBankFunding(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet("BANK CASH & FUNDING");
  setLandscapePrint(sheet);
  const health = data.model.cashFlow.cashHealth;
  setColumnWidths(sheet, [28, 16, ...Array(data.model.cashFlow.monthly.length).fill(13)]);

  let row = 1;
  writeSectionTitle(sheet, row, "Funding summary", 2);
  row++;
  sheet.getCell(row, 1).value = "Founder funding planned";
  applyLinkCell(sheet.getCell(row, 2), registry.absRef("input.founder_equity"), FORMATS.currency);
  row++;
  writeLabelValue(
    sheet,
    row++,
    "Minimum funding required",
    exportNum(health.minimumTotalFundingRequired),
    { valueFormat: FORMATS.currency }
  );
  writeLabelValue(sheet, row++, "Funding gap", exportNum(health.fundingGap), {
    valueFormat: FORMATS.currency,
  });
  writeLabelValue(sheet, row++, "Lowest bank cash", exportNum(health.lowestBankCash), {
    valueFormat: FORMATS.currency,
  });
  writeLabelValue(sheet, row++, "Month of lowest cash", health.lowestBankCashMonth ?? "N/A");
  row++;

  sheet.getCell(row, 1).value = "Month";
  sheet.getCell(row, 2).value = "Closing cash";
  data.model.cashFlow.monthly.forEach((m, i) => {
    sheet.getCell(row, i + 3).value = `M${m.month}`;
  });
  styleHeaderRow(sheet, row, 2 + data.model.cashFlow.monthly.length);
  row++;
  sheet.getCell(row, 1).value = "Closing bank cash";
  applyCurrencyCell(sheet.getCell(row, 2), exportNum(data.model.cashFlow.monthly[0]?.bankCashBalance));
  data.model.cashFlow.monthly.forEach((m, i) => {
    applyCurrencyCell(sheet.getCell(row, i + 3), exportNum(m.bankCashBalance));
  });
}

function writeInvestmentRecovery(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("INVESTMENT RECOVERY");
  setLandscapePrint(sheet);
  setColumnWidths(sheet, [12, 22, 18, 18, 18]);

  let row = 1;
  writeLabelValue(
    sheet,
    row++,
    "Payback hurdle",
    exportNum(data.model.cashFlow.launch.paybackInvestmentBase),
    { valueFormat: FORMATS.currency }
  );
  writeLabelValue(sheet, row++, "Payback month", data.model.payback.paybackMonth ?? "N/A");
  row++;

  const headers = ["Month", "Cumulative business-generated cash", "Investment hurdle", "Recovery position"];
  headers.forEach((h, i) => {
    sheet.getCell(row, i + 1).value = h;
  });
  styleHeaderRow(sheet, row, headers.length);
  row++;

  for (const m of data.model.cashFlow.monthly) {
    sheet.getCell(row, 1).value = m.month;
    applyCurrencyCell(sheet.getCell(row, 2), exportNum(m.cumulativeOperatingCashGenerated));
    applyCurrencyCell(
      sheet.getCell(row, 3),
      exportNum(data.model.cashFlow.launch.paybackInvestmentBase)
    );
    applyCurrencyCell(sheet.getCell(row, 4), exportNum(m.recoveryPosition));
    row++;
  }
}

function writeSalesClientTarget(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("SALES & CLIENT TARGET");
  setColumnWidths(sheet, [32, 14, 14, 16]);
  const products = getCoreSalesProducts(data.assumptions);
  let row = 1;

  writeLabelValue(sheet, row++, "Target month", `Month ${data.salesTarget.targetMonth}`);
  writeLabelValue(sheet, row++, "Target planning net profit", data.salesTarget.targetProfit, {
    valueFormat: FORMATS.currency,
  });
  writeLabelValue(sheet, row++, "Forecast profit", data.salesTarget.forecastProfit, {
    valueFormat: FORMATS.currency,
  });
  row++;

  writeSectionTitle(sheet, row, "Quantities — forecast vs your plan", 4);
  row++;
  sheet.getCell(row, 1).value = "Product";
  sheet.getCell(row, 2).value = "Forecast";
  sheet.getCell(row, 3).value = "Your plan";
  styleHeaderRow(sheet, row, 3);
  row++;
  for (const p of products) {
    sheet.getCell(row, 1).value = getSalesPlanProductLabel(p);
    sheet.getCell(row, 2).value = data.salesTarget.forecastQuantities[p.id] ?? 0;
    sheet.getCell(row, 3).value = data.salesTarget.planQuantities[p.id] ?? 0;
    row++;
  }
  writeLabelValue(
    sheet,
    row++,
    "Net sales (your plan)",
    exportNum(data.salesTarget.planSolution.netSales),
    { valueFormat: FORMATS.currency }
  );
  writeLabelValue(
    sheet,
    row++,
    "Planning net profit (your plan)",
    exportNum(data.salesTarget.planSolution.planningNetProfit),
    { valueFormat: FORMATS.currency }
  );
  row++;

  writeSectionTitle(sheet, row, "Capacity check (your plan)", 2);
  row++;
  const c = data.serviceMix.capacity;
  writeLabelValue(sheet, row++, "Credits created", c.creditsCreated);
  writeLabelValue(sheet, row++, "Expected delivery demand", c.expectedDeliveryDemand);
  writeLabelValue(sheet, row++, "Available capacity", c.availableCapacity);
  applyPercentCell(sheet.getCell(row, 2), c.impliedOccupancyPct);
  sheet.getCell(row, 1).value = "Implied occupancy";
  row++;
  writeLabelValue(sheet, row++, "Status", c.status.toUpperCase().replace("_", " "));
}

function writeScenarios(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data } = ctx;
  const sheet = wb.addWorksheet("SCENARIOS");
  if (data.scenarios.length === 0) {
    sheet.getCell(1, 1).value = "No saved scenarios in this export.";
    return;
  }

  const names = ["METRIC", ...data.scenarios.map((s) => s.name)];
  setColumnWidths(sheet, [28, ...data.scenarios.map(() => 16)]);
  names.forEach((n, i) => {
    sheet.getCell(1, i + 1).value = n;
  });
  styleHeaderRow(sheet, 1, names.length);
  enableAutoFilter(sheet, 1, names.length);

  const metrics: Array<{ label: string; get: (m: (typeof data.scenarios)[0]["metrics"]) => number | string | null }> = [
    { label: "Occupancy %", get: (m) => m.occupancyPct },
    { label: "Net sales", get: (m) => exportNum(m.earnedNetRevenue) },
    { label: "EBITDA", get: (m) => exportNum(m.ebitda) },
    { label: "Planning net profit", get: (m) => exportNum(m.netProfit) },
    { label: "Break-even occupancy %", get: (m) => exportNum(m.breakEvenOccupancyPct) },
    { label: "Payback month", get: (m) => m.paybackMonth ?? "N/A" },
  ];

  let row = 2;
  for (const metric of metrics) {
    sheet.getCell(row, 1).value = metric.label;
    data.scenarios.forEach((s, i) => {
      const val = metric.get(s.metrics);
      const cell = sheet.getCell(row, i + 2);
      if (typeof val === "number") {
        if (metric.label.includes("%")) applyPercentCell(cell, val);
        else applyCurrencyCell(cell, val);
      } else {
        cell.value = val;
      }
    });
    row++;
  }
}

function writeModelChecks(wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) {
  const { data, registry } = ctx;
  const sheet = wb.addWorksheet("MODEL CHECKS");
  setColumnWidths(sheet, [36, 12, 18, 18, 40]);
  const headers = ["CHECK", "STATUS", "EXPECTED", "ACTUAL", "DETAIL"];
  headers.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h;
  });
  styleHeaderRow(sheet, 1, headers.length);
  enableAutoFilter(sheet, 1, headers.length);

  let row = 2;
  for (const check of data.healthChecks) {
    sheet.getCell(row, 1).value = check.label;
    sheet.getCell(row, 2).value = check.passed ? "PASS" : check.note === "WARNING" ? "WARNING" : "FAIL";
    sheet.getCell(row, 3).value = check.expected ?? "";
    sheet.getCell(row, 4).value = check.actual ?? "";
    sheet.getCell(row, 5).value = check.note ?? "";
    row++;
  }
  for (const msg of data.validationMessages) {
    sheet.getCell(row, 1).value = "Validation";
    sheet.getCell(row, 2).value = "WARNING";
    sheet.getCell(row, 5).value = msg;
    row++;
  }

  const y1Row = registry.row("yearly.net_profit.y1");
  const monthlyRow = registry.row("monthly.net_profit");
  if (y1Row && monthlyRow) {
    sheet.getCell(row, 1).value = "Year 1 net profit = sum months 1–12";
    applyFormulaCell(
      sheet.getCell(row, 3),
      registry.sumRange(SHEET.monthlyPl, monthlyRow, 2, 13),
      FORMATS.currency
    );
    applyLinkCell(sheet.getCell(row, 4), registry.absRef("yearly.net_profit.y1"), FORMATS.currency);
    applyFormulaCell(
      sheet.getCell(row, 2),
      `IF(ABS(D${row}-C${row})<1,"PASS","FAIL")`
    );
    row++;
  }
}

type SheetWriter = (wb: ExcelJS.Workbook, ctx: WorkbookWriteContext) => void;

/** Assumptions + P&L before SUMMARY so cross-sheet links resolve in the registry. */
const CORE_SHEETS: SheetWriter[] = [
  writeReadMe,
  writeAssumptions,
  writeMonthlyPL,
  writeYearlyPL,
  writeSummary,
];

const FULL_SHEETS: SheetWriter[] = [
  ...CORE_SHEETS,
  writeProductsPricing,
  writeCapacitySchedule,
  writeServiceMix,
  writeUnitEconomics,
  writeCashFlow,
  writeBankFunding,
  writeInvestmentRecovery,
  writeSalesClientTarget,
  writeScenarios,
  writeModelChecks,
];

const QUICK_SHEETS: SheetWriter[] = [...CORE_SHEETS, writeCashFlow];

export async function exportToExcel(
  data: FinancialExportModel,
  mode: "full" | "quick" = "full"
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OWNED";
  wb.created = new Date(data.metadata.exportDate);

  const ctx: WorkbookWriteContext = {
    data,
    registry: new ExportCellRegistry(),
    mode,
  };

  const writers = mode === "quick" ? QUICK_SHEETS : FULL_SHEETS;
  for (const write of writers) {
    write(wb, ctx);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
