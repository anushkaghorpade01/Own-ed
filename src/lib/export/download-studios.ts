import { exportStudiosToExcel, buildStudiosExportFilename } from "./excel/write-studios-workbook";
import type { Studio } from "@/lib/finance/schemas";

export async function downloadStudiosExport(
  studios: Studio[]
): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  try {
    const buffer = await exportStudiosToExcel(studios);
    const filename = buildStudiosExportFilename();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return { ok: true, filename };
  } catch {
    return { ok: false, error: "OWNED could not prepare the studios workbook." };
  }
}

export { exportStudiosToExcel, buildStudiosExportFilename };
