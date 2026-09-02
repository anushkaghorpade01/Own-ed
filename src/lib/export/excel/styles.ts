import type { Cell, Worksheet } from "exceljs";

export const FONT = "Arial";

export const COLORS = {
  headerFill: "FFE8E2D9",
  inputFill: "FFF5F0E8",
  formulaFill: "FFE8F0FE",
  passFill: "FFE8F5E9",
  warnFill: "FFFFF8E1",
  failFill: "FFFFEBEE",
  sectionBorder: "FFC4A882",
} as const;

export const FORMATS = {
  currency: '"₹"#,##,##0_);("₹"#,##,##0);–',
  currencyDecimal: '"₹"#,##,##0.00_);("₹"#,##,##0.00);–',
  percent: "0.0%",
  count: "#,##0",
  ratio: "0.00",
} as const;

export function setColumnWidths(sheet: Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

export function styleHeaderRow(sheet: Worksheet, row: number, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = sheet.getCell(row, c);
    cell.font = { name: FONT, size: 10, bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerFill },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: COLORS.sectionBorder } },
    };
  }
  sheet.getRow(row).height = 24;
}

export function writeSectionTitle(sheet: Worksheet, row: number, title: string, colSpan = 2) {
  sheet.mergeCells(row, 1, row, colSpan);
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { name: FONT, size: 13, bold: true };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 22;
}

export function writeLabelValue(
  sheet: Worksheet,
  row: number,
  label: string,
  value: string | number | null | undefined,
  opts?: {
    valueFormat?: string;
    valueType?: "FOUNDER INPUT" | "CALCULATED" | "PLANNING DEFAULT";
    notes?: string;
  }
) {
  sheet.getCell(row, 1).value = label;
  sheet.getCell(row, 1).font = { name: FONT, size: 10 };
  sheet.getCell(row, 1).alignment = { wrapText: true };

  const valCell = sheet.getCell(row, 2);
  if (value === null || value === undefined || value === "") {
    valCell.value = null;
  } else if (typeof value === "number") {
    valCell.value = value;
    if (opts?.valueFormat) valCell.numFmt = opts.valueFormat;
  } else {
    valCell.value = value;
  }
  valCell.font = { name: FONT, size: 10 };
  valCell.alignment = { horizontal: "right" };

  if (opts?.valueType === "FOUNDER INPUT") {
    valCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.inputFill },
    };
  }

  if (opts?.notes) {
    sheet.getCell(row, 3).value = opts.notes;
    sheet.getCell(row, 3).font = { name: FONT, size: 9, italic: true };
    sheet.getCell(row, 3).alignment = { wrapText: true };
  }
}

export function applyCurrencyCell(cell: Cell, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    cell.value = null;
    return;
  }
  cell.value = value;
  cell.numFmt = FORMATS.currency;
  cell.font = { name: FONT, size: 10 };
  cell.alignment = { horizontal: "right" };
}

export function applyPercentCell(cell: Cell, wholePct: number | null | undefined) {
  if (wholePct == null || !Number.isFinite(wholePct)) {
    cell.value = null;
    return;
  }
  cell.value = wholePct / 100;
  cell.numFmt = FORMATS.percent;
  cell.font = { name: FONT, size: 10 };
  cell.alignment = { horizontal: "right" };
}

/** Excel formula cell — linked calculations (light blue fill). */
export function applyFormulaCell(
  cell: Cell,
  formula: string,
  numFmt: string = FORMATS.currency
) {
  cell.value = { formula };
  cell.numFmt = numFmt;
  cell.font = { name: FONT, size: 10 };
  cell.alignment = { horizontal: "right" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.formulaFill },
  };
}

/** Cross-sheet link formula `=reference` */
export function applyLinkCell(cell: Cell, reference: string | null, numFmt?: string) {
  if (!reference) return;
  applyFormulaCell(cell, reference, numFmt);
}

export function hideGridlines(sheet: Worksheet) {
  sheet.views = [{ showGridLines: false }];
}

export function setLandscapePrint(sheet: Worksheet) {
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

export function enableAutoFilter(sheet: Worksheet, fromRow: number, colCount: number) {
  sheet.autoFilter = {
    from: { row: fromRow, column: 1 },
    to: { row: fromRow, column: colCount },
  };
}

export function formatExportDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
