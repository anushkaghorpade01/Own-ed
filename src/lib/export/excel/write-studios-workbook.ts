import ExcelJS from "exceljs";
import type { Studio } from "@/lib/finance/schemas";
import {
  FONT,
  COLORS,
  applyCurrencyCell,
  formatExportDate,
  hideGridlines,
  setColumnWidths,
  styleHeaderRow,
  writeLabelValue,
  writeSectionTitle,
} from "./styles";

const INVALID_SHEET_CHARS = /[\\/*?:\[\]]/g;
const MAX_SHEET_NAME_LEN = 31;

function uniqueSheetName(name: string, index: number, used: Set<string>): string {
  let base = (name.trim() || `Studio ${index + 1}`).replace(INVALID_SHEET_CHARS, "");
  if (!base) base = `Studio ${index + 1}`;
  if (base.length > MAX_SHEET_NAME_LEN) base = base.slice(0, MAX_SHEET_NAME_LEN - 1);

  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n}`;
    candidate = base.slice(0, MAX_SHEET_NAME_LEN - suffix.length) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function writeTextBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  label: string,
  text: string | undefined,
  rowSpan = 4
): number {
  sheet.getCell(startRow, 1).value = label;
  sheet.getCell(startRow, 1).font = { name: FONT, size: 10, bold: true };
  sheet.getCell(startRow, 1).alignment = { vertical: "top", wrapText: true };

  sheet.mergeCells(startRow, 2, startRow + rowSpan - 1, 3);
  const cell = sheet.getCell(startRow, 2);
  cell.value = text?.trim() || null;
  cell.font = { name: FONT, size: 10 };
  cell.alignment = { vertical: "top", wrapText: true };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.inputFill },
  };
  sheet.getRow(startRow).height = 18;
  for (let r = startRow + 1; r < startRow + rowSpan; r++) {
    sheet.getRow(r).height = 18;
  }
  return startRow + rowSpan + 1;
}

function writeBool(sheet: ExcelJS.Worksheet, row: number, label: string, value: boolean) {
  writeLabelValue(sheet, row, label, value ? "Yes" : "No");
}

function writeOptionalCurrency(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: number | undefined
) {
  sheet.getCell(row, 1).value = label;
  sheet.getCell(row, 1).font = { name: FONT, size: 10 };
  applyCurrencyCell(sheet.getCell(row, 2), value ?? null);
}

function writeStudiosReadMe(wb: ExcelJS.Workbook, exportDate: string, count: number) {
  const sheet = wb.addWorksheet("READ ME");
  hideGridlines(sheet);
  setColumnWidths(sheet, [52, 36]);

  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = "OWNED — Studio Intelligence Export";
  sheet.getCell("A1").font = { name: FONT, size: 16, bold: true };

  const lines = [
    "What this workbook is",
    "A snapshot of competitor and inspiration studios captured in OWNED.",
    "",
    `Export date: ${formatExportDate(exportDate)}`,
    `Studios included: ${count}`,
    "",
    "Structure",
    "• STUDIO INDEX — overview of all studios with links to detail tabs",
    "• One worksheet per studio — full intelligence captured during visits",
    "",
    "Notes",
    "Use the My notes section on each studio tab for free-form comments.",
    "This workbook is a snapshot — edit studios in OWNED and re-export to refresh.",
  ];

  let row = 3;
  for (const line of lines) {
    sheet.getCell(row, 1).value = line;
    sheet.getCell(row, 1).font = {
      name: FONT,
      size: 10,
      bold: line.endsWith(":") || line.startsWith("•") === false && line.length < 30 && !line.includes("—"),
    };
    sheet.getCell(row, 1).alignment = { wrapText: true };
    row++;
  }
}

function writeStudiosIndex(wb: ExcelJS.Workbook, studios: Studio[], sheetNames: string[]) {
  const sheet = wb.addWorksheet("STUDIO INDEX");
  hideGridlines(sheet);
  setColumnWidths(sheet, [28, 22, 10, 14, 12, 10, 14]);

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "STUDIO INDEX";
  sheet.getCell("A1").font = { name: FONT, size: 14, bold: true };

  const headers = [
    "Studio",
    "Location",
    "Visited",
    "Drop-in",
    "Reformers",
    "Rating",
    "Worksheet",
  ];
  let row = 3;
  headers.forEach((h, i) => {
    sheet.getCell(row, i + 1).value = h;
  });
  styleHeaderRow(sheet, row, headers.length);
  row++;

  for (let i = 0; i < studios.length; i++) {
    const s = studios[i]!;
    const tab = sheetNames[i]!;
    sheet.getCell(row, 1).value = s.name;
    sheet.getCell(row, 2).value = s.location || "—";
    sheet.getCell(row, 3).value = s.visited ? "Yes" : "No";
    if (s.dropInPrice != null) applyCurrencyCell(sheet.getCell(row, 4), s.dropInPrice);
    sheet.getCell(row, 5).value = s.reformers ?? null;
    sheet.getCell(row, 6).value = s.personalRating != null ? `${s.personalRating}/10` : null;
    const linkCell = sheet.getCell(row, 7);
    linkCell.value = { text: tab, hyperlink: `#'${tab.replace(/'/g, "''")}'!A1` };
    linkCell.font = { name: FONT, size: 10, color: { argb: "FF1A56DB" }, underline: true };
    row++;
  }
}

function writeStudioSheet(wb: ExcelJS.Workbook, studio: Studio, sheetName: string) {
  const sheet = wb.addWorksheet(sheetName);
  hideGridlines(sheet);
  setColumnWidths(sheet, [28, 36, 18]);

  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = studio.name;
  sheet.getCell("A1").font = { name: FONT, size: 16, bold: true };

  sheet.mergeCells("A2:C2");
  sheet.getCell("A2").value = studio.location || "Location not set";
  sheet.getCell("A2").font = { name: FONT, size: 11, italic: true, color: { argb: "FF6B6560" } };

  let row = 4;

  writeSectionTitle(sheet, row, "Visit & links", 3);
  row++;
  writeBool(sheet, row++, "Visited", studio.visited);
  if (studio.visitDate) writeLabelValue(sheet, row++, "Visit date", studio.visitDate);
  if (studio.website) writeLabelValue(sheet, row++, "Website", studio.website);
  if (studio.instagram) writeLabelValue(sheet, row++, "Instagram", studio.instagram);
  row++;

  writeSectionTitle(sheet, row, "Capacity & setup", 3);
  row++;
  if (studio.reformers != null) writeLabelValue(sheet, row++, "Reformers", studio.reformers);
  if (studio.maxClassSize != null) writeLabelValue(sheet, row++, "Max class size", studio.maxClassSize);
  if (studio.instructorCount != null) {
    writeLabelValue(sheet, row++, "Instructors (observed)", studio.instructorCount);
  }
  if (studio.classFormats.length > 0) {
    writeLabelValue(sheet, row++, "Class formats", studio.classFormats.join(", "));
  }
  row++;

  writeSectionTitle(sheet, row, "Pricing observed", 3);
  row++;
  if (studio.dropInPrice != null) writeOptionalCurrency(sheet, row++, "Drop-in", studio.dropInPrice);
  if (studio.privatePrice != null) {
    writeOptionalCurrency(sheet, row++, "Private session", studio.privatePrice);
  }
  if (studio.introOffer) writeLabelValue(sheet, row++, "Intro offer", studio.introOffer);
  if (studio.membership) writeLabelValue(sheet, row++, "Membership", studio.membership);

  const packEntries = Object.entries(studio.packPrices);
  if (packEntries.length > 0) {
    row++;
    sheet.getCell(row, 1).value = "Credit packs";
    sheet.getCell(row, 1).font = { name: FONT, size: 10, bold: true };
    sheet.getCell(row, 2).value = "Price";
    sheet.getCell(row, 2).font = { name: FONT, size: 10, bold: true };
    row++;
    for (const [pack, price] of packEntries) {
      sheet.getCell(row, 1).value = pack;
      applyCurrencyCell(sheet.getCell(row, 2), price);
      row++;
    }
  }

  if (studio.pricingNotes) {
    row = writeTextBlock(sheet, row, "Pricing notes", studio.pricingNotes, 3);
  } else {
    row++;
  }

  writeSectionTitle(sheet, row, "Operations", 3);
  row++;
  if (studio.openingHours) writeLabelValue(sheet, row++, "Opening hours", studio.openingHours);
  if (studio.bookingSystem) writeLabelValue(sheet, row++, "Booking system", studio.bookingSystem);
  if (studio.cancellationPolicy) {
    row = writeTextBlock(sheet, row, "Cancellation policy", studio.cancellationPolicy, 3);
  } else {
    row++;
  }

  writeSectionTitle(sheet, row, "Ratings", 3);
  row++;
  if (studio.googleRating != null) writeLabelValue(sheet, row++, "Google rating", studio.googleRating);
  if (studio.personalRating != null) {
    writeLabelValue(sheet, row++, "Your rating", `${studio.personalRating}/10`);
  }
  row++;

  writeSectionTitle(sheet, row, "Crowd & positioning", 3);
  row++;
  if (studio.targetCustomer) writeLabelValue(sheet, row++, "Target customer", studio.targetCustomer);
  if (studio.observedCrowd) writeLabelValue(sheet, row++, "Observed crowd", studio.observedCrowd);
  if (studio.howBusy) writeLabelValue(sheet, row++, "How busy", studio.howBusy);
  row++;

  writeSectionTitle(sheet, row, "Intelligence captured", 3);
  row++;
  const intelFields: Array<[string, string | undefined]> = [
    ["What I liked", studio.liked],
    ["What I disliked", studio.disliked],
    ["What was exceptional", studio.exceptional],
    ["What was missing", studio.missing],
    ["OWN could learn", studio.ownCouldLearn],
    ["OWN should never copy", studio.ownNeverCopy],
    ["Product gaps / opportunities", studio.productGaps],
    ["Other interesting details", studio.interestingDetails],
  ];
  for (const [label, text] of intelFields) {
    if (text?.trim()) {
      row = writeTextBlock(sheet, row, label, text, 3);
    }
  }

  writeSectionTitle(sheet, row, "My notes", 3);
  row++;
  row = writeTextBlock(
    sheet,
    row,
    "Comments",
    studio.notes,
    6
  );

  writeSectionTitle(sheet, row, "Record", 3);
  row++;
  writeLabelValue(sheet, row++, "Last updated", formatExportDate(studio.updatedAt));
  writeLabelValue(sheet, row++, "Created", formatExportDate(studio.createdAt));

  sheet.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];
}

export async function exportStudiosToExcel(studios: Studio[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OWNED";
  wb.created = new Date();

  const exportDate = new Date().toISOString();
  const usedNames = new Set<string>(["read me", "studio index"]);
  const sheetNames = studios.map((s, i) => uniqueSheetName(s.name, i, usedNames));

  writeStudiosReadMe(wb, exportDate, studios.length);
  writeStudiosIndex(wb, studios, sheetNames);

  for (let i = 0; i < studios.length; i++) {
    writeStudioSheet(wb, studios[i]!, sheetNames[i]!);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function buildStudiosExportFilename(exportDate = new Date()): string {
  const d = exportDate.toISOString().slice(0, 10);
  return `OWNED-Studios-${d}.xlsx`;
}
