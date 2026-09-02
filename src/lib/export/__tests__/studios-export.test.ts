import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { exportStudiosToExcel } from "@/lib/export/excel/write-studios-workbook";
import type { Studio } from "@/lib/finance/schemas";

function sampleStudio(overrides: Partial<Studio> = {}): Studio {
  const now = new Date().toISOString();
  return {
    id: "studio-1",
    name: "Flow Reform",
    location: "Bandra West, Mumbai",
    visited: true,
    visitDate: "2026-08-15",
    reformers: 8,
    maxClassSize: 3,
    dropInPrice: 2500,
    privatePrice: 4500,
    packPrices: { "10 credits": 8500 },
    personalRating: 8,
    liked: "Great lighting and calm vibe",
    ownCouldLearn: "Standing spot waitlist UX",
    notes: "Revisit on a Saturday morning peak slot.",
    classFormats: ["Reformer", "Private"],
    ratings: {},
    imageUrls: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Studios Excel export", () => {
  it("creates index and one sheet per studio", async () => {
    const studios = [
      sampleStudio(),
      sampleStudio({ id: "studio-2", name: "Core Studio", location: "Andheri" }),
    ];
    const buffer = await exportStudiosToExcel(studios);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const names = wb.worksheets.map((s) => s.name);
    expect(names).toContain("READ ME");
    expect(names).toContain("STUDIO INDEX");
    expect(names).toContain("Flow Reform");
    expect(names).toContain("Core Studio");
    expect(names.length).toBe(4);
  });

  it("includes notes and pricing on studio sheet", async () => {
    const buffer = await exportStudiosToExcel([sampleStudio()]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const sheet = wb.getWorksheet("Flow Reform");
    expect(sheet).toBeDefined();

    const values = new Set<string>();
    sheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") values.add(cell.value);
      });
    });

    expect(values.has("My notes")).toBe(true);
    expect([...values].some((v) => v.includes("Revisit on a Saturday"))).toBe(true);
    expect([...values].some((v) => v.includes("Great lighting"))).toBe(true);
  });

  it("deduplicates sheet names", async () => {
    const studios = [
      sampleStudio({ id: "a", name: "Studio Alpha" }),
      sampleStudio({ id: "b", name: "Studio Alpha" }),
    ];
    const buffer = await exportStudiosToExcel(studios);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const names = wb.worksheets.map((s) => s.name);
    expect(names.filter((n) => n.startsWith("Studio Alpha")).length).toBe(2);
  });
});
