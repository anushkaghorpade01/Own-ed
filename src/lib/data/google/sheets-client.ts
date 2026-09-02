import { google, sheets_v4 } from "googleapis";
import { ALL_TAB_NAMES, SHEET_TABS, SPREADSHEET_TITLE, type SheetTabName } from "../tabs";
import type { GoogleTokenSession } from "./session";
import { authClientFromSession } from "./oauth";

export async function findOrCreateSpreadsheet(
  session: GoogleTokenSession
): Promise<string> {
  const auth = authClientFromSession(session);
  const drive = google.drive({ version: "v3", auth });

  const existing = await drive.files.list({
    q: `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: SPREADSHEET_TITLE,
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    fields: "id",
  });

  const sheetId = created.data.id!;
  await bootstrapSpreadsheetTabs(session, sheetId);
  return sheetId;
}

export async function findOrCreateDriveFolder(
  session: GoogleTokenSession,
  folderName = "Own-ed"
): Promise<string> {
  const auth = authClientFromSession(session);
  const drive = google.drive({ version: "v3", auth });

  const existing = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const folderId = created.data.id!;
  const subfolders = ["Finance", "Studios", "Space", "Brand", "Vendors", "Documents", "Exports"];
  for (const sub of subfolders) {
    await drive.files.create({
      requestBody: {
        name: sub,
        mimeType: "application/vnd.google-apps.folder",
        parents: [folderId],
      },
    });
  }

  return folderId;
}

export async function bootstrapSpreadsheetTabs(
  session: GoogleTokenSession,
  spreadsheetId: string
): Promise<void> {
  const auth = authClientFromSession(session);
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(
    meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) ?? []
  );

  const requests: sheets_v4.Schema$Request[] = [];

  for (const tabName of ALL_TAB_NAMES) {
    if (!existing.has(tabName)) {
      requests.push({
        addSheet: { properties: { title: tabName } },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  const headerUpdates = ALL_TAB_NAMES.map((tabName) => ({
    range: `${tabName}!A1`,
    values: [SHEET_TABS[tabName as SheetTabName] as unknown as string[]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: headerUpdates,
    },
  });
}

export async function readSheetTab(
  session: GoogleTokenSession,
  spreadsheetId: string,
  tabName: SheetTabName
): Promise<Record<string, string>[]> {
  const auth = authClientFromSession(session);
  const sheets = google.sheets({ version: "v4", auth });
  const headers = SHEET_TABS[tabName];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:ZZ`,
  });

  const rows = res.data.values ?? [];
  return rows
    .filter((row) => row.some((cell) => cell !== "" && cell != null))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = row[i]?.toString() ?? "";
      });
      return record;
    });
}

export async function appendSheetRows(
  session: GoogleTokenSession,
  spreadsheetId: string,
  tabName: SheetTabName,
  rows: string[][]
): Promise<void> {
  if (rows.length === 0) return;
  const auth = authClientFromSession(session);
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export async function replaceSheetTabData(
  session: GoogleTokenSession,
  spreadsheetId: string,
  tabName: SheetTabName,
  rows: string[][]
): Promise<void> {
  const auth = authClientFromSession(session);
  const sheets = google.sheets({ version: "v4", auth });
  const headers = SHEET_TABS[tabName];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A2:ZZ`,
  });

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A2`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  // Ensure headers intact
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers as unknown as string[]] },
  });
}

export function rowFromRecord(
  tabName: SheetTabName,
  record: Record<string, unknown>
): string[] {
  return SHEET_TABS[tabName].map((col) => {
    const val = record[col];
    if (val == null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  });
}
