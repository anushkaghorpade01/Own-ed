import type { PageCsvExport } from "./types";

/** RFC 4180-style CSV serialization (UTF-8, no BOM). */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeCsvTable(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];
  return lines.join("\r\n");
}

export function buildPageCsvFilename(exp: PageCsvExport): string {
  const slug = exp.pageTitle.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `OWNED_${slug}_${date}.csv`;
}

export function downloadPageCsv(exp: PageCsvExport): void {
  const csv = serializeCsvTable(exp.headers, exp.rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildPageCsvFilename(exp);
  a.click();
  URL.revokeObjectURL(url);
}
