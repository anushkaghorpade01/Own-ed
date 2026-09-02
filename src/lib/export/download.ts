import { buildExportFilename, buildFinancialExportModel, validateExportModel } from "./build-export-model";
import { exportToExcel } from "./excel/write-workbook";
import type { BuildExportModelInput, ExportMode } from "./types";

export async function downloadFinancialExport(
  input: BuildExportModelInput,
  mode: ExportMode = "full"
): Promise<
  { ok: true; filename: string; warnings: string[] } | { ok: false; error: string }
> {
  if (mode === "csv") {
    return { ok: false, error: "Use exportCurrentPageCsv from the page context for CSV export." };
  }

  const model = buildFinancialExportModel(input);
  const { blocking, warnings } = validateExportModel(model);
  if (blocking.length > 0) {
    return {
      ok: false,
      error: `OWNED found an issue while preparing the workbook: ${blocking.join(" ")}`,
    };
  }

  const excelMode = mode === "quick" ? "quick" : "full";
  const buffer = await exportToExcel(model, excelMode);
  const filename = buildExportFilename(model, excelMode);

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { ok: true, filename, warnings };
}

export { buildFinancialExportModel, validateExportModel, exportToExcel };
